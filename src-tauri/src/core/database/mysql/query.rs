use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;
use futures_util::TryStreamExt;
use crate::errors::AppResult;
use crate::models::query::*;
use crate::core::query::validator;
use crate::core::query::splitter;

type MySqlRow = sqlx::mysql::MySqlRow;

/// 列类型的宽松分类，用于指导 try_get 的目标 Rust 类型。
/// 按类别而非具体类型分发，避免漏掉某个新类型；
/// 同一类别内的多个 try_get 仍按兼容顺序排列。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MySqlTypeKind {
    /// 字符串/文本/枚举/集合
    /// sqlx 原生驱动对这些类型支持 String 解码
    StringLike,
    /// 二进制/位/几何类型，按字节读取
    BinaryLike,
    /// 整数（有符号/无符号）
    Integer,
    /// 浮点
    Float,
    /// 日期/时间类型：date/datetime/timestamp/time/year
    /// sqlx 0.8 的 String Decode 不支持这些类型，需通过 chrono 类型解码
    DateTime,
    /// DECIMAL/NUMERIC：sqlx 解码为 BigDecimal 保留精度，避免 String 解码失败
    Decimal,
    /// JSON：sqlx 解码为 serde_json::Value，避免 String 解码失败
    Json,
    /// 未知类型，回退到顺序尝试
    Unknown,
}

/// 根据 MySQL 列类型名返回宽松分类。
/// 用 ASCII 大写比较，避免数据库大小写配置差异。
fn classify_mysql_type(type_name: &str) -> MySqlTypeKind {
    let u = type_name.to_ascii_uppercase();
    match u.as_str() {
        // 字符串/文本/枚举/集合（sqlx 原生 String 解码）
        "VARCHAR" | "CHAR" | "TINYTEXT" | "TEXT" | "MEDIUMTEXT" | "LONGTEXT" |
        "ENUM" | "SET" => MySqlTypeKind::StringLike,

        // JSON：sqlx 解码为 serde_json::Value，避免 String 解码失败
        "JSON" => MySqlTypeKind::Json,

        // 日期时间：sqlx 解码为 chrono 类型，避免 String 解码失败
        "DATE" | "DATETIME" | "TIMESTAMP" | "TIME" | "YEAR" => MySqlTypeKind::DateTime,

        // DECIMAL：sqlx 解码为 BigDecimal，保留精度
        "DECIMAL" | "NUMERIC" => MySqlTypeKind::Decimal,

        // 二进制
        "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" |
        "BINARY" | "VARBINARY" | "BIT" | "GEOMETRY" => MySqlTypeKind::BinaryLike,

        // 整数
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "INTEGER" | "BIGINT" | "BOOL" | "BOOLEAN" => MySqlTypeKind::Integer,

        // 浮点
        "FLOAT" | "DOUBLE" | "REAL" => MySqlTypeKind::Float,

        _ => MySqlTypeKind::Unknown,
    }
}

/// 从列元数据推断宽松类型分类。
/// 调用方：`row.columns()[idx].type_info().name()` 返回如 "VARCHAR"。
fn kind_of(row: &MySqlRow, idx: usize) -> MySqlTypeKind {
    let cols = row.columns();
    if idx >= cols.len() { return MySqlTypeKind::Unknown; }
    classify_mysql_type(cols[idx].type_info().name())
}

