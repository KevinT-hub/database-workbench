use std::collections::HashMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::netprobe;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    #[serde(rename = "body")]
    pub notes: String,
    #[serde(rename = "date")]
    pub published_at: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    pub sha256: String,
    #[serde(rename = "source")]
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct LatestJson {
    version: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    pub_date: String,
    #[serde(default)]
    platforms: HashMap<String, PlatformEntry>,
}

#[derive(Debug, Deserialize)]
struct PlatformEntry {
    #[serde(default)]
    url: String,
    #[serde(default)]
    signature: String,
    #[serde(default)]
    sha256: String,
}

/// Checks the stable update channel. GitHub is tried first; the verified
/// mirrors are only used when GitHub is unreachable or too slow.
pub async fn check_update() -> Result<UpdateInfo, String> {
    let platform = current_platform_key();
    let mut last_error = None;

    for endpoint in netprobe::latest_json_candidates() {
        match fetch_latest_json(&endpoint).await {
            Ok(json) => {
                let entry = json.platforms.get(platform).ok_or_else(|| {
                    format!("No updater entry for platform {platform} in {endpoint}")
                })?;
                if entry.url.is_empty() || entry.signature.is_empty() || entry.sha256.is_empty() {
                    return Err(format!(
                        "Incomplete updater metadata for {platform} in {endpoint}"
                    ));
                }

                let current = env!("CARGO_PKG_VERSION");
                let has_update = compare_versions(&json.version, current);
                return Ok(UpdateInfo {
                    available: has_update,
                    version: json.version,
                    notes: json.notes,
                    published_at: json.pub_date,
                    download_url: entry.url.clone(),
                    sha256: entry.sha256.clone(),
                    source: endpoint,
                });
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "No update endpoint available".into()))
}

async fn fetch_latest_json(endpoint: &str) -> Result<LatestJson, String> {
    let client = reqwest::Client::builder()
        .user_agent("database-workbench")
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(endpoint).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

fn current_platform_key() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "windows-x86_64"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "darwin-x86_64"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "darwin-aarch64"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "linux-x86_64"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "linux-aarch64"
    }
    #[cfg(not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64")
    )))]
    {
        "windows-x86_64"
    }
}

fn compare_versions(latest: &str, current: &str) -> bool {
    let l: Vec<u32> = latest.split('.').filter_map(|s| s.parse().ok()).collect();
    let c: Vec<u32> = current.split('.').filter_map(|s| s.parse().ok()).collect();
    for i in 0..std::cmp::max(l.len(), c.len()) {
        let lv = l.get(i).copied().unwrap_or(0);
        let cv = c.get(i).copied().unwrap_or(0);
        if lv > cv {
            return true;
        }
        if lv < cv {
            return false;
        }
    }
    false
}
