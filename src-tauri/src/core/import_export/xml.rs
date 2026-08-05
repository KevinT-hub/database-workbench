use std::io::Write;
use std::collections::HashMap;
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::{AppResult, AppError};
use crate::models::import_export::*;
use crate::core::import_export::values;

pub async fn export_xml(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, sql: &str, output_path: &str) -> AppResult<ExportResult> {
    let start = std::time::Instant::now();
    let result = adapter.query(handle, sql).await?;
    let mut out = std::fs::File::create(output_path)?;
    writeln!(out, r#"<?xml version="1.0" encoding="UTF-8"?>"#)?;
    writeln!(out, "<resultset>")?;
    for row in &result.rows {
        writeln!(out, "  <row>")?;
        for (j, col) in result.columns.iter().enumerate() {
            let tag = super::escape::xml_escape(&col.name);
            if let Some(v) = row.get(j) {
                if !v.is_null() {
                    let s = super::value_to_string(v);
                    writeln!(out, "    <{}>{}</{}>", tag, super::escape::xml_escape(&s), tag)?;
                } else {
                    writeln!(out, "    <{}/>", tag)?;
                }
            }
        }
        writeln!(out, "  </row>")?;
    }
    writeln!(out, "</resultset>")?;
    let duration = start.elapsed().as_millis() as u64;
    Ok(ExportResult { success: true, rows_exported: result.rows.len() as u64, file_path: output_path.to_string(), duration_ms: duration, error: None })
}

pub async fn import_xml(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, input_path: &str) -> AppResult<ImportResult> {
    let start = std::time::Instant::now();
    let content = std::fs::read_to_string(input_path)?;
    let rows = parse_xml_rows(&content)?;
    if rows.is_empty() {
        return Err(AppError::InvalidInput("No valid records found in XML".into()));
    }

    let columns = adapter.list_columns(handle, schema, table).await?;
    let quoted = adapter.quote_identifier(table);
    let col_sql: Vec<String> = columns.iter()
        .map(|c| adapter.quote_identifier(&c.name))
        .collect();
    let mut count: u64 = 0;
    let mut batch = Vec::new();
    for row in &rows {
        let vals: Vec<String> = columns.iter().map(|col| {
            let raw = row
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(&col.name))
                .map(|(_, v)| v.as_str())
                .unwrap_or("");
            values::text_to_sql_literal(
                adapter,
                raw,
                &col.data_type,
                col.is_nullable.eq_ignore_ascii_case("YES"),
            )
        }).collect();
        batch.push(format!("({})", vals.join(", ")));
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

/// 解析 XML 行数据。
///
/// 兼容两种形态：
/// - 本应用 XML 导出：`<resultset><row><列名>值</列名></row></resultset>`
/// - V1 遗留格式：`<RECORDS><RECORD><列名>值</列名></RECORD></RECORDS>`
fn parse_xml_rows(content: &str) -> AppResult<Vec<HashMap<String, String>>> {
    let trimmed = content.trim();
    if !trimmed.starts_with("<?xml") && !trimmed.starts_with("<resultset") && !trimmed.starts_with("<RECORDS") {
        return Err(AppError::InvalidInput(
            "Invalid XML format: expected <?xml, <resultset> or <RECORDS>".into(),
        ));
    }

    let mut rows = Vec::new();
    let mut pos = 0usize;
    // 行容器：<row> 与 <RECORD> 都按一行处理
    let row_tags = ["<row>", "<ROW>", "<RECORD>"];
    let close_tags = ["</row>", "</ROW>", "</RECORD>"];

    loop {
        let mut found = None;
        for (i, tag) in row_tags.iter().enumerate() {
            if let Some(idx) = content[pos..].find(tag) {
                let candidate = pos + idx;
                if found.map(|(f, _): (usize, usize)| candidate < f).unwrap_or(true) {
                    found = Some((candidate, i));
                }
            }
        }
        let (start_idx, tag_index) = match found {
            Some(v) => v,
            None => break,
        };
        let open_len = row_tags[tag_index].len();
        let close_tag = close_tags[tag_index];
        let content_start = start_idx + open_len;
        let Some(rel_end) = content[content_start..].find(&close_tag) else {
            break;
        };
        let record_content = &content[content_start..content_start + rel_end];

        let mut row = HashMap::new();
        let mut field_pos = 0usize;
        while let Some(field_start) = record_content[field_pos..].find('<') {
            let field_start_idx = field_pos + field_start + 1;
            let Some(field_end_rel) = record_content[field_start_idx..].find('>') else {
                break;
            };
            let field_end_idx = field_start_idx + field_end_rel;
            let field_name = &record_content[field_start_idx..field_end_idx];
            if field_name.starts_with('/') {
                field_pos = field_end_idx + 1;
                continue;
            }
            // 自闭合标签（如 <old_values/>）：空值，且必须继续解析后续字段。
            // V1 式简单解析若不处理它，会在第一个自闭合标签处 break，
            // 导致其后所有字段（如 new_values）全部丢失。
            if field_name.ends_with('/') {
                let name = field_name[..field_name.len() - 1].trim().to_string();
                if !name.is_empty() {
                    row.insert(name, String::new());
                }
                field_pos = field_end_idx + 1;
                continue;
            }
            let value_start = field_end_idx + 1;
            let close_field = format!("</{}>", field_name);
            if let Some(value_end_rel) = record_content[value_start..].find(&close_field) {
                let value_end = value_start + value_end_rel;
                let value = &record_content[value_start..value_end];
                row.insert(field_name.to_string(), super::escape::xml_unescape(value));
                field_pos = value_end + close_field.len();
            } else {
                break;
            }
        }

        if !row.is_empty() {
            rows.push(row);
        }
        pos = content_start + rel_end + close_tag.len();
    }

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_xml_rows_app_export_format() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<resultset>
  <row><sno>96001</sno><cno>001</cno><tno>052501</tno><grade>91.5</grade></row>
  <row><sno>96002</sno><cno>002</cno><tno>052502</tno><grade>88.0</grade></row>
</resultset>"#;
        let rows = parse_xml_rows(xml).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("sno").map(|s| s.as_str()), Some("96001"));
        assert_eq!(rows[1].get("grade").map(|s| s.as_str()), Some("88.0"));
    }

    #[test]
    fn test_parse_xml_rows_v1_format() {
        let xml = r#"<RECORDS><RECORD><sno>1</sno><name>a&amp;b</name></RECORD><RECORD><sno>2</sno><name>x</name></RECORD></RECORDS>"#;
        let rows = parse_xml_rows(xml).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("name").map(|s| s.as_str()), Some("a&b"));
    }

    #[test]
    fn test_parse_xml_rows_invalid() {
        let err = parse_xml_rows("<html></html>").unwrap_err();
        assert!(err.to_string().contains("Invalid XML format"));
    }

    #[test]
    fn test_parse_xml_rows_self_closing_does_not_drop_following_fields() {
        // 回归：<old_values/> 自闭合后，new_values 必须仍被解析
        let xml = r#"<resultset>
  <row>
    <id>1</id>
    <old_values/>
    <new_values>{&quot;car_type_id&quot;:1,&quot;car_type_name&quot;:&quot;轿车&quot;}</new_values>
  </row>
</resultset>"#;
        let rows = parse_xml_rows(xml).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].get("old_values").map(|s| s.as_str()), Some(""));
        assert_eq!(
            rows[0].get("new_values").map(|s| s.as_str()),
            Some(r#"{"car_type_id":1,"car_type_name":"轿车"}"#)
        );
    }
}
