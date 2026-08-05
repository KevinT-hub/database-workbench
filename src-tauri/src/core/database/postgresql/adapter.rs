use async_trait::async_trait;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::{AppResult, AppError};
use crate::models::connection::{ConnectionProfile, ConnectionProperties, DbType};
use crate::models::query::*;
use crate::models::metadata::*;
use crate::models::user::*;
use crate::models::backup::BackupOptions;

pub struct PgAdapter;

macro_rules! unimplemented_pg {
    () => { Err(AppError::UnsupportedFeature("PostgreSQL adapter not yet implemented".into())) };
}

#[async_trait]
impl DatabaseAdapter for PgAdapter {
    fn db_type(&self) -> DbType { DbType::PostgreSql }
    async fn create_pool(&self, _p: &ConnectionProfile) -> AppResult<DbConnectionHandle> { unimplemented_pg!() }
    async fn test_connection(&self, _p: &ConnectionProfile) -> AppResult<bool> { unimplemented_pg!() }
    async fn list_databases(&self, _h: &DbConnectionHandle) -> AppResult<Vec<String>> { unimplemented_pg!() }
    async fn get_all_databases(&self, _h: &DbConnectionHandle) -> AppResult<Vec<String>> { unimplemented_pg!() }
    async fn list_tables(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<String>> { unimplemented_pg!() }
    async fn list_table_details(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<TableDetail>> { unimplemented_pg!() }
    async fn list_views(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<String>> { unimplemented_pg!() }
    async fn list_view_details(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<ViewDetail>> { unimplemented_pg!() }
    async fn list_functions(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<String>> { unimplemented_pg!() }
    async fn list_function_details(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<FunctionDetail>> { unimplemented_pg!() }
    async fn list_routines_with_details(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<Vec<RoutineDetail>> { unimplemented_pg!() }
    async fn get_function_ddl(&self, _h: &DbConnectionHandle, _s: &str, _n: &str, _t: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn get_routine_params(&self, _h: &DbConnectionHandle, _s: &str, _n: &str) -> AppResult<Vec<RoutineParam>> { unimplemented_pg!() }
    async fn list_columns(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<Vec<ColumnInfo>> { unimplemented_pg!() }
    async fn list_foreign_keys(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<Vec<ForeignKeyInfo>> { unimplemented_pg!() }
    async fn list_indexes(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<Vec<IndexInfo>> { unimplemented_pg!() }
    async fn list_triggers(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<Vec<TriggerInfo>> { unimplemented_pg!() }
    async fn list_checks(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<Vec<CheckInfo>> { unimplemented_pg!() }
    async fn load_ddl(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn get_current_user_info(&self, _h: &DbConnectionHandle) -> AppResult<String> { unimplemented_pg!() }
    async fn get_connection_properties(&self, _h: &DbConnectionHandle, _d: Option<&str>) -> AppResult<ConnectionProperties> { unimplemented_pg!() }
    async fn get_all_users(&self, _h: &DbConnectionHandle) -> AppResult<Vec<UserSummary>> { unimplemented_pg!() }
    async fn get_user_detail(&self, _h: &DbConnectionHandle, _u: &str, _h2: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn get_user_model(&self, _h: &DbConnectionHandle, _u: &str, _h2: &str) -> AppResult<UserModelPayload> { unimplemented_pg!() }
    fn generate_user_sql(&self, _c: &UserModel, _i: bool, _o: Option<&UserModel>) -> String { String::new() }
    async fn execute_user_sql(&self, _h: &DbConnectionHandle, _s: &str, _d: Option<&str>) -> AppResult<()> { unimplemented_pg!() }
    async fn query(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<QueryResult> { unimplemented_pg!() }
    async fn query_prepared(&self, _h: &DbConnectionHandle, _s: &str, _p: &[SqlParam]) -> AppResult<QueryResult> { unimplemented_pg!() }
    async fn query_page(&self, _h: &DbConnectionHandle, _s: &str, _p: Option<u64>, _ps: Option<u64>, _i: Option<bool>) -> AppResult<QueryPageResult> { unimplemented_pg!() }
    async fn query_multi(&self, _h: &DbConnectionHandle, _s: &str, _d: Option<&str>) -> AppResult<MultiQueryResult> { unimplemented_pg!() }
    async fn query_prepared_multi(&self, _h: &DbConnectionHandle, _s: &str, _p: &[SqlParam]) -> AppResult<MultiQueryResult> { unimplemented_pg!() }
    async fn execute(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<ExecResult> { unimplemented_pg!() }
    async fn execute_prepared(&self, _h: &DbConnectionHandle, _s: &str, _p: &[SqlParam]) -> AppResult<ExecResult> { unimplemented_pg!() }
    async fn execute_special(&self, _h: &DbConnectionHandle, _s: &str) -> AppResult<SpecialResult> { unimplemented_pg!() }
    async fn execute_script(&self, _h: &DbConnectionHandle, _s: &str, _d: Option<&str>, _st: bool) -> AppResult<ScriptExecuteResult> { unimplemented_pg!() }
    async fn use_database(&self, _h: &DbConnectionHandle, _d: &str) -> AppResult<()> { unimplemented_pg!() }
    async fn set_session_charset(&self, _h: &DbConnectionHandle, _c: &str, _co: Option<&str>) -> AppResult<()> { unimplemented_pg!() }
    fn dump_header_sql(&self, _o: &BackupOptions, _p: &ConnectionProfile, _s: &str) -> String { String::new() }
    fn dump_footer_sql(&self) -> String { String::new() }
    fn create_database_sql(&self, _s: &str, _c: Option<&str>, _co: Option<&str>) -> String { String::new() }
    async fn show_create_table(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn show_create_view(&self, _h: &DbConnectionHandle, _s: &str, _v: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn show_create_routine(&self, _h: &DbConnectionHandle, _s: &str, _n: &str, _t: &str) -> AppResult<String> { unimplemented_pg!() }
    async fn show_create_trigger(&self, _h: &DbConnectionHandle, _s: &str, _t: &str) -> AppResult<String> { unimplemented_pg!() }
    fn build_paged_sql(&self, sql: &str, offset: u64, limit: u64) -> String { format!("{} LIMIT {} OFFSET {}", sql, limit, offset) }
    fn generate_create_table_sql(&self, _d: &TableDesign) -> String { String::new() }
    fn generate_alter_table_sql(&self, _o: &TableDesign, _m: &TableDesign) -> String { String::new() }
    fn quote_identifier(&self, name: &str) -> String { format!("\"{}\"", name.replace('"', "\"\"")) }
    fn quote_string_literal(&self, value: &str) -> String {
        format!("'{}'", value.replace('\\', "\\\\").replace('\'', "''"))
    }
    fn is_system_database(&self, database: &str) -> bool {
        matches!(database.to_ascii_lowercase().as_str(), "postgres" | "template0" | "template1")
    }
}
