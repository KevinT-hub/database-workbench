use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    #[serde(rename = "rowsExported")]
    pub rows_exported: u64,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    #[serde(rename = "rowsImported")]
    pub rows_imported: u64,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvExportInfo {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "rowsExported")]
    pub rows_exported: u64,
}
