use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use crate::errors::{AppError, AppResult};
use super::{endpoints, geo};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterDownloadProgressEvent {
    pub event: String,
    pub content_length: Option<u64>,
    pub chunk_length: Option<u64>,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percentage: Option<u64>,
}

pub async fn download_and_install(app: AppHandle) -> AppResult<()> {
    // Pick the endpoint order based on the region detected at startup:
    // CN -> Gitee first (GitHub fallback), otherwise GitHub first (Gitee fallback).
    let country_code = app
        .try_state::<geo::CountryCodeCache>()
        .and_then(|cache| cache.get())
        .unwrap_or_else(|| "US".to_string());

    let endpoint_urls = endpoints::endpoints_for_country(&country_code);
    let urls = endpoint_urls
        .iter()
        .filter_map(|url| tauri::Url::parse(url).ok())
        .collect::<Vec<_>>();

    let mut builder = app.updater_builder();
    builder = builder
        .endpoints(urls)
        .map_err(|e| AppError::Updater(e.to_string()))?;
    let updater = builder
        .build()
        .map_err(|e| AppError::Updater(e.to_string()))?;

    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    let Some(update) = update else {
        return Ok(());
    };

    let downloaded = AtomicU64::new(0);
    let total = AtomicU64::new(0);
    let started = AtomicBool::new(false);
    let handle = app.clone();
    let finish_handle = handle.clone();

    update
        .download_and_install(
            move |chunk_length, content_length| {
                if let Some(len) = content_length {
                    total.store(len, Ordering::Relaxed);
                }
                let d = downloaded.fetch_add(chunk_length as u64, Ordering::Relaxed)
                    + chunk_length as u64;
                let t = total.load(Ordering::Relaxed);
                let percentage = if t > 0 {
                    ((d as f64 / t as f64) * 100.0).min(100.0).round() as u64
                } else {
                    0
                };

                if !started.swap(true, Ordering::Relaxed) {
                    let _ = handle.emit(
                        "updater-download-progress",
                        UpdaterDownloadProgressEvent {
                            event: "Started".into(),
                            content_length,
                            chunk_length: None,
                            downloaded: 0,
                            total: content_length,
                            percentage: Some(0),
                        },
                    );
                }

                let _ = handle.emit(
                    "updater-download-progress",
                    UpdaterDownloadProgressEvent {
                        event: "Progress".into(),
                        content_length: None,
                        chunk_length: Some(chunk_length as u64),
                        downloaded: d,
                        total: if t > 0 { Some(t) } else { None },
                        percentage: Some(percentage),
                    },
                );
            },
            move || {
                let _ = finish_handle.emit(
                    "updater-download-progress",
                    UpdaterDownloadProgressEvent {
                        event: "Finished".into(),
                        content_length: None,
                        chunk_length: None,
                        downloaded: 1,
                        total: Some(1),
                        percentage: Some(100),
                    },
                );
            },
        )
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    Ok(())
}
