use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use super::endpoints;

const WINDOWS_TARGET: &str = "windows-x86_64";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionUpdateInfo {
    pub available: bool,
    pub version: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "body")]
    pub notes: String,
    #[serde(rename = "date")]
    pub published_at: String,
    #[serde(rename = "preferredSource")]
    pub preferred_source: String,
    #[serde(rename = "countryCode")]
    pub country_code: String,
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
    #[allow(dead_code)]
    signature: String,
}

pub async fn check_update(country_code: &str) -> Result<RegionUpdateInfo, String> {
    let is_china = country_code == "CN";

    if is_china {
        let result = check_source(&endpoints::gitee_latest_json_url(), "gitee").await;
        if result.is_ok() {
            return result;
        }
        check_source(&endpoints::github_latest_json_url(), "github-fallback").await
    } else {
        let result = check_source(&endpoints::github_latest_json_url(), "github").await;
        if result.is_ok() {
            return result;
        }
        check_source(&endpoints::gitee_latest_json_url(), "gitee-fallback").await
    }
}

async fn check_source(endpoint: &str, source: &str) -> Result<RegionUpdateInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("database-workbench")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(endpoint).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let json: LatestJson = resp.json().await.map_err(|e| e.to_string())?;
    let current = env!("CARGO_PKG_VERSION");
    let has_update = compare_versions(&json.version, current);
    let download_url = json
        .platforms
        .get(WINDOWS_TARGET)
        .map(|p| p.url.clone())
        .unwrap_or_default();

    Ok(RegionUpdateInfo {
        available: has_update,
        version: json.version,
        download_url,
        notes: json.notes,
        published_at: json.pub_date,
        preferred_source: source.to_string(),
        country_code: String::new(),
    })
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