/// 检测 SQL 是否为不支持 prepared statement 协议的命令。
/// MySQL 错误 1295 (HY000): This command is not supported in the prepared
/// statement protocol yet —— 对 USE / SHOW / SET / BEGIN / COMMIT / ROLLBACK
/// 等管理命令必须走简单查询协议（sqlx::raw_sql）。
pub(crate) fn needs_raw_protocol(sql: &str) -> bool {
    let trimmed = sql.trim();
    if trimmed.is_empty() { return false; }
    let upper = trimmed.to_ascii_uppercase();
    upper.starts_with("USE ")
        || upper.starts_with("SHOW ")
        || upper.starts_with("SET ")
        || upper == "BEGIN" || upper.starts_with("BEGIN ")
        || upper == "COMMIT" || upper.starts_with("COMMIT ")
        || upper == "ROLLBACK" || upper.starts_with("ROLLBACK ")
        || upper.starts_with("START TRANSACTION")
        || upper.starts_with("FLUSH")
        || upper.starts_with("RESET")
        || upper.starts_with("KILL ")
        || upper.starts_with("SHUTDOWN")
        || upper.starts_with("GRANT")
        || upper.starts_with("REVOKE")
        || upper.starts_with("LOAD DATA")
        // CREATE/ALTER/DROP PROCEDURE/FUNCTION/TRIGGER 含 BEGIN...END 复合块，
        // 在 prepared statement 协议下触发 MySQL 错误 1295，必须走 raw_sql
        || upper.starts_with("CREATE PROCEDURE")
        || upper.starts_with("CREATE FUNCTION")
        || upper.starts_with("CREATE TRIGGER")
        || upper.starts_with("ALTER PROCEDURE")
        || upper.starts_with("ALTER FUNCTION")
        || upper.starts_with("DROP PROCEDURE")
        || upper.starts_with("DROP FUNCTION")
        || upper.starts_with("DROP TRIGGER")
}

fn row_to_json_vec(row: &MySqlRow, col_count: usize) -> Vec<serde_json::Value> {
    (0..col_count).map(|i| row_value_to_json(row, i)).collect()
}

/// 从列元数据生成干净的类型名（如 "VARCHAR"、"DATETIME"），而非 Debug 格式。
fn type_name_of(col: &sqlx::mysql::MySqlColumn) -> String {
    col.type_info().name().to_string()
}

pub async fn execute_query(pool: &sqlx::mysql::MySqlPool, sql: &str) -> AppResult<QueryResult> {
    let normalized = validator::normalize_query_sql(sql);
    let start = std::time::Instant::now();
    // USE/SHOW/SET 等命令不支持 prepared statement 协议，需用 raw_sql
    let rows = if needs_raw_protocol(&normalized) {
        sqlx::raw_sql(&normalized).fetch_all(pool).await?
    } else {
        sqlx::query(&normalized).fetch_all(pool).await?
    };
    let query_time = start.elapsed().as_secs_f64();
    if rows.is_empty() {
        return Ok(QueryResult { columns: vec![], rows: vec![], query_time_secs: query_time, fetch_time_secs: 0.0 });
    }
    let col_count = rows[0].columns().len();
    let col_metas: Vec<ColumnMeta> = rows[0].columns().iter().map(|c| ColumnMeta {
        name: c.name().to_string(), label: c.name().to_string(), type_name: type_name_of(c),
    }).collect();
    let result_rows: Vec<Vec<serde_json::Value>> = rows.iter().map(|r| row_to_json_vec(r, col_count)).collect();
    Ok(QueryResult { columns: col_metas, rows: result_rows, query_time_secs: query_time, fetch_time_secs: start.elapsed().as_secs_f64() - query_time })
}

pub async fn execute_query_prepared(pool: &sqlx::mysql::MySqlPool, sql: &str, _params: &[SqlParam]) -> AppResult<QueryResult> {
    execute_query(pool, sql).await
}

