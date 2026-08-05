use std::path::PathBuf;
use crate::errors::{AppResult, AppError};

pub fn app_config_dir() -> AppResult<PathBuf> {
    dirs::config_dir()
        .map(|p| p.join("dbworkbench"))
        .ok_or_else(|| AppError::InvalidPath("无法解析系统配置目录".into()))
}

pub fn app_data_dir() -> AppResult<PathBuf> {
    dirs::data_dir()
        .map(|p| p.join("dbworkbench"))
        .ok_or_else(|| AppError::InvalidPath("无法解析系统数据目录".into()))
}

pub fn app_cache_dir() -> AppResult<PathBuf> {
    dirs::cache_dir()
        .map(|p| p.join("dbworkbench"))
        .ok_or_else(|| AppError::InvalidPath("无法解析系统缓存目录".into()))
}

pub fn legacy_app_data_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".database-workbench"))
}

pub fn connections_file_path() -> AppResult<PathBuf> { Ok(app_config_dir()?.join("connections.properties")) }
pub fn app_config_file_path() -> AppResult<PathBuf> { Ok(app_config_dir()?.join("app.properties")) }
pub fn favorites_file_path() -> AppResult<PathBuf> { Ok(app_config_dir()?.join("favorites.json")) }
pub fn session_log_dir() -> AppResult<PathBuf> { Ok(app_data_dir()?.join("logs")) }
pub fn country_code_cache_file_path() -> AppResult<PathBuf> { Ok(app_cache_dir()?.join("country_code.cache")) }

pub fn read_sql_file_maybe_gz(file_path: &str) -> AppResult<String> {
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        return Err(AppError::FileNotFound(file_path.to_string()));
    }
    let bytes = std::fs::read(path).map_err(|e| AppError::Io(e))?;
    if file_path.ends_with(".gz") {
        use std::io::Read;
        let mut decoder = flate2::read::GzDecoder::new(&bytes[..]);
        let mut content = String::new();
        decoder.read_to_string(&mut content).map_err(|e| AppError::Io(e))?;
        Ok(content)
    } else {
        String::from_utf8(bytes).map_err(|e| AppError::Internal(format!("Invalid UTF-8: {e}")))
    }
}
