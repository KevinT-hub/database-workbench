use async_trait::async_trait;
use crate::errors::AppResult;
use crate::models::connection::{ConnectionProfile, ConnectionProperties, DbType};
use crate::models::query::{QueryResult, QueryPageResult, MultiQueryResult, ExecResult, SpecialResult, SqlParam, ScriptExecuteResult};
use crate::models::metadata::{TableDetail, ViewDetail, FunctionDetail, RoutineDetail, RoutineParam, ColumnInfo, ForeignKeyInfo, IndexInfo, TriggerInfo, CheckInfo, TableDesign};
use crate::models::user::{UserSummary, UserModelPayload, UserModel};
use crate::models::backup::BackupOptions;

/// 数据库连接池的强类型枚举。
///
/// 之前使用 `sqlx::AnyPool` 统一抽象，但 sqlx::Any 驱动不支持 MySQL 的全部
/// 列类型（如 Binary、某些 Blob 子类型），导致 `fetch_all` 阶段直接报错
/// "Any driver does not support Mysql type ..."。
///
/// 改用各数据库的原生连接池类型，彻底绕过 Any 驱动的类型映射限制。
/// 原生驱动（如 `sqlx::mysql::MySqlPool`）支持对应数据库的全部列类型。
pub enum DbPool {
    MySql(sqlx::mysql::MySqlPool),
    // 未来扩展：
    // Postgres(sqlx::postgres::PgPool),
    // Sqlite(sqlx::sqlite::SqlitePool),
}

impl DbPool {
    /// 返回 MySQL 连接池引用，若非 MySQL 则返回 None。
    pub fn as_mysql(&self) -> Option<&sqlx::mysql::MySqlPool> {
        match self {
            DbPool::MySql(p) => Some(p),
        }
    }
}

#[async_trait]
pub trait DatabaseAdapter: Send + Sync {
    fn db_type(&self) -> DbType;

    async fn create_pool(&self, profile: &ConnectionProfile) -> AppResult<DbConnectionHandle>;
    async fn test_connection(&self, profile: &ConnectionProfile) -> AppResult<bool>;

