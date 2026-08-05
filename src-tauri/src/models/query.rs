use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlParam {
    #[serde(rename = "type")]
    pub param_type: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMeta {
    pub name: String,
    pub label: String,
    #[serde(rename = "typeName")]
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Vec<serde_json::Value>>,
    #[serde(rename = "queryTimeSecs")]
    pub query_time_secs: f64,
    #[serde(rename = "fetchTimeSecs")]
    pub fetch_time_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPageResult {
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub page: u64,
    #[serde(rename = "pageSize")]
    pub page_size: u64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(rename = "totalRows")]
    pub total_rows: Option<u64>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<u64>,
    #[serde(rename = "queryTimeSecs")]
    pub query_time_secs: f64,
    #[serde(rename = "fetchTimeSecs")]
    pub fetch_time_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiQueryResult {
    #[serde(rename = "resultSets")]
    pub result_sets: Vec<QueryResult>,
    #[serde(rename = "affectedRows")]
    pub affected_rows: u64,
    #[serde(rename = "lastInsertId")]
    pub last_insert_id: u64,
    #[serde(rename = "queryTimeSecs")]
    pub query_time_secs: f64,
    #[serde(rename = "fetchTimeSecs")]
    pub fetch_time_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    #[serde(rename = "affectedRows")]
    pub affected_rows: u64,
    #[serde(rename = "lastInsertId")]
    pub last_insert_id: u64,
    #[serde(rename = "queryTimeSecs")]
    pub query_time_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecialResult {
    #[serde(rename = "isSpecial")]
    pub is_special: bool,
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Vec<serde_json::Value>>,
    #[serde(rename = "specialType")]
    pub special_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptExecutePageEntry {
    #[serde(rename = "resultType")]
    pub result_type: String,
    #[serde(rename = "statementIndex")]
    pub statement_index: u64,
    pub sql: String,
    #[serde(rename = "queryResult")]
    pub query_result: Option<QueryResult>,
    #[serde(rename = "execResult")]
    pub exec_result: Option<ExecResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptExecutePageResult {
    pub entries: Vec<ScriptExecutePageEntry>,
    pub page: u64,
    #[serde(rename = "pageSize")]
    pub page_size: u64,
    pub total: u64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

/// 一次性执行整个 SQL 脚本的结果（非分页）。
/// 用于 `pool_execute_script` 命令：后端在专用事务连接上执行所有语句后返回。
/// 复用 `ScriptExecutePageEntry` 作为每条语句的结果条目。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptExecuteResult {
    pub entries: Vec<ScriptExecutePageEntry>,
    pub total: u64,
    #[serde(rename = "successCount")]
    pub success_count: u64,
    #[serde(rename = "errorCount")]
    pub error_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptExecuteProgressEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "statementIndex")]
    pub statement_index: u64,
    pub total: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlSplitSessionInfo {
    #[serde(rename = "sessionId")]
    pub session_id: u64,
    #[serde(rename = "statementCount")]
    pub statement_count: usize,
    #[serde(rename = "dbType")]
    pub db_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlSplitStatementsPage {
    pub statements: Vec<String>,
    pub page: u64,
    #[serde(rename = "pageSize")]
    pub page_size: u64,
    pub total: u64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}
