use std::io::Write;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::import_export::*;

pub async fn export_sql(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, schema: &str, table: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let quoted_full = format!("{}.{}", adapter.quote_identifier(schema), adapter.quote_identifier(table));
    let col_names: Vec<String> = result.columns.iter().map(|c| adapter.quote_identifier(&c.name)).collect();
    let cols_joined = col_names.join(", ");
    let mut out = std::fs::File::create(output_path)?;

    // 干净的 SQL 导出：仅输出 INSERT 语句，不再套用备份模板
    // （SET NAMES / SQL_NOTES / FOREIGN_KEY_CHECKS / LOCK TABLES 等备份专用头尾）。
    writeln!(out, "-- SQL export: {}.{}", schema, table)?;
    writeln!(out, "-- Export time: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"))?;
    writeln!(out)?;

    // 导出时没有列类型元数据（QueryResult 只有列名），按值本身判断：
    // 数字/布尔原样输出，其余走字符串字面量；JSON 等对象保持原始 JSON 文本。
    for row in &result.rows {
        let vals: Vec<String> = row.iter().map(|v| {
            match v {
                serde_json::Value::Null => "NULL".into(),
                serde_json::Value::Bool(b) => if *b { "1".into() } else { "0".into() },
                serde_json::Value::Number(n) => n.to_string(),
                // JSON 列在驱动层以字符串形式返回；保持原文让 MySQL 解析，
                // 避免二次包裹导致 3140 错误。
                serde_json::Value::String(s) => adapter.quote_string_literal(s),
                serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
                    adapter.quote_string_literal(&v.to_string())
                }
            }
        }).collect();
        writeln!(out, "INSERT INTO {} ({}) VALUES ({});", quoted_full, cols_joined, vals.join(", "))?;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn export_sql_query(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let col_names: Vec<String> = result.columns.iter().map(|c| adapter.quote_identifier(&c.name)).collect();
    let cols_joined = col_names.join(", ");
    let mut out = std::fs::File::create(output_path)?;
    writeln!(out, "-- SQL export: query result")?;
    writeln!(out, "-- Export time: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"))?;
    writeln!(out, "-- 查询结果没有目标表名，导入前请把 query_result 替换为实际表名")?;
    writeln!(out)?;
    for row in &result.rows {
        let vals: Vec<String> = row.iter().map(|v| {
            match v {
                serde_json::Value::Null => "NULL".into(),
                serde_json::Value::Bool(b) => if *b { "1".into() } else { "0".into() },
                serde_json::Value::Number(n) => n.to_string(),
                _ => adapter.quote_string_literal(&super::value_to_string(v)),
            }
        }).collect();
        writeln!(out, "INSERT INTO `query_result` ({}) VALUES ({});", cols_joined, vals.join(", "))?;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}
