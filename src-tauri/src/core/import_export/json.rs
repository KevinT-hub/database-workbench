use std::io::Write;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::{AppResult, AppError};
use crate::models::import_export::*;
use crate::core::import_export::values;

pub async fn export_json(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut out = std::fs::File::create(output_path)?;
    write!(out, "[")?;
    for (i, row) in result.rows.iter().enumerate() {
        if i > 0 { write!(out, ",")?; }
        write!(out, "{{")?;
        for (j, col) in result.columns.iter().enumerate() {
            if j > 0 { write!(out, ",")?; }
            write!(out, "{}", json_export_field(&col.name, row.get(j)))?;
        }
        write!(out, "}}")?;
    }
    writeln!(out, "]")?;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

/// 生成单个字段的 JSON 导出片段。
///
/// 关键点：NULL 必须写成 JSON 的 `null`，而不是字符串 `"NULL"`——
/// `value_to_string(Null)` 返回大写 "NULL"，若按字符串输出，导入时
/// MySQL JSON 列会报 3140 “Invalid value”（JSON 关键字区分大小写）。
fn json_export_field(name: &str, value: Option<&serde_json::Value>) -> String {
    let escaped_name = super::escape::escape_json_string(name);
    match value {
        None => format!("\"{}\":null", escaped_name),
        Some(serde_json::Value::Null) => format!("\"{}\":null", escaped_name),
        Some(v) => {
            let val = super::value_to_string(v);
            if val == "true" || val == "false" {
                format!("\"{}\":{}", escaped_name, val)
            } else if val.parse::<f64>().is_ok() {
                format!("\"{}\":{}", escaped_name, val)
            } else {
                format!("\"{}\":\"{}\"", escaped_name, super::escape::escape_json_string(&val))
            }
        }
    }
}

pub async fn import_json(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let content = std::fs::read_to_string(input_path)?;
    let parsed = parse_lenient_json(&content)?;

    // 兼容数组与单个对象两种文件形态（V1 行为）
    let rows: Vec<serde_json::Value> = match parsed {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(_) => vec![parsed],
        _ => return Err(AppError::InvalidInput("JSON must be an array or object".into())),
    };

    let columns = adapter.list_columns(handle, schema, table).await?;
    let quoted = adapter.quote_identifier(table);
    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for obj in &rows {
        if let Some(map) = obj.as_object() {
            // 按表列顺序取值，缺失列补 NULL；文件里多余的键忽略
            let cols: Vec<String> = columns.iter()
                .map(|c| adapter.quote_identifier(&c.name))
                .collect();
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
            if batch.len() >= 500 {
                let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, cols.join(", "), batch.join(", "));
                adapter.execute(handle, &sql).await?;
                count += batch.len() as u64;
                batch.clear();
            }
        }
    }
    if !batch.is_empty() {
        let cols: Vec<String> = columns.iter()
            .map(|c| adapter.quote_identifier(&c.name))
            .collect();
        let sql = format!("INSERT INTO {} ({}) VALUES {}", quoted, cols.join(", "), batch.join(", "));
        adapter.execute(handle, &sql).await?;
        count += batch.len() as u64;
    }
    let duration = start.elapsed().as_millis() as u64;
    Ok(ImportResult { success: true, rows_imported: count, duration_ms: duration, error: None })
}

/// 宽松 JSON 解析：
/// 1. 先按严格 JSON 解析；
/// 2. 失败时把字符串外的“前导零数字”（如 `001`、`052501`）补成带引号的字符串
///    再解析一次——这类文件常见于从 Excel/其他工具导出的 JSON，严格 serde 会报
///    "invalid number"。
fn parse_lenient_json(content: &str) -> AppResult<serde_json::Value> {
    match serde_json::from_str::<serde_json::Value>(content) {
        Ok(v) => Ok(v),
        Err(strict_err) => {
            let repaired = quote_leading_zero_numbers(content);
            match serde_json::from_str::<serde_json::Value>(&repaired) {
                Ok(v) => Ok(v),
                Err(_) => Err(AppError::Json(strict_err)),
            }
        }
    }
}

