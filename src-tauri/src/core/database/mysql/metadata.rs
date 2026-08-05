use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;
use sqlx::mysql::MySqlRow;
use crate::errors::AppResult;
use crate::models::metadata::*;
use crate::models::connection::ConnectionProperties;

type Pool = sqlx::mysql::MySqlPool;

/// 从行中获取字符串，覆盖 MySQL 全部列类型。
/// 对于 NULL 值返回空字符串（如需区分 NULL 请用 get_opt_str）。
/// 支持的类型：varchar/text/char/enum/set/json/date/datetime/timestamp/time/year/decimal
/// blob/binary/varbinary/bit/geometry、整数（有/无符号）、浮点、bool。
fn get_str(r: &MySqlRow, idx: usize) -> String {
    get_opt_str(r, idx).unwrap_or_default()
}

/// 从行中获取可选字符串（可能为 NULL），覆盖 MySQL 全部列类型。
/// NULL 返回 None，空字符串返回 Some("")。
/// 实现策略：先按列的 type_info 分类，再按类别选择 try_get 类型；
/// 未知类型回退到顺序尝试。
fn get_opt_str(r: &MySqlRow, idx: usize) -> Option<String> {
    let cols = r.columns();
    if idx >= cols.len() { return None; }
    let kind = classify(cols[idx].type_info().name());
    match kind {
        MySqlKind::StringLike => {
            if let Ok(Some(v)) = r.try_get::<Option<String>, _>(idx) { return Some(v); }
            if let Ok(Some(v)) = r.try_get::<Option<Vec<u8>>, _>(idx) {
                return Some(String::from_utf8_lossy(&v).into_owned());
            }
            None
        }
        MySqlKind::BinaryLike => {
            if let Ok(Some(v)) = r.try_get::<Option<Vec<u8>>, _>(idx) {
                return Some(String::from_utf8_lossy(&v).into_owned());
            }
            if let Ok(Some(v)) = r.try_get::<Option<bool>, _>(idx) { return Some(v.to_string()); }
            None
        }
        MySqlKind::Integer => {
            if let Ok(Some(v)) = r.try_get::<Option<i64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<u64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<i32>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<u32>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<i16>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<u16>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<i8>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<u8>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<bool>, _>(idx) { return Some(v.to_string()); }
            None
        }
        MySqlKind::Float => {
            if let Ok(Some(v)) = r.try_get::<Option<f64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<f32>, _>(idx) { return Some(v.to_string()); }
            None
        }
        MySqlKind::Unknown => {
            // 未知类型：顺序尝试全部主流类型
            if let Ok(Some(v)) = r.try_get::<Option<String>, _>(idx) { return Some(v); }
            if let Ok(Some(v)) = r.try_get::<Option<Vec<u8>>, _>(idx) {
                return Some(String::from_utf8_lossy(&v).into_owned());
            }
            if let Ok(Some(v)) = r.try_get::<Option<i64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<u64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<f64>, _>(idx) { return Some(v.to_string()); }
            if let Ok(Some(v)) = r.try_get::<Option<bool>, _>(idx) { return Some(v.to_string()); }
            None
        }
    }
}

/// 从行中获取可选 i64，兼容 BigInt / Unsigned BigInt / Int / 字符串。
/// MySQL 的 INFORMATION_SCHEMA 中 TABLE_ROWS / DATA_LENGTH 等列是
/// `bigint(21) unsigned`，sqlx 原生 MySQL 驱动对 unsigned bigint
/// 使用 `u64` 类型而非 `i64` 解码，因此需要同时尝试两种类型。
fn get_opt_i64(r: &MySqlRow, idx: usize) -> Option<i64> {
    if let Ok(v) = r.try_get::<Option<i64>, _>(idx) { return v; }
    if let Ok(Some(v)) = r.try_get::<Option<u64>, _>(idx) {
        // u64 → i64 转换：数值超过 i64::MAX 时饱和到 i64::MAX
        return Some(if v > i64::MAX as u64 { i64::MAX } else { v as i64 });
    }
    if let Ok(v) = r.try_get::<Option<i32>, _>(idx) { return v.map(|x| x as i64); }
    if let Ok(Some(v)) = r.try_get::<Option<u32>, _>(idx) { return Some(v as i64); }
    if let Ok(v) = r.try_get::<Option<i16>, _>(idx) { return v.map(|x| x as i64); }
    if let Ok(Some(v)) = r.try_get::<Option<u16>, _>(idx) { return Some(v as i64); }
    // 极少数情况下驱动将 bigint 报告为 Blob（如 CAST 结果），尝试字符串解析
    if let Some(s) = get_opt_str(r, idx) {
        if let Ok(v) = s.parse::<i64>() { return Some(v); }
    }
    None
}

