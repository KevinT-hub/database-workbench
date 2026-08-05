use calamine::Reader;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::import_export::*;

pub async fn export_xlsx(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut workbook = rust_xlsxwriter::Workbook::new();
    let worksheet = workbook.add_worksheet();
    for (j, col) in result.columns.iter().enumerate() {
        worksheet.write_string(0, j as u16, &col.name)?;
    }
    for (i, row) in result.rows.iter().enumerate() {
        for (j, v) in row.iter().enumerate() {
            if !v.is_null() {
                match v {
                    serde_json::Value::Number(n) => {
                        if let Some(f) = n.as_f64() {
                            worksheet.write_number((i + 1) as u32, j as u16, f)?;
                        }
                    }
                    serde_json::Value::Bool(b) => {
                        worksheet.write_boolean((i + 1) as u32, j as u16, *b)?;
                    }
                    _ => {
                        let s = super::value_to_string(v);
                        worksheet.write_string((i + 1) as u32, j as u16, &s)?;
                    }
                }
            }
        }
    }
    workbook.save(output_path)?;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn import_xlsx(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let mut workbook = calamine::open_workbook_auto(input_path)?;
    let sheet_names = workbook.sheet_names();
    let sheet_name = sheet_names.first().cloned().unwrap_or_default();
    let range = workbook.worksheet_range(&sheet_name)?;
    let mut rows_iter = range.rows();
    let header_row = rows_iter.next().ok_or(crate::errors::AppError::InvalidInput("Empty XLSX file".into()))?;
    let headers: Vec<String> = header_row.iter().map(|c: &calamine::Data| c.to_string()).collect();
    let columns = adapter.list_columns(handle, schema, table).await?;
    let col_names: Vec<String> = columns.iter().map(|c| c.name.clone()).collect();
    let mut mapping: Vec<Option<usize>> = Vec::new();
    for h in &headers {
        mapping.push(col_names.iter().position(|c| c.eq_ignore_ascii_case(h)));
    }
    let quoted = adapter.quote_identifier(table);
    let quoted_headers: Vec<String> = headers.iter().filter_map(|h| {
        if col_names.iter().any(|c| c.eq_ignore_ascii_case(h)) {
            Some(adapter.quote_identifier(h))
        } else { None }
    }).collect();
    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for row in rows_iter {
        let vals: Vec<String> = row.iter().enumerate().filter_map(|(i, cell)| {
            mapping.get(i).and_then(|m: &Option<usize>| m.as_ref()).map(|_: &usize| {
                let s = cell.to_string();
                if s.is_empty() || s.eq_ignore_ascii_case("null") {
                    "NULL".into()
                } else {
                    adapter.quote_string_literal(&s)
                }
            })
        }).collect();
        if !vals.is_empty() {
            batch.push(format!("({})", vals.join(", ")));
        }
        if batch.len() >= 500 {
            let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, quoted_headers.join(", "), batch.join(", "));
            adapter.execute(handle, &sql).await?;
            count += batch.len() as u64;
            batch.clear();
        }
    }
    if !batch.is_empty() {
        let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, quoted_headers.join(", "), batch.join(", "));
        adapter.execute(handle, &sql).await?;
        count += batch.len() as u64;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ImportResult { success: true, rows_imported: count, duration_ms: duration, error: None })
}
