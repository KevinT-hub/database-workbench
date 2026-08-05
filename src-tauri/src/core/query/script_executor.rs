use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::core::query::session::SqlSplitSessionStore;
use crate::errors::{AppResult, AppError};
use crate::models::query::*;

pub async fn execute_statement_page(
    adapter: &dyn DatabaseAdapter,
    handle: &DbConnectionHandle,
    session_store: &SqlSplitSessionStore,
    session_id: u64,
    page: Option<u64>,
    page_size: Option<u64>,
    _run_id: Option<String>,
    _success_offset: Option<u64>,
    _error_offset: Option<u64>,
    _stop_on_error: Option<bool>,
) -> AppResult<ScriptExecutePageResult> {
    let statements = session_store.get(session_id).ok_or(AppError::NotFound(format!("Session {} not found", session_id)))?;
    let total = statements.len() as u64;
    let ps = page_size.unwrap_or(50);
    let page_num = page.unwrap_or(0);
    let start_idx = (page_num * ps) as usize;
    let end_idx = std::cmp::min(start_idx + ps as usize, statements.len());
    let has_more = end_idx < statements.len();

    let mut entries = Vec::new();
    for (_, stmt) in statements.iter().enumerate().skip(start_idx).take(ps as usize) {
        let trimmed = stmt.trim().to_string();
        if trimmed.is_empty() {
            entries.push(ScriptExecutePageEntry {
                result_type: "info".into(),
                statement_index: 0,
                sql: String::new(),
                query_result: None,
                exec_result: None,
                error: None,
            });
            continue;
        }
        let trim_lower = trimmed.to_ascii_lowercase();
        // 语句类型判断：查询类（返回结果集）vs 执行类（返回影响行数）
        // with = SQL 标准 CTE 查询；call = 存储过程调用；desc = describe 简写
        if trim_lower.starts_with("select") || trim_lower.starts_with("show") || trim_lower.starts_with("describe") || trim_lower.starts_with("desc ") || trim_lower.starts_with("explain") || trim_lower.starts_with("with") || trim_lower.starts_with("call") {
            match adapter.query(handle, &trimmed).await {
                Ok(r) => {
                    entries.push(ScriptExecutePageEntry {
                        result_type: "query".into(),
                        statement_index: 0,
                        sql: trimmed,
                        query_result: Some(r),
                        exec_result: None,
                        error: None,
                    });
                }
                Err(e) => {
                    entries.push(ScriptExecutePageEntry {
                        result_type: "error".into(),
                        statement_index: 0,
                        sql: trimmed,
                        query_result: None,
                        exec_result: None,
                        error: Some(format!("{:?}", e)),
                    });
                }
            }
        } else {
            match adapter.execute(handle, &trimmed).await {
                Ok(r) => {
                    entries.push(ScriptExecutePageEntry {
                        result_type: "exec".into(),
                        statement_index: 0,
                        sql: trimmed,
                        query_result: None,
                        exec_result: Some(r),
                        error: None,
                    });
                }
                Err(e) => {
                    entries.push(ScriptExecutePageEntry {
                        result_type: "error".into(),
                        statement_index: 0,
                        sql: trimmed,
                        query_result: None,
                        exec_result: None,
                        error: Some(format!("{:?}", e)),
                    });
                }
            }
        }
    }
    Ok(ScriptExecutePageResult {
        entries,
        page: page_num,
        page_size: ps,
        total,
        has_more,
    })
}
