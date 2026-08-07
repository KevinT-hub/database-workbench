use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use base64::Engine;
use futures_util::StreamExt;
use minisign_verify::{PublicKey, Signature};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use crate::errors::{AppError, AppResult};

use super::netprobe;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(600);
const SPEED_PROBE_SECS: f64 = 5.0;
const MIN_SPEED_BYTES_PER_SEC: f64 = 64.0 * 1024.0;
const STALL_TIMEOUT: Duration = Duration::from_secs(20);

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
    let endpoint_urls = netprobe::latest_json_candidates()
        .iter()
        .filter_map(|url| tauri::Url::parse(url).ok())
        .collect::<Vec<_>>();

    let mut builder = app.updater_builder();
    builder = builder
        .endpoints(endpoint_urls)
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

    let target = tauri_plugin_updater::target()
        .ok_or_else(|| AppError::Updater("Unsupported update target".into()))?;
    let download_url = update.download_url.to_string();
    if !netprobe::is_official_download_url(&download_url) {
        return Err(AppError::Updater(
            "Refusing update URL outside the official GitHub release".into(),
        ));
    }
    let expected_sha256 = update.raw_json["platforms"][&target]["sha256"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| {
            AppError::Updater(format!(
                "sha256 is missing in latest.json for platform {target}"
            ))
        })?;

    let downloaded = AtomicU64::new(0);
    let total = AtomicU64::new(0);
    let started = AtomicBool::new(false);
    let handle = app.clone();
    let finish_handle = handle.clone();

    let mut on_chunk = move |chunk_length: usize, content_length: Option<u64>| {
        if let Some(len) = content_length {
            total.store(len, Ordering::Relaxed);
        }
        let d = downloaded.fetch_add(chunk_length as u64, Ordering::Relaxed) + chunk_length as u64;
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
    };

    let bytes = download_with_mirrors(&download_url, &expected_sha256, &mut on_chunk).await?;

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

    verify_minisign(&bytes, &update.signature, netprobe::UPDATE_PUBKEY)?;
    update
        .install(&bytes)
        .map_err(|e| AppError::Updater(e.to_string()))?;

    Ok(())
}

async fn download_with_mirrors<F>(
    primary_url: &str,
    expected_sha256: &str,
    on_chunk: &mut F,
) -> AppResult<Vec<u8>>
where
    F: FnMut(usize, Option<u64>),
{
    let candidates = netprobe::installer_candidates(primary_url);
    let mut last_error = None;

    for url in candidates {
        match download_one(&url, expected_sha256, on_chunk).await {
            Ok(bytes) => return Ok(bytes),
            Err(error) => {
                eprintln!("[updater] download source failed: {url}: {error}");
                last_error = Some(error);
            }
        }
    }

    Err(AppError::Updater(
        last_error
            .map(|e| e.to_string())
            .unwrap_or_else(|| "All download sources failed".into()),
    ))
}

async fn download_one<F>(
    url: &str,
    expected_sha256: &str,
    on_chunk: &mut F,
) -> AppResult<Vec<u8>>
where
    F: FnMut(usize, Option<u64>),
{
    // Mirrors are untrusted: use a clean client without tokens, cookies or
    // forwarded authorization headers.
    let client = reqwest::Client::builder()
        .user_agent("database-workbench")
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| AppError::Updater(e.to_string()))?;

    let response = client
        .get(url)
        .header("Accept", "application/octet-stream")
        .send()
        .await
        .map_err(|e| AppError::Updater(format!("{url}: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::Updater(format!(
            "{url}: HTTP {}",
            response.status()
        )));
    }

    let content_length = response.content_length();
    let start = Instant::now();
    let mut last_chunk = start;
    let mut buffer = Vec::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| AppError::Updater(format!("{url}: {e}")))?;
        let now = Instant::now();

        let elapsed = now.duration_since(start).as_secs_f64();
        if elapsed >= SPEED_PROBE_SECS
            && (buffer.len() as f64 / elapsed) < MIN_SPEED_BYTES_PER_SEC
        {
            return Err(AppError::Updater(format!(
                "{url}: download too slow ({:.1} KiB/s)",
                buffer.len() as f64 / elapsed / 1024.0
            )));
        }
        if now.duration_since(last_chunk) > STALL_TIMEOUT {
            return Err(AppError::Updater(format!(
                "{url}: download stalled for {}s",
                STALL_TIMEOUT.as_secs()
            )));
        }

        last_chunk = now;
        on_chunk(chunk.len(), content_length);
        buffer.extend_from_slice(&chunk);
    }

    let digest = hex::encode(Sha256::digest(&buffer));
    if !digest.eq_ignore_ascii_case(expected_sha256) {
        return Err(AppError::Updater(format!(
            "{url}: SHA-256 mismatch (expected {expected_sha256}, got {digest})"
        )));
    }

    Ok(buffer)
}

fn verify_minisign(bytes: &[u8], signature_b64: &str, pubkey_b64: &str) -> AppResult<()> {
    let pubkey_bytes = base64::engine::general_purpose::STANDARD
        .decode(pubkey_b64)
        .map_err(|e| AppError::Updater(format!("invalid updater pubkey: {e}")))?;
    let pubkey_str = String::from_utf8(pubkey_bytes)
        .map_err(|e| AppError::Updater(format!("invalid updater pubkey: {e}")))?;
    let public_key = PublicKey::decode(&pubkey_str)
        .map_err(|e| AppError::Updater(format!("invalid updater pubkey: {e}")))?;

    let signature_bytes = base64::engine::general_purpose::STANDARD
        .decode(signature_b64)
        .map_err(|e| AppError::Updater(format!("invalid update signature: {e}")))?;
    let signature_str = String::from_utf8(signature_bytes)
        .map_err(|e| AppError::Updater(format!("invalid update signature: {e}")))?;
    let signature = Signature::decode(&signature_str)
        .map_err(|e| AppError::Updater(format!("invalid update signature: {e}")))?;

    public_key
        .verify(bytes, &signature, true)
        .map_err(|e| AppError::Updater(format!("minisign verification failed: {e}")))
}
