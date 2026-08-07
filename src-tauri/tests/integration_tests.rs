use database_workbench_lib::services::properties;
use database_workbench_lib::utils::file;
#[test]
fn test_parse_properties_empty() {
    let result = properties::parse_properties("");
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[test]
fn test_parse_properties_comment() {
    let result = properties::parse_properties("# this is a comment\n");
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[test]
fn test_parse_properties_single() {
    let content = r#"test={"host":"localhost","port":3306,"username":"root","password":"","database":"mydb","connection_timeout":30,"db_type":"MYSQL"}"#;
    let result = properties::parse_properties(content);
    assert!(result.is_ok());
    let map = result.unwrap();
    assert_eq!(map.len(), 1);
    assert!(map.contains_key("test"));
}

#[test]
fn test_parse_to_map_basic() {
    let content = "key1=value1\nkey2=value2\n";
    let map = properties::parse_to_map(content);
    assert_eq!(map.len(), 2);
    assert_eq!(map.get("key1").unwrap(), "value1");
    assert_eq!(map.get("key2").unwrap(), "value2");
}

#[test]
fn test_parse_to_map_skips_comments() {
    let content = "# comment\nkey=value\n# another comment";
    let map = properties::parse_to_map(content);
    assert_eq!(map.len(), 1);
    assert_eq!(map.get("key").unwrap(), "value");
}

#[test]
fn test_parse_to_map_skips_empty_lines() {
    let content = "key1=value1\n\nkey2=value2\n";
    let map = properties::parse_to_map(content);
    assert_eq!(map.len(), 2);
}

// ===== Path Utilities =====

#[test]
fn test_app_config_dir() {
    let dir = file::app_config_dir();
    assert!(dir.is_ok());
    let path = dir.unwrap();
    assert!(path.ends_with("dbworkbench"));
}

#[test]
fn test_connections_file_path() {
    let path = file::connections_file_path().unwrap();
    assert!(path.to_string_lossy().ends_with("connections.properties"));
}

#[test]
fn test_favorites_file_path() {
    let path = file::favorites_file_path().unwrap();
    assert!(path.to_string_lossy().ends_with("favorites.json"));
}

#[test]
fn test_app_config_file_path() {
    let path = file::app_config_file_path().unwrap();
    assert!(path.to_string_lossy().ends_with("app.properties"));
}

#[test]
fn test_string_compact_preview() {
    let s = "SELECT * FROM users WHERE name = 'Alice'";
    let result = database_workbench_lib::utils::string::compact_sql_preview(s, 20);
    assert!(result.contains("..."));
    assert!(result.len() <= 23);
}

#[test]
fn test_string_compact_preview_no_truncate() {
    let s = "SELECT 1";
    let result = database_workbench_lib::utils::string::compact_sql_preview(s, 20);
    assert_eq!(result, "SELECT 1");
}

#[test]
fn test_json_parse_canonical() {
    let result = database_workbench_lib::utils::json::parse_to_canonical_json(r#"{"a":1,"b":"hello"}"#);
    assert!(result.is_ok());
}

#[test]
fn test_json_parse_invalid() {
    let result = database_workbench_lib::utils::json::parse_to_canonical_json("not json");
    assert!(result.is_err());
}

#[test]
fn test_error_conversion() {
    use database_workbench_lib::errors::AppError;
    let err = database_workbench_lib::utils::error::to_app_error("test error");
    match err {
        AppError::Internal(msg) => assert!(msg.contains("test error")),
        _ => panic!("wrong error variant"),
    }
}

#[test]
fn test_sql_split_session_store_create() {
    let store = database_workbench_lib::core::query::session::SqlSplitSessionStore::new();
    let id = store.create(vec!["SELECT 1".into(), "SELECT 2".into()], "mysql".into());
    assert!(id > 0);
    let statements = store.get(id).unwrap();
    assert_eq!(statements.len(), 2);
}

#[test]
fn test_sql_split_session_store_release() {
    let store = database_workbench_lib::core::query::session::SqlSplitSessionStore::new();
    let id = store.create(vec!["SELECT 1".into()], "mysql".into());
    assert!(store.release(id));
    assert!(!store.release(id));
}

#[test]
fn test_pool_registry_basic() {
    let registry = database_workbench_lib::core::pool::manager::PoolRegistry::new();
    let id1 = registry.allocate_pool_id();
    let id2 = registry.allocate_pool_id();
    assert!(id2 > id1);
    let cid = registry.allocate_conn_id();
    assert!(cid > 0);
}

#[test]
fn test_pool_registry_connection() {
    let registry = database_workbench_lib::core::pool::manager::PoolRegistry::new();
    registry.register_connection(1, 100);
    assert!(registry.release_connection(1, 100));
    assert!(!registry.release_connection(1, 100));
}

#[test]
fn test_pool_registry_close() {
    let registry = database_workbench_lib::core::pool::manager::PoolRegistry::new();
    registry.register_connection(1, 100);
    registry.close_pool(1);
    assert!(!registry.release_connection(1, 100));
}

#[test]
fn test_keepalive_manager() {
    let mut km = database_workbench_lib::core::pool::keepalive::KeepaliveManager::new(30);
    km.set_default_interval(60);
    assert_eq!(km.get_default_interval().as_secs(), 60);
}

#[test]
fn test_scheduler_handle() {
    use database_workbench_lib::core::backup_restore::scheduler::SchedulerHandle;
    use database_workbench_lib::models::backup::ScheduleRequest;
    use database_workbench_lib::models::backup::BackupRequest;
    use database_workbench_lib::models::backup::BackupOptions;
    use database_workbench_lib::models::connection::ConnectionProfile;
    use database_workbench_lib::models::connection::DbType;

    let sh = SchedulerHandle::new();
    let req = ScheduleRequest {
        schedule_id: "test".into(),
        cron: "0 0 * * *".into(),
        backup: BackupRequest {
            conn: ConnectionProfile {
                name: None, host: "localhost".into(), port: 3306, username: "root".into(),
                password: "".into(), database: None, charset: None, collation: None, timeout: None,
                connection_timeout: Some(30), ssl: None, ssl_mode: None,
                ssl_ca_path: None, ssl_cert_path: None, ssl_key_path: None, db_type: DbType::Mysql,
            },
            schema: "test".into(),
            output_path: "/tmp/test.sql".into(),
            mysqldump_path: None,
            selected_tables: None, selected_views: None, selected_routines: None,
            options: BackupOptions {
                include_structure: true, include_data: true, include_views: true,
                include_routines: true, include_triggers: true, add_drop_table: true,
                use_transaction: true, compress_output: false,
                compression_level: None, insert_batch_size: None,
            },
        },
    };
    let id = sh.add(req.clone());
    assert!(id > 0);
    assert!(sh.remove(id));
    assert!(!sh.remove(id));
}

#[test]
fn test_export_format_parse() {
    use database_workbench_lib::core::import_export::{ExportFormat, ImportFormat};
    assert!(ExportFormat::from_str("csv").is_some());
    assert!(ExportFormat::from_str("json").is_some());
    assert!(ExportFormat::from_str("xlsx").is_some());
    assert!(ExportFormat::from_str("invalid").is_none());
    assert!(ImportFormat::from_str("csv").is_some());
    assert!(ImportFormat::from_str("jsonl").is_some());
}

#[test]
fn test_metadata_types_serialization() {
    use database_workbench_lib::models::metadata::*;
    let td = TableDetail {
        name: "users".into(), rows: Some(100), data_length: Some(16384),
        engine: Some("InnoDB".into()), update_time: None, comment: Some("User table".into()),
    };
    let json = serde_json::to_string(&td).unwrap();
    assert!(json.contains("Name"));
    assert!(json.contains("Rows"));
    assert!(json.contains("InnoDB"));
}