pub async fn execute_query_page(pool: &sqlx::mysql::MySqlPool, sql: &str, page: Option<u64>, page_size: Option<u64>, include_total: Option<bool>) -> AppResult<QueryPageResult> {
    let start = std::time::Instant::now();
    // 前端传 1-based page（第一页为 1），这里必须换算为 0-based offset，
    // 否则第一页会直接跳过前 pageSize 行（表现为“暂无数据”）。
    let page = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(200).clamp(1, 1000);
    let offset = (page - 1).saturating_mul(ps);

    // 归一化：去掉首尾空白与结尾分号；用 ANSI 切分器校验确实是单条语句
    // （引号/注释内的分号不会被误判，优于 V1 的 contains(';') 写法）。
    let normalized = normalize_page_sql(sql)?;

    // include_total：对原查询做 COUNT(*) 子查询，得到总数与总页数
    let (total_rows, total_pages) = if include_total.unwrap_or(false) {
        let count_sql = format!(
            "SELECT COUNT(*) AS __dwb_total_rows FROM ({}) AS __dwb_count_subquery",
            normalized
        );
        let total: i64 = sqlx::query_scalar(&count_sql).fetch_one(pool).await?;
        let total = total.max(0) as u64;
        let pages = if total == 0 { 1 } else { total.div_ceil(ps) };
        (Some(total), Some(pages))
    } else {
        (None, None)
    };

    // 多取一行用于精确判断 has_more（V1 的成熟做法）
    let paged = build_paged_sql(&normalized, offset, ps + 1);
    let rows = if needs_raw_protocol(&paged) {
        sqlx::raw_sql(&paged).fetch_all(pool).await?
    } else {
        sqlx::query(&paged).fetch_all(pool).await?
    };
    let query_time = start.elapsed().as_secs_f64();
    let col_count = if !rows.is_empty() { rows[0].columns().len() } else { 0 };
    let col_metas: Vec<ColumnMeta> = if !rows.is_empty() {
        rows[0].columns().iter().map(|c| ColumnMeta { name: c.name().to_string(), label: c.name().to_string(), type_name: type_name_of(c) }).collect()
    } else { vec![] };
    let result_rows: Vec<Vec<serde_json::Value>> = rows.iter().take(ps as usize).map(|r| row_to_json_vec(r, col_count)).collect();
    let has_more = (rows.len() as u64) > ps;
    Ok(QueryPageResult { columns: col_metas, rows: result_rows, page, page_size: ps, has_more, total_rows, total_pages, query_time_secs: query_time, fetch_time_secs: start.elapsed().as_secs_f64() - query_time })
}

/// 分页查询归一化：单条语句 + 去结尾分号。
/// 用 ANSI 切分器判断语句数量，引号/注释内的 `;` 不会误判。
fn normalize_page_sql(sql: &str) -> AppResult<String> {
    let statements = splitter::split_statements(sql);
    if statements.len() > 1 {
        return Err(crate::errors::AppError::InvalidInput(
            "Paginated query only supports a single SQL statement".into(),
        ));
    }
    let normalized = statements.into_iter().next().unwrap_or_default();
    if normalized.is_empty() {
        return Err(crate::errors::AppError::InvalidInput(
            "SQL query cannot be empty".into(),
        ));
    }
    Ok(normalized)
}