// ===== 类型分类辅助（与 query.rs 保持一致策略） =====

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MySqlKind { StringLike, BinaryLike, Integer, Float, Unknown }

fn classify(type_name: &str) -> MySqlKind {
    let u = type_name.to_ascii_uppercase();
    match u.as_str() {
        "VARCHAR" | "CHAR" | "TINYTEXT" | "TEXT" | "MEDIUMTEXT" | "LONGTEXT" |
        "ENUM" | "SET" | "JSON" |
        "DATE" | "DATETIME" | "TIMESTAMP" | "TIME" | "YEAR" |
        "DECIMAL" | "NUMERIC" => MySqlKind::StringLike,
        "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" |
        "BINARY" | "VARBINARY" | "BIT" | "GEOMETRY" => MySqlKind::BinaryLike,
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "INTEGER" | "BIGINT" | "BOOL" | "BOOLEAN" => MySqlKind::Integer,
        "FLOAT" | "DOUBLE" | "REAL" => MySqlKind::Float,
        _ => MySqlKind::Unknown,
    }
}

// ============================================================================
// 元数据查询函数
// ============================================================================

pub async fn list_databases(pool: &Pool) -> AppResult<Vec<String>> {
    let rows = sqlx::query("SHOW DATABASES").fetch_all(pool).await?;
    Ok(rows.iter().map(|r| get_str(r, 0)).filter(|s| !s.is_empty()).collect())
}

pub async fn get_all_databases(pool: &Pool) -> AppResult<Vec<String>> {
    let dbs = list_databases(pool).await?;
    Ok(dbs.into_iter().filter(|db| !matches!(db.to_ascii_lowercase().as_str(), "information_schema"|"mysql"|"performance_schema"|"sys")).collect())
}

pub async fn list_tables(pool: &Pool, schema: &str) -> AppResult<Vec<String>> {
    let rows = sqlx::query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME").bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| get_str(r, 0)).filter(|s| !s.is_empty()).collect())
}

pub async fn list_table_details(pool: &Pool, schema: &str) -> AppResult<Vec<TableDetail>> {
    let sql = "SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, ENGINE, DATE_FORMAT(UPDATE_TIME, '%Y-%m-%d %H:%i:%s'), TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
    let rows = sqlx::query(sql).bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| TableDetail{
        name: get_str(r, 0),
        rows: get_opt_i64(r, 1).map(|v| v as u64),
        data_length: get_opt_i64(r, 2).map(|v| v as u64),
        engine: get_opt_str(r, 3),
        update_time: get_opt_str(r, 4),
        comment: get_opt_str(r, 5),
    }).collect())
}

pub async fn list_views(pool: &Pool, schema: &str) -> AppResult<Vec<String>> {
    let rows = sqlx::query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME").bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| get_str(r, 0)).filter(|s| !s.is_empty()).collect())
}

pub async fn list_view_details(pool: &Pool, schema: &str) -> AppResult<Vec<ViewDetail>> {
    // VIEW_DEFINITION 是 longtext（Blob），必须通过 get_opt_str 读取
    let sql = "SELECT v.TABLE_NAME, v.VIEW_DEFINITION, v.CHECK_OPTION, v.IS_UPDATABLE, v.DEFINER, v.SECURITY_TYPE, DATE_FORMAT(t.CREATE_TIME,'%Y-%m-%d %H:%i:%s'), DATE_FORMAT(t.UPDATE_TIME,'%Y-%m-%d %H:%i:%s') FROM INFORMATION_SCHEMA.VIEWS v LEFT JOIN INFORMATION_SCHEMA.TABLES t ON v.TABLE_SCHEMA=t.TABLE_SCHEMA AND v.TABLE_NAME=t.TABLE_NAME WHERE v.TABLE_SCHEMA=? ORDER BY v.TABLE_NAME";
    let rows = sqlx::query(sql).bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| ViewDetail{
        name: get_str(r, 0),
        definition: get_opt_str(r, 1),
        check_option: get_opt_str(r, 2),
        is_updatable: get_opt_str(r, 3),
        definer: get_opt_str(r, 4),
        security_type: get_opt_str(r, 5),
        create_time: get_opt_str(r, 6),
        update_time: get_opt_str(r, 7),
    }).collect())
}

