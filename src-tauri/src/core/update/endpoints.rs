/// Central place for update channel endpoints.
///
/// The updater channel is a release tagged `update` on both GitHub and Gitee.
/// It carries a single `latest.json` asset, mirroring the clash-verge-rev
/// "updater release" practice.
pub const GITHUB_OWNER: &str = "KevinT-hub";
pub const GITHUB_REPO: &str = "database-workbench";
pub const GITEE_OWNER: &str = "kevint-hub";
pub const GITEE_REPO: &str = "database-workbench";

/// Release tag that hosts the stable `latest.json`.
pub const UPDATE_TAG: &str = "update";
pub const LATEST_JSON_FILE: &str = "latest.json";

pub fn github_latest_json_url() -> String {
    format!(
        "https://github.com/{}/{}/releases/download/{}/{}",
        GITHUB_OWNER,
        GITHUB_REPO,
        UPDATE_TAG,
        LATEST_JSON_FILE
    )
}

pub fn gitee_latest_json_url() -> String {
    format!(
        "https://gitee.com/{}/{}/releases/download/{}/{}",
        GITEE_OWNER,
        GITEE_REPO,
        UPDATE_TAG,
        LATEST_JSON_FILE
    )
}

/// Returns the update endpoints in preference order for a country code.
///
/// China users prefer Gitee and fall back to GitHub; everyone else prefers
/// GitHub and falls back to Gitee. Unknown regions default to GitHub first,
/// which still falls back to Gitee when the first endpoint is unreachable.
pub fn endpoints_for_country(country_code: &str) -> Vec<String> {
    if country_code.eq_ignore_ascii_case("CN") {
        vec![gitee_latest_json_url(), github_latest_json_url()]
    } else {
        vec![github_latest_json_url(), gitee_latest_json_url()]
    }
}
