use std::io::Write;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::import_export::*;
use crate::core::import_export::values;

pub async fn export_jsonl(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut out = std::fs::File::create(output_path)?;
    for row in &result.rows {
        let mut obj = serde_json::Map::new();
        for (j, col) in result.columns.iter().enumerate() {
            let val = row.get(j).cloned().unwrap_or(serde_json::Value::Null);
            obj.insert(col.name.clone(), val);
        }
        writeln!(out, "{}", serde_json::to_string(&serde_json::Value::Object(obj))?)?;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn import_jsonl(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let content = std::fs::read_to_string(input_path)?;
    let columns = adapter.list_columns(handle, schema, table).await?;
    let quoted = adapter.quote_identifier(table);
    let cols: Vec<String> = columns.iter()
        .map(|c| adapter.quote_identifier(&c.name))
        .collect();
    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let obj: serde_json::Value = serde_json::from_str(line)?;
        if let Some(map) = obj.as_object() {
            let vals: Vec<String> = columns.iter().map(|col| {
                let v = map
                    .get(&col.name)
                    .or_else(|| map.iter().find(|(k, _)| k.eq_ignore_ascii_case(&col.name)).map(|(_, v)| v))
                    .unwrap_or(&serde_json::Value::Null);
                values::json_to_sql_literal(
                    adapter,
                    v,
                    &col.data_type,
                    col.is_nullable.eq_ignore_ascii_case("YES"),
                )
            }).collect();
            batch.push(format!("({})", vals.join(", ")));
        }
        if batch.len() >= 500 {
            let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, cols.join(", "), batch.join(", "));
            adapter.execute(handle, &sql).await?;
            count += batch.len() as u64;
            batch.clear();
        }
    }
    if !batch.is_empty() {
        let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, cols.join(", "), batch.join(", "));
        adapter.execute(handle, &sql).await?;
        count += batch.len() as u64;
    }
    let _ = schema;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ImportResult { success: true, rows_imported: count, duration_ms: duration, error: None })
}
