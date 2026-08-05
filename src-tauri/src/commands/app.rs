use tauri::State;
use crate::errors::AppResult;
use crate::services::app_config::ConfigCache;

#[tauri::command]
pub fn app_config_get(key: String, cache: State<'_, ConfigCache>) -> AppResult<Option<String>> {
    Ok(cache.get(&key))
}

#[tauri::command]
pub fn app_config_set(key: String, value: String, cache: State<'_, ConfigCache>) -> AppResult<()> {
    cache.set(key, value);
    Ok(())
}

#[tauri::command]
pub fn app_config_flush(cache: State<'_, ConfigCache>) -> AppResult<()> {
    cache.flush();
    Ok(())
}

#[tauri::command]
pub fn app_invalidate_runtime_cache() -> AppResult<()> {
    Ok(())
}
