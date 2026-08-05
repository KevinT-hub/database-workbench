use tauri::State;
use crate::errors::AppResult;
use crate::models::query::SqlSplitSessionInfo;
use crate::core::query::splitter;
use crate::core::query::session::SqlSplitSessionStore;

#[tauri::command]
pub fn sql_split_statements_create(sql: String, db_type: Option<String>, state: State<'_, SqlSplitSessionStore>) -> AppResult<SqlSplitSessionInfo> {
    let statements = splitter::split_statements(&sql);
    let db_type = db_type.unwrap_or_else(|| "mysql".to_string());
    let count = statements.len();
    let session_id = state.create(statements, db_type);
    Ok(SqlSplitSessionInfo { session_id, statement_count: count, db_type: "mysql".into() })
}

#[tauri::command]
pub fn sql_split_statements_release(session_id: u64, state: State<'_, SqlSplitSessionStore>) -> AppResult<bool> {
    Ok(state.release(session_id))
}
