use crate::errors::{AppResult, AppError};
use crate::models::user::*;
use tauri::State;
use crate::core::pool::manager::PoolRegistry;
use crate::models::connection::ConnectionProfile;
use crate::core::database::traits::DatabaseAdapter;

#[tauri::command]
pub async fn metadata_get_all_users(profile: ConnectionProfile, state: State<'_, PoolRegistry>) -> AppResult<Vec<UserSummary>> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_all_users(&handle).await
}

#[tauri::command]
pub async fn metadata_get_user_detail(profile: ConnectionProfile, username: String, host: String, state: State<'_, PoolRegistry>) -> AppResult<String> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_user_detail(&handle, &username, &host).await
}

#[tauri::command]
pub async fn metadata_get_user_model(profile: ConnectionProfile, username: String, host: String, state: State<'_, PoolRegistry>) -> AppResult<UserModelPayload> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_user_model(&handle, &username, &host).await
}

#[tauri::command]
pub fn metadata_generate_user_sql(user: UserModel, is_new_user: bool, original: Option<UserModel>) -> String {
    let adapter = crate::core::database::mysql::adapter::MysqlAdapter;
    adapter.generate_user_sql(&user, is_new_user, original.as_ref())
}

#[tauri::command]
pub async fn metadata_execute_sql(profile: ConnectionProfile, sql: String, database: Option<String>, state: State<'_, PoolRegistry>) -> AppResult<()> {
    let pool_id = state.get_or_create_pool(&profile).await?;
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.execute_user_sql(&handle, &sql, database.as_deref()).await
}
