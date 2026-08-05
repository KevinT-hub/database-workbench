use tauri::State;
use crate::errors::{AppResult, AppError};
use crate::core::update::{checker, geo, downloader};

#[tauri::command]
pub async fn updater_check_by_region(cache: State<'_, geo::CountryCodeCache>) -> AppResult<checker::RegionUpdateInfo> {
    let country_code = cache.get().unwrap_or_else(|| "US".into());
    match checker::check_update(&country_code).await {
        Ok(mut info) => {
            info.country_code = country_code;
            Ok(info)
        }
        Err(e) => Err(AppError::Updater(e)),
    }
}

#[tauri::command]
pub async fn updater_download_and_install_by_region(app: tauri::AppHandle) -> AppResult<()> {
    downloader::download_and_install(app).await
}
