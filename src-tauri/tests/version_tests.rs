use database_workbench_lib::core::update::{checker, netprobe};

#[test]
fn test_update_info_serialization() {
    let info = checker::UpdateInfo {
        available: true,
        version: "0.2.0".into(),
        notes: "Bug fixes and improvements".into(),
        published_at: "2026-08-07T00:00:00Z".into(),
        download_url: "https://github.com/example/dl".into(),
        sha256: "0123456789abcdef".into(),
        source: "https://github.com/example/latest.json".into(),
    };
    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("available"));
    assert!(json.contains("downloadUrl"));
    assert!(json.contains("sha256"));
    assert!(json.contains("source"));
    assert!(json.contains("body"));
    assert!(json.contains("date"));
}

#[test]
fn test_latest_json_candidates_are_github_first() {
    let candidates = netprobe::latest_json_candidates();
    assert!(!candidates.is_empty());
    assert!(candidates[0].starts_with("https://github.com/"));
    for candidate in &candidates {
        assert!(candidate.ends_with("/latest.json"));
    }
}

#[test]
fn test_installer_candidates_are_github_first() {
    let url = "https://github.com/KevinT-hub/database-workbench/releases/download/v0.1.0/app.exe";
    let candidates = netprobe::installer_candidates(url);
    assert_eq!(candidates[0], url);
    assert!(candidates.len() >= 2);
}
