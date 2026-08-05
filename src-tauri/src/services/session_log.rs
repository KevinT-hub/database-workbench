use std::io::Write;
use std::sync::Mutex;
use tauri::Window;
use tauri::Emitter;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionLogEntry {
    #[serde(rename = "timestampMs")]
    pub timestamp_ms: u64,
    #[serde(rename = "poolId")]
    pub pool_id: u64,
    #[serde(rename = "connId")]
    pub conn_id: u64,
    pub sql: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    #[serde(rename = "affectedRows")]
    pub affected_rows: u64,
    #[serde(rename = "isWrite")]
    pub is_write: bool,
}

pub struct SessionLogger {
    enabled: Mutex<bool>,
}

impl SessionLogger {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            enabled: Mutex::new(true),
        })
    }

    pub fn shutdown(&self) {
        if let Ok(mut e) = self.enabled.lock() {
            *e = false;
        }
    }

    pub fn log(&self, _message: &str) {
        if let Ok(enabled) = self.enabled.lock() {
            if *enabled {
                let _ = writeln!(std::io::stderr(), "[SQL] {}", _message);
            }
        }
    }

    pub fn emit(&self, window: &Window, pool_id: u64, conn_id: u64, sql: &str, duration_secs: f64, affected_rows: u64, is_write: bool) {
        if let Ok(enabled) = self.enabled.lock() {
            if *enabled {
                let entry = ExecutionLogEntry {
                    timestamp_ms: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    pool_id,
                    conn_id,
                    sql: sql.to_string(),
                    duration_ms: (duration_secs * 1000.0) as u64,
                    affected_rows,
                    is_write,
                };
                let _ = window.emit("dbw:execution-log", &entry);
            }
        }
    }
}
