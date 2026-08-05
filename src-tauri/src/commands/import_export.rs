use tauri::State;
use crate::errors::{AppResult, AppError};
use crate::models::connection::ConnectionProfile;
use crate::models::import_export::*;
use crate::core::pool::manager::PoolRegistry;
use crate::core::import_export::{ExportFormat, ImportFormat};

#[tauri::command]
pub async fn export_table(profile: ConnectionProfile, schema: String, table: String, format: String, output_path: String, state: State<'_, PoolRegistry>) -> AppResult<ExportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let fmt = ExportFormat::from_str(&format).unwrap_or(ExportFormat::Csv);
    crate::core::import_export::export_table(&*adapter, &handle, &schema, &table, fmt, &output_path).await
}

#[tauri::command]
pub async fn export_query_result(profile: ConnectionProfile, sql: String, format: String, output_path: String, schema: Option<String>, table: Option<String>, state: State<'_, PoolRegistry>) -> AppResult<ExportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let fmt = ExportFormat::from_str(&format).unwrap_or(ExportFormat::Csv);
    crate::core::import_export::export_query_result(
        &*adapter,
        &handle,
        &sql,
        fmt,
        &output_path,
        schema.as_deref(),
        table.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn export_query_result_csv(profile: ConnectionProfile, sql: String, output_path: String, state: State<'_, PoolRegistry>) -> AppResult<ExportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::export_query_result(&*adapter, &handle, &sql, ExportFormat::Csv, &output_path, None, None).await
}

#[tauri::command]
pub async fn export_to_csv(profile: ConnectionProfile, schema: String, table: String, output_path: String, state: State<'_, PoolRegistry>) -> AppResult<ExportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::export_table(&*adapter, &handle, &schema, &table, ExportFormat::Csv, &output_path).await
}

#[tauri::command]
pub async fn export_to_jsonl(profile: ConnectionProfile, sql: String, output_path: String, state: State<'_, PoolRegistry>) -> AppResult<ExportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::export_query_result(&*adapter, &handle, &sql, ExportFormat::Jsonl, &output_path, None, None).await
}

#[tauri::command]
pub async fn import_table(profile: ConnectionProfile, schema: String, table: String, format: String, input_path: String, state: State<'_, PoolRegistry>) -> AppResult<ImportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    let fmt = ImportFormat::from_str(&format).unwrap_or(ImportFormat::Csv);
    crate::core::import_export::import_table(&*adapter, &handle, &schema, &table, fmt, &input_path).await
}

#[tauri::command]
pub async fn import_from_csv(profile: ConnectionProfile, schema: String, table: String, input_path: String, state: State<'_, PoolRegistry>) -> AppResult<ImportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::import_table(&*adapter, &handle, &schema, &table, ImportFormat::Csv, &input_path).await
}

#[tauri::command]
pub async fn import_from_json(profile: ConnectionProfile, schema: String, table: String, input_path: String, state: State<'_, PoolRegistry>) -> AppResult<ImportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::import_table(&*adapter, &handle, &schema, &table, ImportFormat::Json, &input_path).await
}

#[tauri::command]
pub async fn import_from_jsonl(profile: ConnectionProfile, schema: String, table: String, input_path: String, state: State<'_, PoolRegistry>) -> AppResult<ImportResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::import_export::import_table(&*adapter, &handle, &schema, &table, ImportFormat::Jsonl, &input_path).await
}