pub async fn list_functions(pool: &Pool, schema: &str) -> AppResult<Vec<String>> {
    let rows = sqlx::query("SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY ROUTINE_NAME").bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| get_str(r, 0)).filter(|s| !s.is_empty()).collect())
}

pub async fn list_function_details(pool: &Pool, schema: &str) -> AppResult<Vec<FunctionDetail>> {
    // DATA_TYPE / ROUTINE_DEFINITION / ROUTINE_COMMENT 均为 longtext（Blob）
    let sql = "SELECT ROUTINE_NAME,ROUTINE_TYPE,DATA_TYPE,ROUTINE_DEFINITION,IS_DETERMINISTIC,SQL_DATA_ACCESS,SECURITY_TYPE,DEFINER,DATE_FORMAT(CREATED,'%Y-%m-%d %H:%i:%s'),DATE_FORMAT(LAST_ALTERED,'%Y-%m-%d %H:%i:%s'),ROUTINE_COMMENT FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE IN('FUNCTION','PROCEDURE') ORDER BY ROUTINE_NAME";
    let rows = sqlx::query(sql).bind(schema).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| FunctionDetail{
        name: get_str(r, 0),
        routine_type: get_str(r, 1),
        data_type: get_opt_str(r, 2),
        definition: get_opt_str(r, 3),
        is_deterministic: get_opt_str(r, 4),
        sql_data_access: get_opt_str(r, 5),
        security_type: get_opt_str(r, 6),
        definer: get_opt_str(r, 7),
        create_time: get_opt_str(r, 8),
        update_time: get_opt_str(r, 9),
        comment: get_opt_str(r, 10),
    }).collect())
}

pub async fn list_routines_with_details(pool: &Pool, schema: &str) -> AppResult<Vec<RoutineDetail>> {
    use std::collections::BTreeMap;
    // DATA_TYPE / DTD_IDENTIFIER 为 longtext（Blob）
    let rrows = sqlx::query("SELECT ROUTINE_NAME,ROUTINE_TYPE,DATA_TYPE,DTD_IDENTIFIER FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY ROUTINE_NAME").bind(schema).fetch_all(pool).await?;
    let mut map: BTreeMap<String, RoutineDetail> = BTreeMap::new();
    for r in &rrows {
        let n = get_str(r, 0);
        let t = get_str(r, 1);
        let dt = get_opt_str(r, 2);
        let dtd = get_opt_str(r, 3);
        map.insert(n.clone(), RoutineDetail{
            name: n,
            routine_type: t,
            return_type: dtd.or(dt),
            params: vec![],
        });
    }
    let prows = sqlx::query("SELECT SPECIFIC_NAME,PARAMETER_NAME,DATA_TYPE,DTD_IDENTIFIER,PARAMETER_MODE FROM INFORMATION_SCHEMA.PARAMETERS WHERE SPECIFIC_SCHEMA=? AND PARAMETER_NAME IS NOT NULL ORDER BY SPECIFIC_NAME,ORDINAL_POSITION").bind(schema).fetch_all(pool).await?;
    for p in &prows {
        let rn = get_str(p, 0);
        let pn = get_opt_str(p, 1);
        if let (Some(pn), Some(r)) = (pn, map.get_mut(&rn)) {
            let d = get_opt_str(p, 2);
            let dd = get_opt_str(p, 3);
            let m = get_opt_str(p, 4);
            r.params.push(RoutineParam{
                name: pn,
                param_type: dd.or(d).unwrap_or_default(),
                mode: m,
            });
        }
    }
    Ok(map.into_values().collect())
}

pub async fn get_function_ddl(pool: &Pool, schema: &str, name: &str, rt: &str) -> AppResult<String> {
    let sql = format!("SHOW CREATE {} `{}`.`{}`", rt, schema.replace('`', "``"), name.replace('`', "``"));
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    let idx = if rt.to_ascii_uppercase() == "FUNCTION" { 1 } else { 2 };
    // SHOW CREATE 输出列为 longtext（Blob）
    Ok(rows.first().map(|r| get_str(r, idx)).unwrap_or_default())
}

