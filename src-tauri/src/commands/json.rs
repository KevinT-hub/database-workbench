use crate::errors::AppResult;
use crate::utils::json;

#[tauri::command]
pub fn json_parse_canonical(input: String) -> AppResult<String> {
    let value = json::parse_to_canonical_json(&input).map_err(|e| crate::errors::AppError::InvalidInput(e))?;
    Ok(serde_json::to_string(&value).unwrap_or_default())
}
