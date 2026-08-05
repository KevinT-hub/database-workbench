use crate::errors::AppResult;
use crate::services::config::{ConnectionMap, load_connections, save_connections, import_connections, export_connections};

#[tauri::command]
pub fn config_load_connections() -> AppResult<ConnectionMap> {
    load_connections()
}

#[tauri::command]
pub fn config_save_connections(connections: ConnectionMap) -> AppResult<()> {
    save_connections(&connections)
}

#[tauri::command]
pub fn config_import_connections(file_path: String) -> AppResult<ConnectionMap> {
    import_connections(&file_path)
}

#[tauri::command]
pub fn config_export_connections(connections: ConnectionMap, file_path: String) -> AppResult<()> {
    export_connections(&connections, &file_path)
}
