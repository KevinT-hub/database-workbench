use tauri::State;
use crate::errors::{AppResult, AppError};
use crate::models::connection::ConnectionProfile;
use crate::models::metadata::*;
use crate::core::pool::manager::PoolRegistry;

#[tauri::command]
pub async fn metadata_list_databases(profile: ConnectionProfile, state: State<'_, PoolRegistry>) -> AppResult<Vec<String>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_databases(&handle).await
}

#[tauri::command]
pub async fn metadata_get_all_databases(profile: ConnectionProfile, state: State<'_, PoolRegistry>) -> AppResult<Vec<String>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_all_databases(&handle).await
}

#[tauri::command]
pub async fn metadata_list_tables(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<String>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_tables(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_table_details(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<TableDetail>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_table_details(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_views(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<String>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_views(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_view_details(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<ViewDetail>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_view_details(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_functions(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<String>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_functions(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_function_details(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<FunctionDetail>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_function_details(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_list_routines_with_details(profile: ConnectionProfile, schema: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<RoutineDetail>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_routines_with_details(&handle, &schema).await
}

#[tauri::command]
pub async fn metadata_get_function_ddl(profile: ConnectionProfile, schema: String, name: String, routine_type: String, state: State<'_, PoolRegistry>) -> AppResult<String> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_function_ddl(&handle, &schema, &name, &routine_type).await
}

#[tauri::command]
pub async fn metadata_get_routine_params(profile: ConnectionProfile, schema: String, name: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<RoutineParam>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_routine_params(&handle, &schema, &name).await
}

#[tauri::command]
pub async fn metadata_list_columns(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<ColumnInfo>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_columns(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_list_foreign_keys(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<ForeignKeyInfo>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_foreign_keys(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_list_indexes(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<IndexInfo>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_indexes(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_list_triggers(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<TriggerInfo>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_triggers(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_list_checks(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<Vec<CheckInfo>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.list_checks(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_load_ddl(profile: ConnectionProfile, schema: String, table: String, state: State<'_, PoolRegistry>) -> AppResult<String> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.load_ddl(&handle, &schema, &table).await
}

#[tauri::command]
pub async fn metadata_get_current_user_info(profile: ConnectionProfile, state: State<'_, PoolRegistry>) -> AppResult<String> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_current_user_info(&handle).await
}
