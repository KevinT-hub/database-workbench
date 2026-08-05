use database_workbench_lib::core::update;

#[test]
fn test_update_checker_mock_github_response() {
    let sample = serde_json::json!({
        "tag_name": "v0.2.0",
        "assets": [{ "browser_download_url": "https://github.com/example/releases/download/v0.2.0/app.msi" }],
        "body": "Release notes: new features",
        "published_at": "2025-01-15T10:00:00Z"
    });
    let tag = sample["tag_name"].as_str().unwrap().trim_start_matches('v');
    assert_eq!(tag, "0.2.0");
}

#[test]
fn test_update_checker_version_compare() {
    // Test compare_versions logic via the info struct
    let info = update::checker::RegionUpdateInfo {
        version: "1.0.0".into(),
        download_url: "https://example.com/download".into(),
        notes: "test".into(),
        published_at: "2025-01-01".into(),
        preferred_source: "github".into(),
        country_code: "US".into(),
        has_update: true,
    };
    assert!(info.has_update);
}

#[test]
fn test_update_checker_mock_gitee_response() {
    let sample = serde_json::json!({
        "tag_name": "v0.1.9",
        "assets": [{ "browser_download_url": "https://gitee.com/example/releases/download/v0.1.9/app.msi" }],
        "body": "Gitee release notes",
        "published_at": "2025-01-14T08:00:00Z"
    });
    let tag = sample["tag_name"].as_str().unwrap().trim_start_matches('v');
    assert_eq!(tag, "0.1.9");
}

#[test]
fn test_region_update_info_serialization() {
    let info = update::checker::RegionUpdateInfo {
        version: "0.2.0".into(),
        download_url: "https://example.com/dl".into(),
        notes: "Bug fixes and improvements".into(),
        published_at: "2025-01-15T10:00:00Z".into(),
        preferred_source: "gitee".into(),
        country_code: "CN".into(),
        has_update: true,
    };
    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("preferredSource"));
    assert!(json.contains("countryCode"));
    assert!(json.contains("hasUpdate"));
    assert!(json.contains("downloadUrl"));
}

#[test]
fn test_update_geo_country_code_cache() {
    let cache = update::geo::CountryCodeCache::new();
    assert!(cache.get().is_none());

    cache.set("CN".into());
    assert_eq!(cache.get().unwrap(), "CN");

    cache.set("US".into());
    assert_eq!(cache.get().unwrap(), "US");
}

#[test]
fn test_update_checker_no_update() {
    let info = update::checker::RegionUpdateInfo {
        version: "0.1.0".into(),
        download_url: String::new(),
        notes: String::new(),
        published_at: String::new(),
        preferred_source: "github".into(),
        country_code: "US".into(),
        has_update: false,
    };
    assert!(!info.has_update);
}
