use tauri::State;
use crate::errors::{AppResult, AppError};
use crate::models::backup::*;
use crate::core::backup_restore::scheduler::SchedulerHandle;
use crate::core::pool::manager::PoolRegistry;
use crate::models::connection::ConnectionProfile;

#[tauri::command]
pub async fn backup_execute(
    profile: ConnectionProfile,
    options: BackupOptions,
    output_path: String,
    schema: String,
    selected_tables: Option<Vec<String>>,
    selected_views: Option<Vec<String>>,
    selected_routines: Option<Vec<String>>,
    state: State<'_, PoolRegistry>,
) -> AppResult<BackupResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::backup_restore::backup::execute_backup(
        &*adapter, &handle, &options, &output_path, &schema, &profile,
        selected_tables.as_deref(), selected_views.as_deref(), selected_routines.as_deref(),
    ).await
}

#[tauri::command]
pub async fn restore_execute(profile: ConnectionProfile, request: RestoreRequest, state: State<'_, PoolRegistry>) -> AppResult<RestoreResult> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    crate::core::backup_restore::restore::execute_restore(&*adapter, &handle, &request).await
}

#[tauri::command]
pub fn schedule_add(request: ScheduleRequest, scheduler: State<'_, SchedulerHandle>) -> AppResult<u64> {
    Ok(scheduler.add(request))
}

#[tauri::command]
pub fn schedule_remove(schedule_id: u64, scheduler: State<'_, SchedulerHandle>) -> AppResult<bool> {
    Ok(scheduler.remove(schedule_id))
}

#[tauri::command]
pub fn schedule_list(scheduler: State<'_, SchedulerHandle>) -> AppResult<Vec<(u64, ScheduleRequest)>> {
    Ok(scheduler.list())
}
