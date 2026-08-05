use std::io::Write;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::import_export::*;
use crate::models::connection::DbType;

const HTML_HEADER: &str = r#"<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:20px;background:#f5f5f5}h1{color:#333;text-align:center;margin-bottom:8px}.source{color:#666;text-align:center;font-size:14px;margin:0 0 20px}table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.1)}th,td{border:1px solid #ddd;padding:12px;text-align:left}th{background:#2196F3;color:#fff;font-weight:600}tr:nth-child(even){background:#f9f9f9}tr:hover{background:#f1f1f1}</style></head><body><h1>{title}</h1>{source}<table>"#;
const HTML_FOOTER: &str = "</table></body></html>";

/// HTML 导出。
///
/// - `schema`/`table`：表导出时传入，用于在页面顶部展示表名；
/// - DBMS 标签不硬编码：通过 `adapter.db_type()` 判断，只有 MySQL 才标注
///   “数据来源: MySQL”，为后续多 DBMS 支持预留。
pub async fn export_html(
    adapter: &dyn DatabaseAdapter,
    handle: &DbConnectionHandle,
    sql: &str,
    schema: Option<&str>,
    table: Option<&str>,
    output_path: &str,
) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut out = std::fs::File::create(output_path)?;

    let title = match (schema, table) {
        (Some(s), Some(t)) => format!("{}.{}", s, t),
        (_, Some(t)) => t.to_string(),
        _ => "查询结果".to_string(),
    };
    let source = if adapter.db_type() == DbType::Mysql {
        "<p class=\"source\">数据来源: MySQL</p>"
    } else {
        ""
    };
    write!(
        out,
        "{}",
        HTML_HEADER
            .replace("{title}", &super::escape::html_escape(&title))
            .replace("{source}", source)
    )?;
    write!(out, "<tr>")?;
    for col in &result.columns {
        write!(out, "<th>{}</th>", super::escape::html_escape(&col.name))?;
    }
    write!(out, "</tr>")?;
    for row in &result.rows {
        write!(out, "<tr>")?;
        for v in row {
            write!(out, "<td>")?;
            if !v.is_null() {
                let s = super::value_to_string(v);
                write!(out, "{}", super::escape::html_escape(&s))?;
            }
            write!(out, "</td>")?;
        }
        write!(out, "</tr>")?;
    }
    write!(out, "{}", HTML_FOOTER)?;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}
