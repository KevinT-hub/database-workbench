use sqlx::Row;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle, DbPool};
use crate::errors::{AppResult, AppError};
use crate::models::connection::{ConnectionProfile, ConnectionProperties, DbType, PoolConfig};
use crate::models::query::*;
use crate::models::metadata::*;
use crate::models::user::*;
use crate::models::backup::BackupOptions;
use crate::core::database::mysql::connection;
use crate::core::database::mysql::query as mysql_query;
use crate::core::database::mysql::metadata as mysql_meta;
use crate::core::database::mysql::user as mysql_user;
use crate::core::database::mysql::special as mysql_special;
use async_trait::async_trait;

pub struct MysqlAdapter;

/// 从 DbConnectionHandle 中提取 MySqlPool 引用。
/// MysqlAdapter 的所有方法都通过此函数获取原生 MySQL 连接池，
/// 彻底绕过 sqlx::Any 驱动的类型映射限制。
fn pool(h: &DbConnectionHandle) -> AppResult<&sqlx::mysql::MySqlPool> {
    h.pool.as_mysql().ok_or_else(|| AppError::Internal("Expected MySQL connection pool".into()))
}

/// 从 MySqlRow 读取字符串，兼容 String / Vec<u8>。
/// 原生 MySQL 驱动支持所有列类型的 String 解码（varchar/text/longtext 等），
/// 但 longblob/varbinary 等二进制类型需通过 Vec<u8> 中转。
fn read_str(row: &sqlx::mysql::MySqlRow, idx: usize) -> String {
    if let Ok(s) = row.try_get::<String, _>(idx) { return s; }
    if let Ok(b) = row.try_get::<Vec<u8>, _>(idx) {
        return String::from_utf8_lossy(&b).into_owned();
    }
    String::new()
}

#[async_trait]
impl DatabaseAdapter for MysqlAdapter {
    fn db_type(&self) -> DbType { DbType::Mysql }

    async fn create_pool(&self, profile: &ConnectionProfile) -> AppResult<DbConnectionHandle> {
        let config = PoolConfig::from_profile(profile);
        let url = connection::build_mysql_url(&config);
        // 使用原生 MySqlPool 而非 AnyPool，避免 Any 驱动的类型映射限制
        let pool = sqlx::mysql::MySqlPool::connect(&url).await?;

        // 初始化 SQL 包含 USE/SET NAMES 等命令，不支持 prepared statement 协议，
        // 必须用 raw_sql 走简单查询协议，否则会触发 MySQL 错误 1295
        let init_sqls = connection::build_session_init_sql(&config);
        for sql in &init_sqls {
            sqlx::raw_sql(sql).execute(&pool).await?;
        }

        Ok(DbConnectionHandle {
            db_type: DbType::Mysql,
            pool: DbPool::MySql(pool),
            profile: profile.clone(),
            created_at: chrono::Utc::now(),
        })
    }

    async fn test_connection(&self, profile: &ConnectionProfile) -> AppResult<bool> {
        let config = PoolConfig::from_profile(profile);
        let url = connection::build_mysql_url(&config);
        let pool = sqlx::mysql::MySqlPool::connect(&url).await?;
        sqlx::query("SELECT 1").execute(&pool).await?;
        pool.close().await;
        Ok(true)
    }

