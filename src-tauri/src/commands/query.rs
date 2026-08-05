use tauri::{State, Window};
use crate::errors::{AppResult, AppError};
use crate::models::query::*;
use crate::core::pool::manager::PoolRegistry;
use crate::core::query::session::SqlSplitSessionStore;
use crate::services::session_log::SessionLogger;

#[tauri::command]
pub async fn pool_query(window: Window, pool_id: u64, conn_id: u64, sql: String, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<QueryResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    let mut result = adapter.query(&handle, &sql).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, result.rows.len() as u64, false);
    Ok(result)
}

#[tauri::command]
pub async fn pool_query_page(window: Window, pool_id: u64, conn_id: u64, sql: String, page: Option<u64>, page_size: Option<u64>, include_total: Option<bool>, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<QueryPageResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    let mut result = adapter.query_page(&handle, &sql, page, page_size, include_total).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, result.rows.len() as u64, false);
    Ok(result)
}

#[tauri::command]
pub async fn pool_query_multi(window: Window, pool_id: u64, conn_id: u64, sql: String, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<MultiQueryResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    // 连接池是共享的，物理连接上没有可靠的会话默认库；
    // 以注册表记录的 conn_database 为准，让适配器在专用连接上先 USE 再执行。
    let database = state.get_conn_database(pool_id, conn_id);
    let mut result = adapter.query_multi(&handle, &sql, database.as_deref()).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    let total_rows = result.result_sets.iter().map(|rs| rs.rows.len() as u64).sum();
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, total_rows, false);
    Ok(result)
}

#[tauri::command]
pub async fn pool_execute(window: Window, pool_id: u64, conn_id: u64, sql: String, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<ExecResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    let mut result = adapter.execute(&handle, &sql).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, result.affected_rows, true);
    Ok(result)
}

#[tauri::command]
pub async fn pool_query_prepared(window: Window, pool_id: u64, conn_id: u64, sql: String, params: Vec<SqlParam>, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<QueryResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    let mut result = adapter.query_prepared(&handle, &sql, &params).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, result.rows.len() as u64, false);
    Ok(result)
}

#[tauri::command]
pub async fn pool_execute_prepared(window: Window, pool_id: u64, conn_id: u64, sql: String, params: Vec<SqlParam>, state: State<'_, PoolRegistry>, logger: State<'_, SessionLogger>) -> AppResult<ExecResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let start = std::time::Instant::now();
    let mut result = adapter.execute_prepared(&handle, &sql, &params).await?;
    let elapsed = start.elapsed().as_secs_f64();
    result.query_time_secs = elapsed;
    logger.emit(&window, pool_id, conn_id, &sql, elapsed, result.affected_rows, true);
    Ok(result)
}

#[tauri::command]
pub async fn pool_execute_statement_page(window: Window, pool_id: u64, conn_id: u64, session_id: u64, page: Option<u64>, page_size: Option<u64>, run_id: Option<String>, success_offset: Option<u64>, error_offset: Option<u64>, stop_on_error: Option<bool>, state: State<'_, PoolRegistry>, sessions: State<'_, SqlSplitSessionStore>, logger: State<'_, SessionLogger>) -> AppResult<ScriptExecutePageResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let result = crate::core::query::script_executor::execute_statement_page(&*adapter, &handle, &sessions, session_id, page, page_size, run_id, success_offset, error_offset, stop_on_error).await?;
    let total_rows: u64 = result.entries.iter().map(|e| e.query_result.as_ref().map(|r| r.rows.len() as u64).unwrap_or(0)).sum();
    logger.emit(&window, pool_id, conn_id, "[script page]", result.entries.len() as f64, total_rows, false);
    Ok(result)
}

/// 在专用事务连接上一次性执行完整 SQL 脚本，返回每条语句的执行结果。
///
/// 用于新建查询的多语句脚本执行：保证所有语句在同一物理连接上执行
/// （修复 1046），使用 DELIMITER 感知切分（修复复合语句被切碎 + 中文），
/// 走 raw_sql 简单查询协议（修复 prepared statement 1295）。
#[tauri::command]
pub async fn pool_execute_script(
    window: Window,
    pool_id: u64,
    conn_id: u64,
    sql: String,
    database: Option<String>,
    stop_on_error: Option<bool>,
    state: State<'_, PoolRegistry>,
    logger: State<'_, SessionLogger>,
) -> AppResult<ScriptExecuteResult> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let result = adapter.execute_script(&handle, &sql, database.as_deref(), stop_on_error.unwrap_or(true)).await?;
    let total_rows: u64 = result.entries.iter().map(|e| e.query_result.as_ref().map(|r| r.rows.len() as u64).unwrap_or(0)).sum();
    logger.emit(&window, pool_id, conn_id, "[script]", result.entries.len() as f64, total_rows, false);
    Ok(result)
}
