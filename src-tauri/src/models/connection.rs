use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub name: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
    pub charset: Option<String>,
    pub collation: Option<String>,
    pub timeout: Option<u64>,
    #[serde(rename = "connectionTimeout")]
    pub connection_timeout: Option<u64>,
    pub ssl: Option<bool>,
    pub ssl_mode: Option<String>,
    #[serde(rename = "sslCaPath")]
    pub ssl_ca_path: Option<String>,
    #[serde(rename = "sslCertPath")]
    pub ssl_cert_path: Option<String>,
    #[serde(rename = "sslKeyPath")]
    pub ssl_key_path: Option<String>,
    #[serde(default = "default_db_type", rename = "dbType")]
    pub db_type: DbType,
}

fn default_db_type() -> DbType { DbType::Mysql }

impl ConnectionProfile {
    pub fn db_type(&self) -> DbType { self.db_type }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DbType {
    #[serde(rename = "MYSQL")]
    Mysql,
    #[serde(rename = "POSTGRESQL")]
    PostgreSql,
    #[serde(rename = "SQL_SERVER")]
    SqlServer,
    #[serde(rename = "ORACLE")]
    Oracle,
    #[serde(rename = "SQLITE")]
    Sqlite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
    pub charset: Option<String>,
    pub collation: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub ssl_mode: Option<String>,
    pub ssl_ca_path: Option<String>,
    pub ssl_cert_path: Option<String>,
    pub ssl_key_path: Option<String>,
    pub max_pool_size: Option<usize>,
    pub min_idle: Option<usize>,
    pub idle_timeout_ms: Option<u64>,
    pub max_lifetime_ms: Option<u64>,
    pub connection_timeout_ms: Option<u64>,
    pub create_timeout_ms: Option<u64>,
    pub recycle_timeout_ms: Option<u64>,
    pub current_database: Option<String>,
    pub keepalive_interval_secs: Option<u64>,
}

impl PoolConfig {
    pub fn from_profile(profile: &ConnectionProfile) -> Self {
        Self {
            host: profile.host.clone(),
            port: profile.port,
            username: profile.username.clone(),
            password: profile.password.clone(),
            database: profile.database.clone(),
            charset: profile.charset.clone(),
            collation: profile.collation.clone(),
            timeout_seconds: profile.timeout,
            ssl_mode: profile.ssl_mode.clone(),
            ssl_ca_path: profile.ssl_ca_path.clone(),
            ssl_cert_path: profile.ssl_cert_path.clone(),
            ssl_key_path: profile.ssl_key_path.clone(),
            max_pool_size: Some(10),
            min_idle: Some(2),
            idle_timeout_ms: Some(600_000),
            max_lifetime_ms: Some(1_800_000),
            connection_timeout_ms: Some(profile.connection_timeout.unwrap_or(30) * 1000),
            create_timeout_ms: None,
            recycle_timeout_ms: None,
            current_database: profile.database.clone(),
            keepalive_interval_secs: Some(30),
        }
    }

    pub fn connection_key(&self) -> String {
        format!(
            "{}:{}:{}:{}:{}",
            self.host, self.port, self.username,
            self.ssl_mode.as_deref().unwrap_or(""),
            self.ssl_ca_path.as_deref().unwrap_or("")
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolStats {
    pub pool_id: u64,
    pub total_connections: usize,
    pub active_connections: usize,
    pub idle_connections: usize,
    pub max_size: usize,
    pub waiting_threads: usize,
    // 连接池生命周期统计（V2 审计新增）：
    // - total_pool_creates: 池创建次数
    // - total_pool_reuses:  共享池复用次数（get_or_create_pool 命中）
    // - total_conn_acquires: 连接租约累计获取次数（pool_get_connection）
    // - total_conn_releases: 连接租约累计归还次数（pool_release_connection 成功）
    //   归还率 = total_conn_releases / total_conn_acquires；
    //   差值应等于当前未归还租约数（total_connections），若有偏差说明存在泄漏路径。
    pub total_pool_creates: u64,
    pub total_pool_reuses: u64,
    pub total_conn_acquires: u64,
    pub total_conn_releases: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedPoolStats {
    pub pool_id: u64,
    pub total_connections: usize,
    pub active_connections: usize,
    pub idle_connections: usize,
    pub max_size: usize,
    pub waiting_threads: usize,
    pub active_connection_ids: Vec<u64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveConnectionInfo {
    pub conn_id: u64,
    pub pool_id: u64,
    pub current_database: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProperties {
    #[serde(rename = "connectionStatus")]
    pub connection_status: bool,
    #[serde(rename = "serverVersion")]
    pub server_version: Option<String>,
    #[serde(rename = "currentDatabase")]
    pub current_database: Option<String>,
    #[serde(rename = "connectionCharset")]
    pub connection_charset: Option<String>,
    #[serde(rename = "waitTimeoutSeconds")]
    pub wait_timeout_seconds: Option<u64>,
    #[serde(rename = "sslMode")]
    pub ssl_mode: Option<String>,
    #[serde(rename = "tableCount")]
    pub table_count: Option<u64>,
    #[serde(rename = "viewCount")]
    pub view_count: Option<u64>,
    #[serde(rename = "functionCount")]
    pub function_count: Option<u64>,
    #[serde(rename = "procedureCount")]
    pub procedure_count: Option<u64>,
}
