use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupOptions {
    #[serde(rename = "includeStructure")]
    pub include_structure: bool,
    #[serde(rename = "includeData")]
    pub include_data: bool,
    #[serde(rename = "includeViews")]
    pub include_views: bool,
    #[serde(rename = "includeRoutines")]
    pub include_routines: bool,
    #[serde(rename = "includeTriggers")]
    pub include_triggers: bool,
    #[serde(rename = "addDropTable")]
    pub add_drop_table: bool,
    #[serde(rename = "useTransaction")]
    pub use_transaction: bool,
    #[serde(rename = "compressOutput")]
    pub compress_output: bool,
    #[serde(rename = "compressionLevel")]
    pub compression_level: Option<u8>,
    #[serde(rename = "insertBatchSize")]
    pub insert_batch_size: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRequest {
    pub conn: crate::models::connection::ConnectionProfile,
    pub schema: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(rename = "mysqldumpPath")]
    pub mysqldump_path: Option<String>,
    #[serde(rename = "selectedTables")]
    pub selected_tables: Option<Vec<String>>,
    #[serde(rename = "selectedViews")]
    pub selected_views: Option<Vec<String>>,
    #[serde(rename = "selectedRoutines")]
    pub selected_routines: Option<Vec<String>>,
    pub options: BackupOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreRequest {
    pub conn: crate::models::connection::ConnectionProfile,
    #[serde(rename = "targetSchema")]
    pub target_schema: String,
    #[serde(rename = "mysqlPath")]
    pub mysql_path: Option<String>,
    #[serde(rename = "inputPath")]
    pub input_path: String,
    #[serde(rename = "createSchema")]
    pub create_schema: bool,
    #[serde(rename = "continueOnError")]
    pub continue_on_error: bool,
    #[serde(rename = "useTransaction")]
    pub use_transaction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRequest {
    #[serde(rename = "scheduleId")]
    pub schedule_id: String,
    pub cron: String,
    pub backup: BackupRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupResult {
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    #[serde(rename = "statementsExecuted")]
    pub statements_executed: u64,
    #[serde(rename = "errorCount")]
    pub error_count: u64,
}

impl Default for BackupOptions {
    fn default() -> Self {
        Self {
            include_structure: true,
            include_data: true,
            include_views: true,
            include_routines: true,
            include_triggers: true,
            add_drop_table: false,
            use_transaction: true,
            compress_output: false,
            compression_level: Some(6),
            insert_batch_size: Some(200),
        }
    }
}