pub async fn get_routine_params(pool: &Pool, schema: &str, name: &str) -> AppResult<Vec<RoutineParam>> {
    // DATA_TYPE / DTD_IDENTIFIER 为 longtext（Blob）
    let rows = sqlx::query("SELECT PARAMETER_NAME,DATA_TYPE,DTD_IDENTIFIER,PARAMETER_MODE FROM INFORMATION_SCHEMA.PARAMETERS WHERE SPECIFIC_SCHEMA=? AND SPECIFIC_NAME=? AND PARAMETER_NAME IS NOT NULL ORDER BY ORDINAL_POSITION").bind(schema).bind(name).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| {
        let dt = get_opt_str(r, 1);
        let dtd = get_opt_str(r, 2);
        RoutineParam{
            name: get_str(r, 0),
            param_type: dtd.or(dt).unwrap_or_default(),
            mode: get_opt_str(r, 3),
        }
    }).collect())
}

pub async fn list_columns(pool: &Pool, schema: &str, table: &str) -> AppResult<Vec<ColumnInfo>> {
    // DATA_TYPE / COLUMN_TYPE / COLUMN_DEFAULT / EXTRA / COLUMN_COMMENT 均为 longtext（Blob）
    // 使用 get_str / get_opt_str 兼容读取，彻底解决类型丢失问题
    let sql = "SELECT COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_KEY,EXTRA,CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,COLUMN_COMMENT,CHARACTER_SET_NAME,COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION";
    let rows = sqlx::query(sql).bind(schema).bind(table).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| ColumnInfo{
        name: get_str(r, 0),
        data_type: get_str(r, 1),
        column_type: get_str(r, 2),
        is_nullable: get_str(r, 3),
        column_default: get_opt_str(r, 4),
        column_key: get_str(r, 5),
        extra: get_str(r, 6),
        char_max_length: get_opt_i64(r, 7).map(|v| v.to_string()),
        numeric_precision: get_opt_i64(r, 8).map(|v| v.to_string()),
        numeric_scale: get_opt_i64(r, 9).map(|v| v.to_string()),
        column_comment: get_str(r, 10),
        charset: get_opt_str(r, 11),
        collation: get_opt_str(r, 12),
    }).collect())
}

pub async fn list_foreign_keys(pool: &Pool, schema: &str, table: &str) -> AppResult<Vec<ForeignKeyInfo>> {
    let rows = sqlx::query("SELECT COLUMN_NAME,REFERENCED_TABLE_SCHEMA,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME,CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL").bind(schema).bind(table).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| ForeignKeyInfo{
        column_name: get_str(r, 0),
        ref_schema: get_str(r, 1),
        ref_table: get_str(r, 2),
        ref_column: get_str(r, 3),
        constraint_name: get_str(r, 4),
    }).collect())
}

pub async fn list_indexes(pool: &Pool, schema: &str, table: &str) -> AppResult<Vec<IndexInfo>> {
    // NON_UNIQUE 为 bigint，GROUP_CONCAT 结果为 longtext（Blob）
    // 使用 get_str 统一读取，不再依赖 CAST
    let rows = sqlx::query("SELECT INDEX_NAME,NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX),INDEX_TYPE FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? GROUP BY INDEX_NAME,NON_UNIQUE,INDEX_TYPE").bind(schema).bind(table).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| IndexInfo{
        name: get_str(r, 0),
        non_unique: get_str(r, 1),
        columns: get_str(r, 2),
        index_type: get_str(r, 3),
    }).collect())
}

pub async fn list_triggers(pool: &Pool, schema: &str, table: &str) -> AppResult<Vec<TriggerInfo>> {
    // ACTION_STATEMENT 为 longblob（Blob），通过 get_str 的 Vec<u8> 分支读取
    // 不再使用 CAST —— 之前 CAST 未生效，sqlx::Any 仍将其报告为 Blob 类型
    let rows = sqlx::query("SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS WHERE EVENT_OBJECT_SCHEMA=? AND EVENT_OBJECT_TABLE=?").bind(schema).bind(table).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| TriggerInfo{
        name: get_str(r, 0),
        timing: get_str(r, 1),
        event: get_str(r, 2),
        statement: get_str(r, 3),
    }).collect())
}

