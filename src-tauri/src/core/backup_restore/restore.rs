use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::core::database::mysql::special as mysql_special;
use crate::errors::{AppResult, AppError};
use crate::models::backup::*;
use crate::utils;
use sqlx::Executor;
async fn run_restore_on_pool(
    pool: &sqlx::mysql::MySqlPool,
    setup_sql: &str,
    statements: &[String],
    continue_on_error: bool,
) -> AppResult<(u64, u64)> {
    let mut tx = pool.begin().await?;

    // ===== 目标库切换 =====
    for stmt in mysql_special::split_statements_mysql(setup_sql) {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        tx.execute(sqlx::raw_sql(s)).await?;
    }

    // ===== 逐条执行 =====
    let mut statements_executed: u64 = 0;
    let mut error_count: u64 = 0;
    for stmt in statements {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        match tx.execute(sqlx::raw_sql(s)).await {
            Ok(_) => { statements_executed += 1; }
            Err(e) => {
                error_count += 1;
                let app_err: AppError = e.into();
                if !continue_on_error {
                    let _ = tx.rollback().await;
                    return Err(app_err);
                }
                eprintln!("[restore] Error (skipped): {:?}", app_err);
            }
        }
    }

    // 提交事务（还原完成）
    tx.commit().await?;
    Ok((statements_executed, error_count))
}

pub async fn execute_restore(
    adapter: &dyn DatabaseAdapter,
    handle: &DbConnectionHandle,
    request: &RestoreRequest,
) -> AppResult<RestoreResult> {
    let start = std::time::Instant::now();
    let content = utils::file::read_sql_file_maybe_gz(&request.input_path)?;

    // 使用 DELIMITER 感知切分器（同时兼容 $$ 和 // 以及无 DELIMITER 的普通 SQL）
    let statements = mysql_special::split_statements_mysql(&content);

    // ===== 获取 MySQL 连接池 =====
    // 还原逻辑绑死 MySQL：DELIMITER 切分、needs_raw_protocol 判断都是 MySQL 专用
    let pool = handle.pool.as_mysql()
        .ok_or_else(|| AppError::UnsupportedFeature(
            "Restore is currently only supported for MySQL".into()
        ))?;

    // ===== 目标库切换 SQL =====
    // 新库模式：CREATE DATABASE IF NOT EXISTS + USE
    // 现有库模式：仅 USE
    let target = &request.target_schema;
    let setup_sql = if request.create_schema {
        adapter.create_database_sql(target, None, None)
    } else {
        format!("USE {};", adapter.quote_identifier(target))
    };

    // ===== 在专用连接上执行所有语句 =====
    let (statements_executed, error_count) = run_restore_on_pool(
        pool,
        &setup_sql,
        &statements,
        request.continue_on_error,
    ).await?;

    let duration = start.elapsed().as_millis() as u64;
    Ok(RestoreResult {
        duration_ms: duration,
        statements_executed,
        error_count,
    })
}
