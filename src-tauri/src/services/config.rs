use crate::errors::{AppResult, AppError};
use crate::utils::file;
use crate::services::properties;
use std::collections::BTreeMap;
use crate::models::connection::ConnectionProfile;

pub type ConnectionMap = BTreeMap<String, ConnectionProfile>;

pub fn load_connections() -> AppResult<ConnectionMap> {
    let path = file::connections_file_path()?;
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Config(format!("Failed to read connections: {e}")))?;
    properties::parse_properties(&content)
}

pub fn save_connections(connections: &ConnectionMap) -> AppResult<()> {
    let path = file::connections_file_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(e))?;
    }
    let mut content = String::new();
    for (name, profile) in connections {
        let json = serde_json::to_string(profile)?;
        content.push_str(&format!("{}={}\n", name, json));
    }
    std::fs::write(&path, content)
        .map_err(|e| AppError::Io(e))?;
    Ok(())
}

pub fn import_connections(file_path: &str) -> AppResult<ConnectionMap> {
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| AppError::Config(format!("Failed to read import file: {e}")))?;
    properties::parse_properties(&content)
}

pub fn export_connections(connections: &ConnectionMap, file_path: &str) -> AppResult<()> {
    let temp_path = file_path.to_string();
    save_connections_to_file(connections, &temp_path)
}

fn save_connections_to_file(connections: &ConnectionMap, file_path: &str) -> AppResult<()> {
    let mut content = String::new();
    for (name, profile) in connections {
        let json = serde_json::to_string(profile)?;
        content.push_str(&format!("{}={}\n", name, json));
    }
    std::fs::write(file_path, content)
        .map_err(|e| AppError::Io(e))?;
    Ok(())
}
