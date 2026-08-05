use crate::errors::AppResult;
use crate::utils;

pub fn backup_default_filename(schema: &str, compressed: bool) -> String {
    let ext = if compressed { "sql.gz" } else { "sql" };
    format!("{}_{}.{}", schema, chrono::Utc::now().format("%Y%m%d_%H%M%S"), ext)
}

pub fn resolve_output_path(schema: &str, requested: Option<&str>, compressed: bool) -> AppResult<String> {
    if let Some(path) = requested {
        return Ok(path.to_string());
    }
    let dir = utils::file::app_data_dir()?.join("backups");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(backup_default_filename(schema, compressed)).to_string_lossy().into())
}
