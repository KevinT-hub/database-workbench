use std::pin::Pin;
use std::future::Future;
use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;
use sqlx::Executor;
use crate::errors::{AppResult, AppError};
use crate::models::query::*;
use crate::core::database::mysql::special::split_statements_mysql;
use crate::core::database::mysql::query::row_value_to_json;

/// 在专用事务连接上一次性执行完整 SQL 脚本，返回每条语句的执行结果。
pub fn execute_script<'a>(
    pool: &'a sqlx::mysql::MySqlPool,
    sql: &'a str,
    database: Option<&'a str>,
    stop_on_error: bool,
) -> Pin<Box<dyn Future<Output = AppResult<ScriptExecuteResult>> + Send + 'a>> {
    Box::pin(async move {
        let mut tx = pool.begin().await?;

        // ===== 目标库切换（事务连接）=====
        if let Some(db) = database {
            let escaped = format!("`{}`", db.replace('`', "``"));
            tx.execute(sqlx::raw_sql(&format!("USE {}", escaped))).await?;
        }

        // ===== DELIMITER 感知切分 =====
        let statements = split_statements_mysql(sql);
        let total = statements.len() as u64;
        let mut entries = Vec::new();
        let mut success_count = 0u64;
        let mut error_count = 0u64;

        // 用于查询类语句的 `USE db;` 前缀（确保 pool 连接上也有正确的数据库上下文）
        let use_prefix = database.map(|db| {
            let escaped = db.replace('`', "``");
            format!("USE `{}`; ", escaped)
        });

        for (idx, stmt) in statements.iter().enumerate() {
            let s = stmt.trim();
            if s.is_empty() {
                continue;
            }

            let lower = s.to_ascii_lowercase();
            // 语句类型判断：查询类（返回结果集）vs 执行类（返回影响行数）
            // with = SQL 标准 CTE 查询；call = 存储过程调用；desc = describe 简写
            let is_query = lower.starts_with("select")
                || lower.starts_with("show")
                || lower.starts_with("describe")
                || lower.starts_with("desc ")
                || lower.starts_with("explain")
                || lower.starts_with("with")
                || lower.starts_with("call");

            let result: Result<ScriptExecutePageEntry, AppError> = if is_query {
                // 查询类：用 pool.fetch_all（&Pool 满足 Executor HRTB）
                // prepend `USE db;` 确保数据库上下文（pool 可能分配不同连接）
                let full_sql = match &use_prefix {
                    Some(prefix) => format!("{}{}", prefix, s),
                    None => s.to_string(),
                };
                match sqlx::raw_sql(&full_sql).fetch_all(pool).await {
                    Ok(rows) => {
                        let col_count = if !rows.is_empty() { rows[0].columns().len() } else { 0 };
                        let columns: Vec<ColumnMeta> = if !rows.is_empty() {
                            rows[0].columns().iter().map(|c| ColumnMeta {
                                name: c.name().to_string(),
                                label: c.name().to_string(),
                                type_name: c.type_info().name().to_string(),
                            }).collect()
                        } else { vec![] };
                        let result_rows: Vec<Vec<serde_json::Value>> = rows.iter()
                            .map(|r| (0..col_count).map(|i| row_value_to_json(r, i)).collect())
                            .collect();
                        Ok(ScriptExecutePageEntry {
                            result_type: "query".into(),
                            statement_index: idx as u64,
                            sql: s.to_string(),
                            query_result: Some(QueryResult {
                                columns,
                                rows: result_rows,
                                query_time_secs: 0.0,
                                fetch_time_secs: 0.0,
                            }),
                            exec_result: None,
                            error: None,
                        })
                    }
                    Err(e) => Err(AppError::from(e)),
                }
            } else {
                // 执行类：用 tx.execute（Connection::execute，不经 Executor HRTB）
                match tx.execute(sqlx::raw_sql(s)).await {
                    Ok(r) => Ok(ScriptExecutePageEntry {
                        result_type: "exec".into(),
                        statement_index: idx as u64,
                        sql: s.to_string(),
                        query_result: None,
                        exec_result: Some(ExecResult {
                            affected_rows: r.rows_affected(),
                            last_insert_id: r.last_insert_id(),
                            query_time_secs: 0.0,
                        }),
                        error: None,
                    }),
                    Err(e) => Err(AppError::from(e)),
                }
            };

            match result {
                Ok(entry) => {
                    success_count += 1;
                    entries.push(entry);
                }
                Err(e) => {
                    error_count += 1;
                    entries.push(ScriptExecutePageEntry {
                        result_type: "error".into(),
                        statement_index: idx as u64,
                        sql: s.to_string(),
                        query_result: None,
                        exec_result: None,
                        error: Some(format!("{:?}", e)),
                    });
                    if stop_on_error {
                        // 出错即停：回滚事务并返回已执行的结果
                        let _ = tx.rollback().await;
                        return Ok(ScriptExecuteResult {
                            entries,
                            total: (idx + 1) as u64,
                            success_count,
                            error_count,
                        });
                    }
                }
            }
        }

        tx.commit().await?;
        Ok(ScriptExecuteResult { entries, total, success_count, error_count })
    })
}