/// 构造分页 SQL：
/// - 普通 SELECT（无 LIMIT / FOR UPDATE / INTO OUTFILE）直接下推 LIMIT；
/// - 其他形态（WITH/UNION/已含 LIMIT/带锁读等）整体包裹为派生表后再分页，
///   避免追加 LIMIT 破坏原语句语义或直接语法错误。
fn build_paged_sql(normalized_sql: &str, offset: u64, fetch_size: u64) -> String {
    let lowered = normalized_sql.to_ascii_lowercase();
    let has_limit_token = lowered.split_whitespace().any(|token| token == "limit");
    let has_for_update = lowered.contains(" for update");
    let has_into_outfile = lowered.contains(" into outfile");
    let can_push_down_limit = lowered.starts_with("select")
        && !has_limit_token
        && !has_for_update
        && !has_into_outfile;

    if can_push_down_limit {
        format!("{} LIMIT {} OFFSET {}", normalized_sql, fetch_size, offset)
    } else {
        format!(
            "SELECT * FROM ({}) AS __dwb_page_subquery LIMIT {} OFFSET {}",
            normalized_sql, fetch_size, offset
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_page_sql_strips_trailing_semicolon() {
        let sql = normalize_page_sql("SELECT 1;").unwrap();
        assert_eq!(sql, "SELECT 1");
    }

    #[test]
    fn test_normalize_page_sql_rejects_multiple_statements() {
        assert!(normalize_page_sql("SELECT 1; SELECT 2").is_err());
    }

    #[test]
    fn test_normalize_page_sql_allows_semicolon_in_string() {
        let sql = normalize_page_sql(r#"SELECT 'a;b'"#).unwrap();
        assert_eq!(sql, r#"SELECT 'a;b'"#);
    }

    #[test]
    fn test_build_paged_sql_push_down_for_plain_select() {
        let paged = build_paged_sql("SELECT * FROM score", 0, 201);
        assert_eq!(paged, "SELECT * FROM score LIMIT 201 OFFSET 0");
    }

    #[test]
    fn test_build_paged_sql_wraps_non_select() {
        let paged = build_paged_sql("WITH c AS (SELECT 1) SELECT * FROM c", 200, 201);
        assert!(paged.starts_with("SELECT * FROM (WITH c AS (SELECT 1) SELECT * FROM c) AS __dwb_page_subquery"));
    }
}

/// 多结果集查询（CALL / SHOW / DESCRIBE 等）。
///
/// 说明：
/// - 走 raw_sql 文本协议：二进制 prepared statement 协议对 CALL 等命令会触发
///   MySQL 错误 1295，且 fetch_all 只取第一个结果集；
/// - 通过 `USE db; <原SQL>` 同报文执行：多语句在同一物理连接上按顺序执行，
///   保证 CALL 的数据库上下文（避免连接池复用导致 1046 No database selected），
///   同时绕开 `&mut MySqlConnection` 的 Executor HRTB 限制（sqlx 0.8 已知问题）。
pub async fn execute_query_multi(
    pool: &sqlx::mysql::MySqlPool,
    sql: &str,
    database: Option<&str>,
) -> AppResult<MultiQueryResult> {
    let normalized = validator::normalize_query_sql(sql);
    let start = std::time::Instant::now();

    let full_sql = match database.filter(|d| !d.trim().is_empty()) {
        Some(db) => format!("USE `{}`; {}", db.replace('`', "``"), normalized),
        None => normalized.clone(),
    };

    // fetch_many 逐个消费所有结果集（V1 的 query_iter 文本协议行为）：
    //   Either::Left(MySqlQueryResult)  —— 结果集结束/最终 OK 包
    //   Either::Right(MySqlRow)         —— 当前结果集的一行
    let mut stream = sqlx::raw_sql(&full_sql).fetch_many(pool);

    let mut result_sets: Vec<QueryResult> = Vec::new();
    let mut affected_rows = 0u64;
    let mut last_insert_id = 0u64;
    let mut current_cols: Vec<ColumnMeta> = Vec::new();
    let mut current_rows: Vec<Vec<serde_json::Value>> = Vec::new();

    while let Some(item) = stream.try_next().await? {
        match item {
            sqlx::Either::Left(done) => {
                // 当前结果集结束：把已收集的行保存为 QueryResult（空集不输出，与 V1 一致）
                if !current_cols.is_empty() || !current_rows.is_empty() {
                    result_sets.push(QueryResult {
                        columns: std::mem::take(&mut current_cols),
                        rows: std::mem::take(&mut current_rows),
                        query_time_secs: 0.0,
                        fetch_time_secs: 0.0,
                    });
                }
                if done.rows_affected() > 0 {
                    affected_rows = done.rows_affected();
                }
                if done.last_insert_id() > 0 {
                    last_insert_id = done.last_insert_id();
                }
            }
            sqlx::Either::Right(row) => {
                if current_cols.is_empty() {
                    current_cols = row.columns().iter().map(|c| ColumnMeta {
                        name: c.name().to_string(),
                        label: c.name().to_string(),
                        type_name: type_name_of(c),
                    }).collect();
                }
                current_rows.push(row_to_json_vec(&row, current_cols.len()));
            }
        }
    }

    // 防御性收尾：正常情况下 Left 包已触发，这里避免极端协议下遗漏
    if !current_cols.is_empty() || !current_rows.is_empty() {
        result_sets.push(QueryResult {
            columns: current_cols,
            rows: current_rows,
            query_time_secs: 0.0,
            fetch_time_secs: 0.0,
        });
    }

    let t = start.elapsed().as_secs_f64();
    for rs in &mut result_sets {
        rs.query_time_secs = t;
    }
    Ok(MultiQueryResult {
        result_sets,
        affected_rows,
        last_insert_id,
        query_time_secs: t,
        fetch_time_secs: 0.0,
    })
}

pub async fn execute_query_multi_prepared(pool: &sqlx::mysql::MySqlPool, sql: &str, _params: &[SqlParam]) -> AppResult<MultiQueryResult> {
    execute_query_multi(pool, sql, None).await
}

pub async fn execute_update(pool: &sqlx::mysql::MySqlPool, sql: &str) -> AppResult<ExecResult> {
    let normalized = validator::normalize_query_sql(sql);
    let start = std::time::Instant::now();
    // USE/SHOW/SET 等命令不支持 prepared statement 协议，需用 raw_sql
    let result = if needs_raw_protocol(&normalized) {
        sqlx::raw_sql(&normalized).execute(pool).await?
    } else {
        sqlx::query(&normalized).execute(pool).await?
    };
    let lids = result.last_insert_id();
    Ok(ExecResult { affected_rows: result.rows_affected(), last_insert_id: lids, query_time_secs: start.elapsed().as_secs_f64() })
}

pub async fn execute_update_prepared(pool: &sqlx::mysql::MySqlPool, sql: &str, _params: &[SqlParam]) -> AppResult<ExecResult> {
    execute_update(pool, sql).await
}

pub(crate) fn row_value_to_json(row: &MySqlRow, index: usize) -> serde_json::Value {
    // 基于列类型分发解码策略，覆盖 MySQL 全部列类型：
    //   StringLike: varchar/text/char/enum/set
    //   DateTime:   date/datetime/timestamp/time/year（通过 chrono 类型解码后转字符串）
    //   Decimal:    decimal/numeric（通过 BigDecimal 解码保留精度）
    //   Json:       json（通过 serde_json::Value 解码）
    //   BinaryLike: blob/binary/varbinary/bit/geometry
    //   Integer:    tinyint/smallint/mediumint/int/bigint/bool (有/无符号)
    //   Float:      float/double/real
    //   Unknown:    回退到顺序尝试（兼容未来新类型或驱动行为差异）
    //
    // 全部分支均使用 Option<T> 解码以正确处理 NULL，避免 None 被误判为类型不匹配。
    match kind_of(row, index) {
        MySqlTypeKind::StringLike => {
            // 字符串类：sqlx 原生驱动对 varchar/char/text/enum/set 支持 String 解码
            if let Ok(Some(v)) = row.try_get::<Option<String>, _>(index) {
                return serde_json::Value::String(v);
            }
            // 极少情况下驱动对某些 StringLike 类型报告为 Blob（如 CAST 结果），用 Vec<u8> 兜底
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::DateTime => {
            // 日期/时间类型：sqlx 0.8 的 String Decode 不支持这些类型，
            // 必须通过 chrono 类型解码后再 to_string，否则会回退到 Null（前端显示 (NULL)）。
            // DATE → NaiveDate
            if let Ok(Some(v)) = row.try_get::<Option<chrono::NaiveDate>, _>(index) {
                return serde_json::Value::String(v.to_string());
            }
            // DATETIME → NaiveDateTime
            if let Ok(Some(v)) = row.try_get::<Option<chrono::NaiveDateTime>, _>(index) {
                return serde_json::Value::String(v.to_string());
            }
            // TIMESTAMP → DateTime<Utc>（sqlx 对 TIMESTAMP 默认按 UTC 解码）
            // 用 naive 格式 "2024-01-15 10:30:00" 而非带 UTC 后缀，符合 MySQL 客户端习惯
            if let Ok(Some(v)) = row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(index) {
                return serde_json::Value::String(v.naive_utc().to_string());
            }
            // TIME → NaiveTime
            if let Ok(Some(v)) = row.try_get::<Option<chrono::NaiveTime>, _>(index) {
                return serde_json::Value::String(v.to_string());
            }
            // YEAR → u16（MySQL YEAR 范围 1900-2155，按整数返回更自然）
            if let Ok(Some(v)) = row.try_get::<Option<u16>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            // 兜底：String / Vec<u8>（兼容 CAST('2024-01-15' AS CHAR) 等表达式结果）
            if let Ok(Some(v)) = row.try_get::<Option<String>, _>(index) {
                return serde_json::Value::String(v);
            }
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::Decimal => {
            // DECIMAL/NUMERIC：sqlx 0.8 的 String Decode 不支持 DECIMAL，
            // 必须通过 BigDecimal 解码以保留精度（避免 f64 精度损失和 String 解码失败）。
            // bigdecimal 不是本 crate 直接依赖，使用 sqlx 在 bigdecimal feature 下重新导出的类型。
            if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::BigDecimal>, _>(index) {
                return serde_json::Value::String(v.to_string());
            }
            // 兜底：String / Vec<u8>
            if let Ok(Some(v)) = row.try_get::<Option<String>, _>(index) {
                return serde_json::Value::String(v);
            }
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::Json => {
            // JSON：sqlx 0.8 的 String Decode 不支持 JSON 类型，
            // 必须通过 serde_json::Value 解码（sqlx 的 json feature 已启用）。
            // 用 compact 字符串保留原始结构，前端如需美化可后续扩展。
            if let Ok(Some(v)) = row.try_get::<Option<serde_json::Value>, _>(index) {
                return serde_json::Value::String(v.to_string());
            }
            // 兜底：String / Vec<u8>
            if let Ok(Some(v)) = row.try_get::<Option<String>, _>(index) {
                return serde_json::Value::String(v);
            }
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::BinaryLike => {
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                // 用 lossy 转字符串，保留原始字节信息；前端如需可十六进制展示
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            // BIT(1) 有时驱动会报告为 bool
            if let Ok(Some(v)) = row.try_get::<Option<bool>, _>(index) {
                return serde_json::Value::Bool(v);
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::Integer => {
            // 有符号优先（更常见），无符号次之
            if let Ok(Some(v)) = row.try_get::<Option<i64>, _>(index) {
                return serde_json::Value::Number(v.into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<u64>, _>(index) {
                return serde_json::Value::Number(v.into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<i32>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<u32>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<i16>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<u16>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<i8>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<u8>, _>(index) {
                return serde_json::Value::Number((v as i64).into());
            }
            // bool 是 tinyint(1) 的别名
            if let Ok(Some(v)) = row.try_get::<Option<bool>, _>(index) {
                return serde_json::Value::Bool(v);
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::Float => {
            if let Ok(Some(v)) = row.try_get::<Option<f64>, _>(index) {
                if let Some(n) = serde_json::Number::from_f64(v) {
                    return serde_json::Value::Number(n);
                }
            }
            if let Ok(Some(v)) = row.try_get::<Option<f32>, _>(index) {
                if let Some(n) = serde_json::Number::from_f64(v as f64) {
                    return serde_json::Value::Number(n);
                }
            }
            serde_json::Value::Null
        }
        MySqlTypeKind::Unknown => {
            // 未知类型：顺序尝试全部主流类型，保证最大兼容性
            if let Ok(Some(v)) = row.try_get::<Option<String>, _>(index) {
                return serde_json::Value::String(v);
            }
            if let Ok(Some(v)) = row.try_get::<Option<Vec<u8>>, _>(index) {
                return serde_json::Value::String(String::from_utf8_lossy(&v).into_owned());
            }
            if let Ok(Some(v)) = row.try_get::<Option<i64>, _>(index) {
                return serde_json::Value::Number(v.into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<u64>, _>(index) {
                return serde_json::Value::Number(v.into());
            }
            if let Ok(Some(v)) = row.try_get::<Option<f64>, _>(index) {
                if let Some(n) = serde_json::Number::from_f64(v) {
                    return serde_json::Value::Number(n);
                }
            }
            if let Ok(Some(v)) = row.try_get::<Option<bool>, _>(index) {
                return serde_json::Value::Bool(v);
            }
            serde_json::Value::Null
        }
    }
}