/// 在 JSON 字符串字面量之外，把形如 `001`/`052501` 的前导零数字替换为字符串。
/// 不做完整 JSON 校验，仅用于宽容解析的预处理。
fn quote_leading_zero_numbers(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut in_string = false;
    let mut escaped = false;
    let mut chars = content.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_string {
            out.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        match ch {
            '"' => {
                in_string = true;
                out.push(ch);
            }
            c if c.is_ascii_digit() => {
                // 收集完整数字 token（含 - . e E +，但只处理前导零场景）
                let mut token = String::new();
                token.push(c);
                while let Some(&next) = chars.peek() {
                    if next.is_ascii_digit() || matches!(next, '-' | '+' | '.' | 'e' | 'E') {
                        token.push(next);
                        chars.next();
                    } else {
                        break;
                    }
                }
                // 前导零（0 后紧跟数字）在 JSON 中非法 → 加引号转成字符串
                let has_leading_zero = token.len() > 1 && token.starts_with('0')
                    && token.chars().nth(1).map(|c| c.is_ascii_digit()).unwrap_or(false);
                if has_leading_zero {
                    out.push('"');
                    out.push_str(&token);
                    out.push('"');
                } else {
                    out.push_str(&token);
                }
            }
            _ => out.push(ch),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_lenient_json_array_with_leading_zero_numbers() {
        // 用户场景：cno=001 / tno=052501 未加引号，严格 serde 会报 invalid number
        let content = r#"[{"sno":96001,"cno":001,"tno":052501,"grade":91.5}]"#;
        let parsed = parse_lenient_json(content).unwrap();
        let arr = parsed.as_array().unwrap();
        assert_eq!(arr[0]["cno"], serde_json::Value::String("001".into()));
        assert_eq!(arr[0]["tno"], serde_json::Value::String("052501".into()));
        assert_eq!(arr[0]["sno"], serde_json::Value::Number(96001.into()));
    }

    #[test]
    fn test_parse_lenient_json_single_object() {
        // 兼容单个对象文件
        let content = r#"{"sno":96001,"cno":"001"}"#;
        let parsed = parse_lenient_json(content).unwrap();
        assert!(parsed.is_object());
    }

    #[test]
    fn test_quote_leading_zero_numbers_skips_valid_numbers() {
        let content = r#"{"a":0,"b":0.5,"c":91.5,"d":1e3}"#;
        let repaired = quote_leading_zero_numbers(content);
        // 合法数字不应被加引号
        assert!(serde_json::from_str::<serde_json::Value>(&repaired).is_ok());
        let v: serde_json::Value = serde_json::from_str(&repaired).unwrap();
        assert_eq!(v["b"], serde_json::Value::Number(serde_json::Number::from_f64(0.5).unwrap()));
    }

    #[test]
    fn test_quote_leading_zero_numbers_quotes_bad_numbers() {
        let content = r#"[{"cno":001}]"#;
        let repaired = quote_leading_zero_numbers(content);
        let v: serde_json::Value = serde_json::from_str(&repaired).unwrap();
        assert_eq!(v[0]["cno"], serde_json::Value::String("001".into()));
    }

    #[test]
    fn test_json_export_field_null_writes_json_null() {
        // 回归：NULL 必须导出为 null，而不是字符串 "NULL"
        assert_eq!(json_export_field("old_values", Some(&serde_json::Value::Null)), r#""old_values":null"#);
        assert_eq!(json_export_field("old_values", None), r#""old_values":null"#);
    }

    #[test]
    fn test_json_export_field_number_and_string() {
        assert_eq!(json_export_field("id", Some(&json!(1))), r#""id":1"#);
        assert_eq!(json_export_field("name", Some(&json!("轿车"))), r#""name":"轿车""#);
    }

    #[test]
    fn test_json_export_field_json_text_stays_string_wrapped() {
        // JSON 列在驱动层返回字符串文本，保持字符串包裹（导入端可还原）
        let v = serde_json::Value::String(r#"{"a":1}"#.to_string());
        assert_eq!(json_export_field("new_values", Some(&v)), r#""new_values":"{\"a\":1}""#);
    }
}
