/// Update source selection with GitHub-first probing and public mirrors.
///
/// Mirrors are treated as untrusted download-only proxies: they only ever
/// receive the public GitHub asset URL and are never sent tokens, cookies or
/// other credentials. The downloaded bytes are always validated with both
/// SHA-256 (published in `latest.json`) and the Tauri minisign signature.
pub const GITHUB_OWNER: &str = "KevinT-hub";
pub const GITHUB_REPO: &str = "database-workbench";
pub const UPDATE_TAG: &str = "update";
pub const LATEST_JSON_FILE: &str = "latest.json";

/// Public GitHub download mirrors verified on 2026-08-07.
///
/// Each entry is used as a prefix: `<mirror><original github.com URL>`.
/// The list intentionally only contains mirrors that returned the real
/// `latest.json` during the aliveness probe.
pub const MIRROR_PREFIXES: &[&str] = &[
    "https://ghfast.top/",
    "https://gh.ddlc.top/",
    "https://ghproxy.sectl.top/",
];

/// Tauri updater public key (also stored in `tauri.conf.json`).
pub const UPDATE_PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEI2OTRDMEQ0NDA0MUI1QUQKUldTdHRVRkExTUNVdHRQNHFmUTlyaEF6a2dObWFEVUg4SHlrbk9UUmx2TDJYT3ZiVFhkU251T3QK";

pub fn github_release_base() -> String {
    format!(
        "https://github.com/{}/{}/releases/download",
        GITHUB_OWNER, GITHUB_REPO
    )
}

pub fn github_latest_json_url() -> String {
    format!(
        "{}/{}/{}",
        github_release_base(),
        UPDATE_TAG,
        LATEST_JSON_FILE
    )
}

/// Mirrors must never be allowed to redirect the installer to a third-party
/// host. Only official GitHub release URLs are accepted as the base URL.
pub fn is_official_download_url(url: &str) -> bool {
    url.starts_with(&format!("{}/", github_release_base()))
}

/// `latest.json` URLs in preference order: GitHub first, then mirrors.
pub fn latest_json_candidates() -> Vec<String> {
    let primary = github_latest_json_url();
    let mut candidates = vec![primary.clone()];
    candidates.extend(MIRROR_PREFIXES.iter().map(|prefix| format!("{prefix}{primary}")));
    candidates
}

/// Installer download URLs in preference order: GitHub first, then mirrors.
pub fn installer_candidates(original_url: &str) -> Vec<String> {
    let mut candidates = vec![original_url.to_string()];
    candidates.extend(
        MIRROR_PREFIXES
            .iter()
            .map(|prefix| format!("{prefix}{original_url}")),
    );
    candidates
}
