use crate::errors::{AppResult, AppError};
use crate::core::update::{checker, downloader};

#[tauri::command]
pub async fn updater_check() -> AppResult<checker::UpdateInfo> {
    checker::check_update().await.map_err(AppError::Updater)
}

#[tauri::command]
pub async fn updater_download_and_install(app: tauri::AppHandle) -> AppResult<()> {
    downloader::download_and_install(app).await
}
