use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::{AppResult, AppError};
use crate::models::import_export::*;
use crate::core::import_export::values;

pub async fn export_csv(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut wtr = csv::Writer::from_path(output_path)?;
    let headers: Vec<String> = result.columns.iter().map(|c| c.name.clone()).collect();
    wtr.write_record(&headers)?;
    for row in &result.rows {
        // 只提供原始字符串，由 csv::Writer 自行决定是否加引号/转义，
        // 避免与 escape_csv_field 双重转义（会导致 JSON 等含引号字段在
        // 重新导入时被外层引号包裹，MySQL JSON 列报 3140）。
        let record: Vec<String> = row.iter().map(|v| super::value_to_string(v)).collect();
        wtr.write_record(&record)?;
    }
    wtr.flush()?;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn import_csv(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let mut rdr = csv::Reader::from_path(input_path)?;
    let headers: Vec<String> = rdr.headers()?.iter().map(|s| s.to_string()).collect();
    let columns = adapter.list_columns(handle, schema, table).await?;

    // 按表列顺序建立 (列信息, 文件表头位置) 映射，避免文件列顺序与表列顺序
    // 不一致时把值插错列。
    let ordered: Vec<(&crate::models::metadata::ColumnInfo, Option<usize>)> = columns
        .iter()
        .map(|col| {
            let pos = headers.iter().position(|h| h.eq_ignore_ascii_case(&col.name));
            (col, pos)
        })
        .collect();

    if ordered.iter().all(|(_, pos)| pos.is_none()) {
        return Err(AppError::InvalidInput("No matching columns found in CSV".into()));
    }
    let col_sql: Vec<String> = ordered.iter()
        .filter_map(|(col, pos)| pos.map(|_| adapter.quote_identifier(&col.name)))
        .collect();
    let selected: Vec<(&crate::models::metadata::ColumnInfo, usize)> = ordered.iter()
        .filter_map(|(col, pos)| pos.map(|p| (*col, p)))
        .collect();
    let quoted = adapter.quote_identifier(table);
    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for result in rdr.records() {
        let record = result?;
        let values: Vec<String> = selected.iter().map(|(col, pos)| {
            let raw = record.get(*pos).unwrap_or("");
            values::text_to_sql_literal(
                adapter,
                raw,
                &col.data_type,
                col.is_nullable.eq_ignore_ascii_case("YES"),
            )
        }).collect();
        batch.push(format!("({})", values.join(", ")));
        if batch.len() >= 500 {
            let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, col_sql.join(", "), batch.join(", "));
            adapter.execute(handle, &sql).await?;
            count += batch.len() as u64;
            batch.clear();
        }
    }
    if !batch.is_empty() {
        let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, col_sql.join(", "), batch.join(", "));
        adapter.execute(handle, &sql).await?;
        count += batch.len() as u64;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ImportResult { success: true, rows_imported: count, duration_ms: duration, error: None })
}
