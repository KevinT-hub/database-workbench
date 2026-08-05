use crate::errors::AppResult;
use crate::core::query::splitter;
use crate::utils::sql;

#[tauri::command]
pub fn sql_format(sql: String) -> AppResult<String> {
    Ok(sql::format_sql(&sql))
}

#[tauri::command]
pub fn sql_extract_view_select(definition: String) -> AppResult<String> {
    Ok(sql::extract_view_select(&definition))
}

#[tauri::command]
pub fn sql_split_statements(sql: String) -> AppResult<Vec<String>> {
    Ok(splitter::split_statements(&sql))
}