    async fn list_databases(&self, handle: &DbConnectionHandle) -> AppResult<Vec<String>>;
    async fn get_all_databases(&self, handle: &DbConnectionHandle) -> AppResult<Vec<String>>;
    async fn list_tables(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<String>>;
    async fn list_table_details(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<TableDetail>>;
    async fn list_views(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<String>>;
    async fn list_view_details(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<ViewDetail>>;
    async fn list_functions(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<String>>;
    async fn list_function_details(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<FunctionDetail>>;
    async fn list_routines_with_details(&self, handle: &DbConnectionHandle, schema: &str) -> AppResult<Vec<RoutineDetail>>;
    async fn get_function_ddl(&self, handle: &DbConnectionHandle, schema: &str, name: &str, routine_type: &str) -> AppResult<String>;
    async fn get_routine_params(&self, handle: &DbConnectionHandle, schema: &str, name: &str) -> AppResult<Vec<RoutineParam>>;
    async fn list_columns(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<Vec<ColumnInfo>>;
    async fn list_foreign_keys(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<Vec<ForeignKeyInfo>>;
    async fn list_indexes(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<Vec<IndexInfo>>;
    async fn list_triggers(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<Vec<TriggerInfo>>;
    async fn list_checks(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<Vec<CheckInfo>>;
    async fn load_ddl(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<String>;
    async fn get_current_user_info(&self, handle: &DbConnectionHandle) -> AppResult<String>;
    async fn get_connection_properties(&self, handle: &DbConnectionHandle, database: Option<&str>) -> AppResult<ConnectionProperties>;

    async fn get_all_users(&self, handle: &DbConnectionHandle) -> AppResult<Vec<UserSummary>>;
    async fn get_user_detail(&self, handle: &DbConnectionHandle, username: &str, host: &str) -> AppResult<String>;
    async fn get_user_model(&self, handle: &DbConnectionHandle, username: &str, host: &str) -> AppResult<UserModelPayload>;
    fn generate_user_sql(&self, current: &UserModel, is_new: bool, original: Option<&UserModel>) -> String;
    async fn execute_user_sql(&self, handle: &DbConnectionHandle, sql: &str, database: Option<&str>) -> AppResult<()>;

    async fn query(&self, handle: &DbConnectionHandle, sql: &str) -> AppResult<QueryResult>;
    async fn query_prepared(&self, handle: &DbConnectionHandle, sql: &str, params: &[SqlParam]) -> AppResult<QueryResult>;
    async fn query_page(&self, handle: &DbConnectionHandle, sql: &str, page: Option<u64>, page_size: Option<u64>, include_total: Option<bool>) -> AppResult<QueryPageResult>;
    async fn query_multi(&self, handle: &DbConnectionHandle, sql: &str, database: Option<&str>) -> AppResult<MultiQueryResult>;
    async fn query_prepared_multi(&self, handle: &DbConnectionHandle, sql: &str, params: &[SqlParam]) -> AppResult<MultiQueryResult>;
    async fn execute(&self, handle: &DbConnectionHandle, sql: &str) -> AppResult<ExecResult>;
    async fn execute_prepared(&self, handle: &DbConnectionHandle, sql: &str, params: &[SqlParam]) -> AppResult<ExecResult>;

    async fn execute_special(&self, handle: &DbConnectionHandle, sql: &str) -> AppResult<SpecialResult>;

    /// 在专用事务连接上一次性执行完整 SQL 脚本，返回每条语句的执行结果。
    ///
    /// 用于新建查询的多语句脚本执行场景：保证所有语句在同一物理连接上执行
    /// （修复连接池模式下 `USE` 不生效导致的 1046 no database selected），
    /// 并使用 DELIMITER 感知切分器正确处理 CREATE PROCEDURE/FUNCTION/TRIGGER
    /// 的 BEGIN...END 复合块。
    async fn execute_script(
        &self,
        handle: &DbConnectionHandle,
        sql: &str,
        database: Option<&str>,
        stop_on_error: bool,
    ) -> AppResult<ScriptExecuteResult>;

    async fn use_database(&self, handle: &DbConnectionHandle, database: &str) -> AppResult<()>;
    async fn set_session_charset(&self, handle: &DbConnectionHandle, charset: &str, collation: Option<&str>) -> AppResult<()>;

    fn dump_header_sql(&self, options: &BackupOptions, profile: &ConnectionProfile, schema: &str) -> String;
    fn dump_footer_sql(&self) -> String;
    fn create_database_sql(&self, schema: &str, charset: Option<&str>, collation: Option<&str>) -> String;

    /// 将 SHOW CREATE TABLE 的原始 DDL 重格式化为 DWB 导出风格
    /// （表选项行：ENGINE = X CHARACTER SET = Y COLLATE = Z ROW_FORMAT = W AUTO_INCREMENT = N COMMENT = '...'）
    fn reformat_table_ddl_for_dump(&self, ddl: &str) -> String { ddl.to_string() }

    /// 将 SHOW CREATE VIEW 的原始 DDL 重格式化为 DWB 导出风格
    /// （去 schema 前缀、加 DROP VIEW IF EXISTS、SELECT/FROM/JOIN 换行大写）
    fn reformat_view_ddl_for_dump(&self, ddl: &str, _schema: &str) -> String { ddl.to_string() }

    /// 按列类型格式化 INSERT 值：数值类型裸写、JSON 带空格、其余单引号包裹
    fn format_value_for_dump(&self, value: &serde_json::Value, column_type: &str) -> String {
        if value.is_null() { return "NULL".into(); }
        let _ = column_type;
        self.quote_string_literal(&crate::core::import_export::value_to_string(value))
    }
    async fn show_create_table(&self, handle: &DbConnectionHandle, schema: &str, table: &str) -> AppResult<String>;
    async fn show_create_view(&self, handle: &DbConnectionHandle, schema: &str, view: &str) -> AppResult<String>;
    async fn show_create_routine(&self, handle: &DbConnectionHandle, schema: &str, name: &str, routine_type: &str) -> AppResult<String>;
    async fn show_create_trigger(&self, handle: &DbConnectionHandle, schema: &str, trigger: &str) -> AppResult<String>;
    fn build_paged_sql(&self, sql: &str, offset: u64, limit: u64) -> String;

    fn generate_create_table_sql(&self, design: &TableDesign) -> String;
    fn generate_alter_table_sql(&self, original: &TableDesign, modified: &TableDesign) -> String;

    fn quote_identifier(&self, name: &str) -> String;
    fn quote_string_literal(&self, value: &str) -> String;

    /// 判断给定数据库名是否为该 DBMS 的系统库（不应在备份/导出时包含）。
    /// MySQL: information_schema / performance_schema / mysql / sys
    /// PostgreSQL: postgres / template0 / template1
    /// SQLite: 无系统库概念（返回 false）
    fn is_system_database(&self, database: &str) -> bool;
}

pub struct DbConnectionHandle {
    pub db_type: DbType,
    pub pool: DbPool,
    pub profile: ConnectionProfile,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
