pub mod csv;
pub mod txt;
pub mod json;
pub mod jsonl;
pub mod html;
pub mod xml;
pub mod sql;
pub mod xlsx;
pub mod escape;
pub mod values;

use serde::{Deserialize, Serialize};
use crate::core::database::traits::{DatabaseAdapter, DbConnectionHandle};
use crate::errors::AppResult;
use crate::models::import_export::*;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ExportFormat {
    Csv, Txt, Json, Html, Xml, Sql, Jsonl, Xlsx,
}

impl ExportFormat {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "csv" => Some(Self::Csv),
            "txt" => Some(Self::Txt),
            "json" => Some(Self::Json),
            "html" => Some(Self::Html),
            "xml" => Some(Self::Xml),
            "sql" => Some(Self::Sql),
            "jsonl" => Some(Self::Jsonl),
            "xlsx" => Some(Self::Xlsx),
            _ => None,
        }
    }

    pub fn file_extension(&self) -> &'static str {
        match self {
            Self::Csv => "csv", Self::Txt => "txt", Self::Json => "json",
            Self::Html => "html", Self::Xml => "xml", Self::Sql => "sql",
            Self::Jsonl => "jsonl", Self::Xlsx => "xlsx",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ImportFormat {
    Csv, Txt, Json, Jsonl, Xml, Xlsx,
}

impl ImportFormat {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "csv" => Some(Self::Csv),
            "txt" => Some(Self::Txt),
            "json" => Some(Self::Json),
            "jsonl" => Some(Self::Jsonl),
            "xml" => Some(Self::Xml),
            "xlsx" => Some(Self::Xlsx),
            _ => None,
        }
    }
}

pub fn value_to_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::Null => "NULL".into(),
        serde_json::Value::Bool(b) => if *b { "true".into() } else { "false".into() },
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(a) => serde_json::to_string(a).unwrap_or_default(),
        serde_json::Value::Object(o) => serde_json::to_string(o).unwrap_or_default(),
    }
}

pub async fn export_table(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, format: ExportFormat, output_path: &str) -> AppResult<ExportResult> {
    let quoted = adapter.quote_identifier(table);
    let sql = format!("SELECT * FROM {}.{}", adapter.quote_identifier(schema), quoted);
    match format {
        ExportFormat::Csv => csv::export_csv(adapter, handle, &sql, output_path).await,
        ExportFormat::Txt => txt::export_txt(adapter, handle, &sql, output_path).await,
        ExportFormat::Json => json::export_json(adapter, handle, &sql, output_path).await,
        ExportFormat::Jsonl => jsonl::export_jsonl(adapter, handle, &sql, output_path).await,
        ExportFormat::Html => html::export_html(adapter, handle, &sql, Some(schema), Some(table), output_path).await,
        ExportFormat::Xml => xml::export_xml(adapter, handle, &sql, output_path).await,
        ExportFormat::Sql => sql::export_sql(adapter, handle, &sql, schema, table, output_path).await,
        ExportFormat::Xlsx => xlsx::export_xlsx(adapter, handle, &sql, output_path).await,
    }
}

pub async fn export_query_result(
    adapter: &dyn DatabaseAdapter,
    handle: &DbConnectionHandle,
    sql: &str,
    format: ExportFormat,
    output_path: &str,
    schema: Option<&str>,
    table: Option<&str>,
) -> AppResult<ExportResult> {
    match format {
        ExportFormat::Csv => csv::export_csv(adapter, handle, sql, output_path).await,
        ExportFormat::Txt => txt::export_txt(adapter, handle, sql, output_path).await,
        ExportFormat::Json => json::export_json(adapter, handle, sql, output_path).await,
        ExportFormat::Jsonl => jsonl::export_jsonl(adapter, handle, sql, output_path).await,
        ExportFormat::Html => html::export_html(adapter, handle, sql, schema, table, output_path).await,
        ExportFormat::Xml => xml::export_xml(adapter, handle, sql, output_path).await,
        ExportFormat::Sql => sql::export_sql_query(adapter, handle, sql, output_path).await,
        ExportFormat::Xlsx => xlsx::export_xlsx(adapter, handle, sql, output_path).await,
    }
}

pub async fn import_table(adapter: &dyn DatabaseAdapter, handle: &DbConnectionHandle, schema: &str, table: &str, format: ImportFormat, input_path: &str) -> AppResult<ImportResult> {
    match format {
        ImportFormat::Csv => csv::import_csv(adapter, handle, schema, table, input_path).await,
        ImportFormat::Json => json::import_json(adapter, handle, schema, table, input_path).await,
        ImportFormat::Jsonl => jsonl::import_jsonl(adapter, handle, schema, table, input_path).await,
        ImportFormat::Txt => txt::import_txt(adapter, handle, schema, table, input_path).await,
        ImportFormat::Xml => xml::import_xml(adapter, handle, schema, table, input_path).await,
        ImportFormat::Xlsx => xlsx::import_xlsx(adapter, handle, schema, table, input_path).await,
    }
}