pub async fn list_checks(pool: &Pool, schema: &str, table: &str) -> AppResult<Vec<CheckInfo>> {
    // CHECK_CLAUSE 为 longtext（Blob）
    let rows = sqlx::query("SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE,tc.ENFORCED FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=? AND tc.TABLE_NAME=? AND tc.CONSTRAINT_TYPE='CHECK'").bind(schema).bind(table).fetch_all(pool).await?;
    Ok(rows.iter().map(|r| CheckInfo{
        name: get_str(r, 0),
        clause: get_str(r, 1),
        enforced: get_str(r, 2),
    }).collect())
}

pub async fn load_ddl(pool: &Pool, schema: &str, table: &str) -> AppResult<String> {
    let sql = format!("SHOW CREATE TABLE `{}`.`{}`", schema.replace('`', "``"), table.replace('`', "``"));
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    // SHOW CREATE TABLE 的第二列为 longtext（Blob）
    Ok(rows.first().map(|r| get_str(r, 1)).unwrap_or_default())
}

pub async fn get_current_user_info(pool: &Pool) -> AppResult<String> {
    let mut info = String::new();
    if let Ok(r) = sqlx::query("SELECT CURRENT_USER()").fetch_one(pool).await {
        info.push_str("Current user: ");
        info.push_str(&get_str(&r, 0));
        info.push('\n');
    }
    if let Ok(r) = sqlx::query("SELECT CONNECTION_ID()").fetch_one(pool).await {
        info.push_str("Connection ID: ");
        info.push_str(&get_str(&r, 0));
        info.push('\n');
    }
    if let Ok(r) = sqlx::query("SELECT DATABASE()").fetch_one(pool).await {
        info.push_str("Current database: ");
        info.push_str(&get_opt_str(&r, 0).unwrap_or_default());
        info.push('\n');
    }
    if let Ok(r) = sqlx::query("SELECT VERSION()").fetch_one(pool).await {
        info.push_str("MySQL version: ");
        info.push_str(&get_str(&r, 0));
        info.push('\n');
    }
    if let Ok(grants) = sqlx::query("SHOW GRANTS FOR CURRENT_USER()").fetch_all(pool).await {
        if !grants.is_empty() {
            info.push_str("\nUser grants:\n");
            for g in &grants {
                // SHOW GRANTS 的列为 longtext（Blob）
                info.push_str(&get_str(g, 0));
                info.push('\n');
            }
        }
    }
    Ok(info)
}

pub async fn get_connection_properties(pool: &Pool, database: Option<&str>) -> AppResult<ConnectionProperties> {
    let mut p = ConnectionProperties{
        connection_status: true,
        server_version: None,
        current_database: None,
        connection_charset: None,
        wait_timeout_seconds: None,
        ssl_mode: None,
        table_count: None,
        view_count: None,
        function_count: None,
        procedure_count: None,
    };
    if let Ok(r) = sqlx::query("SELECT VERSION()").fetch_one(pool).await {
        p.server_version = get_opt_str(&r, 0);
    }
    if let Ok(r) = sqlx::query("SELECT DATABASE()").fetch_one(pool).await {
        p.current_database = get_opt_str(&r, 0);
    }
    if let Ok(r) = sqlx::query("SELECT @@character_set_connection").fetch_one(pool).await {
        p.connection_charset = get_opt_str(&r, 0);
    }
    if let Ok(r) = sqlx::query("SELECT @@wait_timeout").fetch_one(pool).await {
        p.wait_timeout_seconds = get_opt_i64(&r, 0).map(|v| v as u64);
    }
    if let Ok(r) = sqlx::query("SHOW SESSION STATUS LIKE 'Ssl_cipher'").fetch_one(pool).await {
        p.ssl_mode = get_opt_str(&r, 1);
    }
    let s = database.unwrap_or_else(|| p.current_database.as_deref().unwrap_or(""));
    if !s.is_empty() {
        if let Ok(r) = sqlx::query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'").bind(s).fetch_one(pool).await {
            p.table_count = get_opt_i64(&r, 0).map(|v| v as u64);
        }
        if let Ok(r) = sqlx::query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='VIEW'").bind(s).fetch_one(pool).await {
            p.view_count = get_opt_i64(&r, 0).map(|v| v as u64);
        }
        if let Ok(r) = sqlx::query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='FUNCTION'").bind(s).fetch_one(pool).await {
            p.function_count = get_opt_i64(&r, 0).map(|v| v as u64);
        }
        if let Ok(r) = sqlx::query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='PROCEDURE'").bind(s).fetch_one(pool).await {
            p.procedure_count = get_opt_i64(&r, 0).map(|v| v as u64);
        }
    }
    Ok(p)
}