    // ===== Metadata =====
    async fn list_databases(&self, h: &DbConnectionHandle) -> AppResult<Vec<String>> { mysql_meta::list_databases(pool(h)?).await }
    async fn get_all_databases(&self, h: &DbConnectionHandle) -> AppResult<Vec<String>> { mysql_meta::get_all_databases(pool(h)?).await }
    async fn list_tables(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<String>> { mysql_meta::list_tables(pool(h)?, s).await }
    async fn list_table_details(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<TableDetail>> { mysql_meta::list_table_details(pool(h)?, s).await }
    async fn list_views(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<String>> { mysql_meta::list_views(pool(h)?, s).await }
    async fn list_view_details(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<ViewDetail>> { mysql_meta::list_view_details(pool(h)?, s).await }
    async fn list_functions(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<String>> { mysql_meta::list_functions(pool(h)?, s).await }
    async fn list_function_details(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<FunctionDetail>> { mysql_meta::list_function_details(pool(h)?, s).await }
    async fn list_routines_with_details(&self, h: &DbConnectionHandle, s: &str) -> AppResult<Vec<RoutineDetail>> { mysql_meta::list_routines_with_details(pool(h)?, s).await }
    async fn get_function_ddl(&self, h: &DbConnectionHandle, s: &str, n: &str, t: &str) -> AppResult<String> { mysql_meta::get_function_ddl(pool(h)?, s, n, t).await }
    async fn get_routine_params(&self, h: &DbConnectionHandle, s: &str, n: &str) -> AppResult<Vec<RoutineParam>> { mysql_meta::get_routine_params(pool(h)?, s, n).await }
    async fn list_columns(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<Vec<ColumnInfo>> { mysql_meta::list_columns(pool(h)?, s, t).await }
    async fn list_foreign_keys(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<Vec<ForeignKeyInfo>> { mysql_meta::list_foreign_keys(pool(h)?, s, t).await }
    async fn list_indexes(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<Vec<IndexInfo>> { mysql_meta::list_indexes(pool(h)?, s, t).await }
    async fn list_triggers(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<Vec<TriggerInfo>> { mysql_meta::list_triggers(pool(h)?, s, t).await }
    async fn list_checks(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<Vec<CheckInfo>> { mysql_meta::list_checks(pool(h)?, s, t).await }
    async fn load_ddl(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<String> { mysql_meta::load_ddl(pool(h)?, s, t).await }
    async fn get_current_user_info(&self, h: &DbConnectionHandle) -> AppResult<String> { mysql_meta::get_current_user_info(pool(h)?).await }
    async fn get_connection_properties(&self, h: &DbConnectionHandle, d: Option<&str>) -> AppResult<ConnectionProperties> { mysql_meta::get_connection_properties(pool(h)?, d).await }

    // ===== User =====
    async fn get_all_users(&self, h: &DbConnectionHandle) -> AppResult<Vec<UserSummary>> { mysql_user::get_all_users(pool(h)?).await }
    async fn get_user_detail(&self, h: &DbConnectionHandle, u: &str, host: &str) -> AppResult<String> { mysql_user::get_user_detail(pool(h)?, u, host).await }
    async fn get_user_model(&self, h: &DbConnectionHandle, u: &str, host: &str) -> AppResult<UserModelPayload> { mysql_user::get_user_model(pool(h)?, u, host).await }
    fn generate_user_sql(&self, c: &UserModel, i: bool, o: Option<&UserModel>) -> String { mysql_user::generate_user_sql_static(c, i, o) }
    async fn execute_user_sql(&self, h: &DbConnectionHandle, s: &str, d: Option<&str>) -> AppResult<()> { mysql_user::execute_sql(pool(h)?, s, d).await }

    // ===== Query =====
    async fn query(&self, h: &DbConnectionHandle, s: &str) -> AppResult<QueryResult> { mysql_query::execute_query(pool(h)?, s).await }
    async fn query_prepared(&self, h: &DbConnectionHandle, s: &str, p: &[SqlParam]) -> AppResult<QueryResult> { mysql_query::execute_query_prepared(pool(h)?, s, p).await }
    async fn query_page(&self, h: &DbConnectionHandle, s: &str, p: Option<u64>, ps: Option<u64>, i: Option<bool>) -> AppResult<QueryPageResult> { mysql_query::execute_query_page(pool(h)?, s, p, ps, i).await }
    async fn query_multi(&self, h: &DbConnectionHandle, s: &str, d: Option<&str>) -> AppResult<MultiQueryResult> { mysql_query::execute_query_multi(pool(h)?, s, d).await }
    async fn query_prepared_multi(&self, h: &DbConnectionHandle, s: &str, p: &[SqlParam]) -> AppResult<MultiQueryResult> { mysql_query::execute_query_multi_prepared(pool(h)?, s, p).await }
    async fn execute(&self, h: &DbConnectionHandle, s: &str) -> AppResult<ExecResult> { mysql_query::execute_update(pool(h)?, s).await }
    async fn execute_prepared(&self, h: &DbConnectionHandle, s: &str, p: &[SqlParam]) -> AppResult<ExecResult> { mysql_query::execute_update_prepared(pool(h)?, s, p).await }
    async fn execute_special(&self, h: &DbConnectionHandle, s: &str) -> AppResult<SpecialResult> { mysql_special::execute_special(pool(h)?, s).await }
    async fn execute_script(&self, h: &DbConnectionHandle, s: &str, d: Option<&str>, stop: bool) -> AppResult<ScriptExecuteResult> { crate::core::database::mysql::script::execute_script(pool(h)?, s, d, stop).await }

    async fn use_database(&self, h: &DbConnectionHandle, db: &str) -> AppResult<()> {
        let escaped = self.quote_identifier(db);
        // USE 语句不支持 prepared statement 协议（MySQL 错误 1295），需用 raw_sql
        sqlx::raw_sql(&format!("USE {}", escaped)).execute(pool(h)?).await?;
        Ok(())
    }

    async fn set_session_charset(&self, h: &DbConnectionHandle, cs: &str, cl: Option<&str>) -> AppResult<()> {
        let sql = if let Some(c) = cl { format!("SET NAMES {} COLLATE {}", cs, c) } else { format!("SET NAMES {}", cs) };
        // SET NAMES 不支持 prepared statement 协议，需用 raw_sql
        sqlx::raw_sql(&sql).execute(pool(h)?).await?;
        Ok(())
    }

    fn dump_header_sql(&self, _o: &BackupOptions, profile: &ConnectionProfile, schema: &str) -> String {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let name = profile.name.as_deref().unwrap_or("");
        format!(
            "/*\n\
             Database Workbench Export Bundle\n\
             Bundle Version: 1\n\
             Generated At: {ts}\n\
             \n\
             Source:\n\
             \x20  Name: {name}\n\
             \x20  Type: MySQL\n\
             \x20  Version: MySQL\n\
             \x20  Host: {host}:{port}\n\
             \x20  Schema: {schema}\n\
             \n\
             Target:\n\
             \x20  Type: MySQL\n\
             \x20  Version: MySQL\n\
             \x20  Encoding: UTF-8\n\
             \n\
             Notes:\n\
             \x20  - Exported by native SQL engine\n\
             \x20  - Optimized for direct replay\n\
             */\n\
             \n\
             SET NAMES utf8mb4;\n\
             SET @DWB_OLD_SQL_NOTES = @@SQL_NOTES;\n\
             SET SQL_NOTES = 0;\n\
             SET @DWB_OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;\n\
             SET FOREIGN_KEY_CHECKS = 0;\n\
             SET @DWB_OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS;\n\
             SET UNIQUE_CHECKS = 0;\n",
            ts = now, name = name, host = profile.host, port = profile.port, schema = schema,
        )
    }
    fn dump_footer_sql(&self) -> String {
        "\nSET UNIQUE_CHECKS = IFNULL(@DWB_OLD_UNIQUE_CHECKS, 1);\nSET FOREIGN_KEY_CHECKS = IFNULL(@DWB_OLD_FOREIGN_KEY_CHECKS, 1);\nSET SQL_NOTES = IFNULL(@DWB_OLD_SQL_NOTES, 1);\n".into()
    }
    fn create_database_sql(&self, s: &str, cs: Option<&str>, cl: Option<&str>) -> String {
        let i = self.quote_identifier(s);
        match (cs, cl) {
            (Some(c), Some(l)) => format!("CREATE DATABASE IF NOT EXISTS {} CHARACTER SET {} COLLATE {};\nUSE {};", i, c, l, i),
            (Some(c), None) => format!("CREATE DATABASE IF NOT EXISTS {} CHARACTER SET {};\nUSE {};", i, c, i),
            _ => format!("CREATE DATABASE IF NOT EXISTS {};\nUSE {};", i, i),
        }
    }

    fn reformat_table_ddl_for_dump(&self, ddl: &str) -> String {
        // SHOW CREATE TABLE 输出形如：
        //   CREATE TABLE `car` ( ... ) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='车辆信息表'
        // 只重格式化表选项行（右括号之后的部分），列定义保持不变。
        // 找到最后一个 ')' 的位置
        let close_paren = match ddl.rfind(')') {
            Some(idx) => idx,
            None => return ddl.to_string(),
        };
        let (cols, mut opts) = ddl.split_at(close_paren + 1);
        opts = opts.trim_start();
        // 按空格拆分表选项，但要注意 COMMENT='...' 中可能含空格
        // 简单方案：逐个替换已知 key= 为 key = 
        let opts = opts
            .replace("ENGINE=", "ENGINE = ")
            .replace("AUTO_INCREMENT=", "AUTO_INCREMENT = ")
            .replace("DEFAULT CHARSET=", "CHARACTER SET = ")
            .replace("COLLATE=", "COLLATE = ")
            .replace("ROW_FORMAT=DYNAMIC", "ROW_FORMAT = Dynamic")
            .replace("ROW_FORMAT=COMPACT", "ROW_FORMAT = Compact")
            .replace("ROW_FORMAT=COMPRESSED", "ROW_FORMAT = Compressed")
            .replace("ROW_FORMAT=FIXED", "ROW_FORMAT = Fixed")
            .replace("ROW_FORMAT=REDUNDANT", "ROW_FORMAT = Redundant")
            .replace("COMMENT=", "COMMENT = ");
        format!("{} {};", cols.trim_end(), opts)
    }

    fn reformat_view_ddl_for_dump(&self, ddl: &str, schema: &str) -> String {
        // 1. 去掉 schema 前缀：`schema`.`view` → `view`，`schema`.`table` → `table`
        let schema_prefix = format!("`{}`.", schema);
        let stripped = ddl.replace(&schema_prefix, "");
        // 2. 提取视图名（`VIEW `name`` 或 `VIEW `schema`.`name`` → 已去 schema 后为 `VIEW `name``）
        let view_name = extract_view_name(&stripped);
        let mut result = String::new();
        if !view_name.is_empty() {
            result.push_str(&format!("DROP VIEW IF EXISTS `{}`;\n", view_name));
        }
        // 3. 重格式化 AS select ... from ... join → AS\nSELECT ...\nFROM ...\nJOIN ...
        let reformatted = reformat_view_body(&stripped);
        result.push_str(&reformatted);
        result.push_str(";\n");
        result
    }

    fn format_value_for_dump(&self, value: &serde_json::Value, column_type: &str) -> String {
        if value.is_null() { return "NULL".into(); }
        let ct = column_type.to_ascii_uppercase();
        if is_mysql_numeric_type(&ct) {
            return crate::core::import_export::value_to_string(value);
        }
        if ct == "JSON" {
            let s = crate::core::import_export::value_to_string(value);
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                return self.quote_string_literal(&json_with_spaces(&v));
            }
        }
        self.quote_string_literal(&crate::core::import_export::value_to_string(value))
    }
    async fn show_create_table(&self, h: &DbConnectionHandle, s: &str, t: &str) -> AppResult<String> {
        let sql = format!("SHOW CREATE TABLE `{}`.`{}`", s.replace('`', "``"), t.replace('`', "``"));
        // SHOW CREATE TABLE 在 MySQL 中支持 prepared statement，直接用 query
        let row = sqlx::query(&sql).fetch_one(pool(h)?).await?;
        Ok(read_str(&row, 1))
    }
    async fn show_create_view(&self, h: &DbConnectionHandle, s: &str, v: &str) -> AppResult<String> {
        let sql = format!("SHOW CREATE VIEW `{}`.`{}`", s.replace('`', "``"), v.replace('`', "``"));
        let row = sqlx::query(&sql).fetch_one(pool(h)?).await?;
        Ok(read_str(&row, 1))
    }
    async fn show_create_routine(&self, h: &DbConnectionHandle, s: &str, n: &str, rt: &str) -> AppResult<String> {
        let sql = format!("SHOW CREATE {} `{}`.`{}`", rt, s.replace('`', "``"), n.replace('`', "``"));
        let row = sqlx::query(&sql).fetch_one(pool(h)?).await?;
        let idx = if rt.to_ascii_uppercase() == "FUNCTION" { 1 } else { 2 };
        Ok(read_str(&row, idx))
    }
    async fn show_create_trigger(&self, h: &DbConnectionHandle, s: &str, tr: &str) -> AppResult<String> {
        let sql = format!("SHOW CREATE TRIGGER `{}`.`{}`", s.replace('`', "``"), tr.replace('`', "``"));
        let row = sqlx::query(&sql).fetch_one(pool(h)?).await?;
        Ok(read_str(&row, 2))
    }
    fn build_paged_sql(&self, sql: &str, offset: u64, limit: u64) -> String { format!("{} LIMIT {} OFFSET {}", sql, limit, offset) }
    fn generate_create_table_sql(&self, design: &TableDesign) -> String { crate::core::database::mysql::designer::generate_create_table_sql(design) }
    fn generate_alter_table_sql(&self, original: &TableDesign, modified: &TableDesign) -> String { crate::core::database::mysql::designer::generate_alter_table_sql(original, modified) }
    fn quote_identifier(&self, n: &str) -> String { format!("`{}`", n.replace('`', "``")) }
    fn quote_string_literal(&self, v: &str) -> String { format!("'{}'", v.replace('\\', "\\\\").replace('\'', "\\'")) }
    fn is_system_database(&self, database: &str) -> bool {
        matches!(database.to_ascii_lowercase().as_str(), "information_schema" | "performance_schema" | "mysql" | "sys")
    }
}

// ===== DWB 导出格式辅助函数 =====

/// 判断 MySQL 列类型是否为数值类型（INT/TINYINT/DECIMAL/FLOAT/DOUBLE/BIT...，含 UNSIGNED/ZEROFILL 后缀）
fn is_mysql_numeric_type(ct: &str) -> bool {
    // 去掉空格后按前缀匹配
    let ct = ct.replace(' ', "");
    let prefixes = [
        "INT", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT",
        "DECIMAL", "FLOAT", "DOUBLE", "BIT", "NUMERIC",
        "BOOL", "BOOLEAN",
    ];
    prefixes.iter().any(|p| ct.starts_with(p))
}

/// 从 SHOW CREATE VIEW 的 DDL 中提取视图名
/// 输入形如：CREATE ... VIEW `car_info` AS select ...
fn extract_view_name(ddl: &str) -> String {
    // 找到 VIEW 关键字（大小写不敏感），然后找下一个反引号包裹的标识符
    let lower = ddl.to_ascii_lowercase();
    let view_pos = match lower.find("view ") {
        Some(p) => p + 5,
        None => return String::new(),
    };
    let rest = &ddl[view_pos..];
    // 跳过可能的 schema. 前缀，找反引号
    if let Some(start) = rest.find('`') {
        let after_first = &rest[start + 1..];
        if let Some(end) = after_first.find('`') {
            return after_first[..end].to_string();
        }
    }
    String::new()
}

/// 重格式化视图体：AS select → AS\nSELECT，from → \nFROM，join → \nJOIN（大小写不敏感）
fn reformat_view_body(ddl: &str) -> String {
    let lower = ddl.to_ascii_lowercase();
    // 找到 " as " 的位置，将后面的 select 换行大写
    let as_pos = match lower.find(" as ") {
        Some(p) => p,
        None => return ddl.to_string(),
    };
    let before_as = &ddl[..as_pos];
    let after_as = &ddl[as_pos + 4..];
    // 将 after_as 中的 select/from/join/on/where/group/order 等关键字换行大写
    let body = keyword_newlines(after_as);
    format!("{} AS\n{}", before_as, body)
}

/// 在 SQL 关键字前插入换行并大写（用于视图体美化）
fn keyword_newlines(sql: &str) -> String {
    let keywords = ["from", "join", "where", "group by", "order by", "having", "limit", "union"];
    let mut result = sql.to_string();
    // 先把开头的 select 大写
    let lower = result.to_ascii_lowercase();
    if lower.starts_with("select") {
        result = format!("SELECT{}", &result[6..]);
    }
    for kw in &keywords {
        let lower_result = result.to_ascii_lowercase();
        let mut offset = 0usize;
        while let Some(pos) = lower_result[offset..].find(kw) {
            let abs_pos = offset + pos;
            // 确保不是子串匹配（前面是空格或行首）
            let before_ok = abs_pos == 0
                || result.as_bytes().get(abs_pos - 1) == Some(&b' ')
                || result.as_bytes().get(abs_pos - 1) == Some(&b'\n')
                || result.as_bytes().get(abs_pos - 1) == Some(&b'\t');
            if before_ok {
                // 检查后面是否是空格（避免匹配 "from_xxx"）
                let after_pos = abs_pos + kw.len();
                let after_ok = after_pos >= result.len()
                    || result.as_bytes().get(after_pos) == Some(&b' ')
                    || result.as_bytes().get(after_pos) == Some(&b'\n')
                    || result.as_bytes().get(after_pos) == Some(&b'(');
                if after_ok {
                    // 替换为 \n + 大写关键字
                    let upper_kw = kw.to_uppercase();
                    result = format!("{}\n{}{}", &result[..abs_pos], upper_kw, &result[after_pos..]);
                    offset = abs_pos + 1 + upper_kw.len();
                    continue;
                }
            }
            offset = abs_pos + kw.len();
        }
    }
    result
}

/// 将 serde_json::Value 序列化为带空格分隔符的紧凑 JSON（", " 和 ": "）
/// 不使用 to_string_pretty（后者有换行），而是手动递归构建。
fn json_with_spaces(v: &serde_json::Value) -> String {
    use serde_json::Value;
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s)),
        Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(json_with_spaces).collect();
            format!("[{}]", items.join(", "))
        }
        Value::Object(obj) => {
            let items: Vec<String> = obj.iter().map(|(k, val)| {
                format!("{}: {}", serde_json::to_string(k).unwrap_or_else(|_| format!("\"{}\"", k)), json_with_spaces(val))
            }).collect();
            format!("{{{}}}", items.join(", "))
        }
    }
}
