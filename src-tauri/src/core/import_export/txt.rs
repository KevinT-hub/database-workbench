use std::io::Write;
use std::io::BufRead;
use std::io::BufReader;
use std::fs::File;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::{AppResult, AppError};
use crate::models::import_export::*;
use crate::core::import_export::values;

pub async fn export_txt(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut out = std::fs::File::create(output_path)?;
    let headers: Vec<String> = result.columns.iter().map(|c| c.name.clone()).collect();
    let header_line: Vec<String> = headers.iter().map(|h| escape_txt_field(h)).collect();
    writeln!(out, "{}", header_line.join("\t"))?;
    for row in &result.rows {
        let line: Vec<String> = row.iter().map(|v| escape_txt_field(&super::value_to_string(v))).collect();
        writeln!(out, "{}", line.join("\t"))?;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn import_txt(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let columns = adapter.list_columns(handle, schema, table).await?;

    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    // 首行为表头（去掉 BOM）
    let header_line = lines
        .next()
        .ok_or_else(|| AppError::InvalidInput("TXT file is empty".into()))?
        .map_err(|e| AppError::Io(e))?;
    let header_line = header_line.trim_start_matches('\u{FEFF}');
    let headers = parse_txt_line(header_line);
    if headers.is_empty() {
        return Err(AppError::InvalidInput("TXT header is empty".into()));
    }

    // 按表列顺序建立 (列信息, 表头位置) 映射
    let ordered: Vec<(&crate::models::metadata::ColumnInfo, Option<usize>)> = columns
        .iter()
        .map(|col| {
            let pos = headers.iter().position(|h| h.trim_matches('"').eq_ignore_ascii_case(&col.name));
            (col, pos)
        })
        .collect();
    if ordered.iter().all(|(_, pos)| pos.is_none()) {
        return Err(AppError::InvalidInput("No matching columns found in TXT".into()));
    }
    let selected: Vec<(&crate::models::metadata::ColumnInfo, usize)> = ordered.iter()
        .filter_map(|(col, pos)| pos.map(|p| (*col, p)))
        .collect();
    let col_sql: Vec<String> = ordered.iter()
        .filter_map(|(col, pos)| pos.map(|_| adapter.quote_identifier(&col.name)))
        .collect();
    let quoted = adapter.quote_identifier(table);

    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for (_index, line_result) in lines.enumerate() {
        let line = line_result.map_err(|e| AppError::Io(e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let values_str = parse_txt_line(&line);
        let values: Vec<String> = selected.iter().map(|(col, pos)| {
            let raw = values_str.get(*pos).map(|s| s.as_str()).unwrap_or("");
            values::text_to_sql_literal(
                adapter,
                raw,
                &col.data_type,
                col.is_nullable.eq_ignore_ascii_case("YES"),
            )
        }).collect();
        batch.push(format!("({})", values.join(", ")));
        count += 1;
        if batch.len() >= 500 {
            let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, col_sql.join(", "), batch.join(", "));
            adapter.execute(handle, &sql).await?;
            batch.clear();
        }
    }
    if !batch.is_empty() {
        let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, col_sql.join(", "), batch.join(", "));
        adapter.execute(handle, &sql).await?;
    }

    let duration = start.elapsed().as_millis() as u64;
    Ok(ImportResult { success: true, rows_imported: count, duration_ms: duration, error: None })
}

/// 按 Tab 切分一行。
///
/// 引号规则（CSV 风格）：
/// - 仅当字段以 `"` 开头时才进入引号模式，内部 `""` 表示转义的引号；
/// - 不以 `"` 开头的字段中的引号按字面处理——这是 JSON 列能正确导入的关键，
///   V1 的“任意位置切换引号”会把 `{"a":1}` 剥成 `{a:1}` 导致 MySQL 3140。
fn parse_txt_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut field_started = false;
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                if !field_started {
                    // 字段开头是引号 → 进入引号模式
                    field_started = true;
                    in_quotes = true;
                } else if in_quotes {
                    if chars.peek() == Some(&'"') {
                        // 转义的引号 ""
                        current.push('"');
                        chars.next();
                    } else {
                        in_quotes = false;
                    }
                } else {
                    // 非引号模式下的引号按字面处理
                    current.push('"');
                }
            }
            '\t' if !in_quotes => {
                result.push(trim_txt_value(&current));
                current.clear();
                field_started = false;
            }
            _ => {
                field_started = true;
                current.push(ch);
            }
        }
    }
    if !current.is_empty() || line.ends_with('\t') {
        result.push(trim_txt_value(&current));
    }
    result
}

/// TXT 字段转义：含 Tab/引号/换行的字段用 `"..."` 包裹并将内部引号翻倍，
/// 保证 JSON 等含引号字段导出后可无损导回。
fn escape_txt_field(value: &str) -> String {
    if value.contains('\t') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn trim_txt_value(value: &str) -> String {
    let trimmed = value.trim();
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_txt_line_basic() {
        let line = "sno\tcno\ttno\tgrade";
        assert_eq!(parse_txt_line(line), vec!["sno", "cno", "tno", "grade"]);
    }

    #[test]
    fn test_parse_txt_line_quoted() {
        let line = "96001\t\"001\"\t052501\t91.5";
        assert_eq!(parse_txt_line(line), vec!["96001", "001", "052501", "91.5"]);
    }

    #[test]
    fn test_parse_txt_line_escaped_quote() {
        let line = "1\t\"he said \"\"hi\"\"\"";
        assert_eq!(parse_txt_line(line), vec!["1", "he said \"hi\""]);
    }

    #[test]
    fn test_parse_txt_line_trailing_tab() {
        let line = "a\tb\t";
        assert_eq!(parse_txt_line(line), vec!["a", "b", ""]);
    }

    #[test]
    fn test_parse_txt_line_keeps_json_quotes() {
        // JSON 字段不以引号开头：内部引号必须按字面保留（回归：3140 Missing a name）
        let line = "1\t{\"car_type_id\":1,\"name\":\"轿车\"}";
        assert_eq!(
            parse_txt_line(line),
            vec!["1", r#"{"car_type_id":1,"name":"轿车"}"#]
        );
    }

    #[test]
    fn test_parse_txt_line_quoted_json_roundtrip() {
        // 导出端对含引号字段做 CSV 风格包裹后应能无损还原
        let escaped = escape_txt_field(r#"{"a":1,"b":"x"}"#);
        assert_eq!(escaped, r#""{""a"":1,""b"":""x""}""#);
        let parsed = parse_txt_line(&format!("1\t{}", escaped));
        assert_eq!(parsed[1], r#"{"a":1,"b":"x"}"#);
    }

    #[test]
    fn test_escape_txt_field() {
        assert_eq!(escape_txt_field("plain"), "plain");
        assert_eq!(escape_txt_field("a\tb"), "\"a\tb\"");
        assert_eq!(escape_txt_field("a\"b"), "\"a\"\"b\"");
    }
}
