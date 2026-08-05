use database_workbench_lib::models::connection::*;
use database_workbench_lib::models::query::*;
use database_workbench_lib::models::backup::*;
use database_workbench_lib::models::user::*;
use database_workbench_lib::models::import_export::*;
use database_workbench_lib::errors::AppError;

// ===== Connection Models =====

#[test]
fn test_connection_profile_serialization() {
    let profile = ConnectionProfile {
        name: Some("test".into()),
        host: "localhost".into(),
        port: 3306,
        username: "root".into(),
        password: "".into(),
        database: Some("test_db".into()),
        charset: Some("utf8mb4".into()),
        collation: None,
        timeout: None,
        connection_timeout: Some(30),
        ssl: None,
        ssl_mode: None,
        ssl_ca_path: None,
        ssl_cert_path: None,
        ssl_key_path: None,
        db_type: DbType::Mysql,
    };

    let json = serde_json::to_string(&profile).unwrap();
    let parsed: ConnectionProfile = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.host, "localhost");
    assert_eq!(parsed.port, 3306);
    assert_eq!(parsed.db_type, DbType::Mysql);
}

#[test]
fn test_connection_profile_default_db_type() {
    let json = r#"{"host":"localhost","port":3306,"username":"root","password":"","connection_timeout":30}"#;
    let profile: ConnectionProfile = serde_json::from_str(json).unwrap();
    assert_eq!(profile.db_type, DbType::Mysql); // default
}

#[test]
fn test_db_type_serialization() {
    assert_eq!(serde_json::to_string(&DbType::Mysql).unwrap(), "\"MYSQL\"");
    assert_eq!(serde_json::to_string(&DbType::PostgreSql).unwrap(), "\"POSTGRESQL\"");
    assert_eq!(serde_json::to_string(&DbType::Sqlite).unwrap(), "\"SQLITE\"");
}

#[test]
fn test_pool_config_from_profile() {
    let profile = ConnectionProfile {
        name: None, host: "127.0.0.1".into(), port: 3306, username: "user".into(),
        password: "pass".into(), database: Some("mydb".into()), charset: Some("utf8".into()),
        collation: Some("utf8_general_ci".into()), timeout: Some(28800),
        connection_timeout: Some(60), ssl: Some(true), ssl_mode: Some("required".into()),
        ssl_ca_path: None, ssl_cert_path: None, ssl_key_path: None, db_type: DbType::Mysql,
    };
    let config = PoolConfig::from_profile(&profile);
    assert_eq!(config.host, "127.0.0.1");
    assert_eq!(config.database, Some("mydb".into()));
    assert_eq!(config.charset, Some("utf8".into()));
    assert_eq!(config.ssl_mode, Some("required".into()));
    assert_eq!(config.keepalive_interval_secs, Some(30));
}

#[test]
fn test_pool_config_connection_key() {
    let config = PoolConfig {
        host: "localhost".into(), port: 3306, username: "root".into(), password: "pass".into(),
        database: None, charset: None, collation: None, timeout_seconds: None,
        ssl_mode: Some("disabled".into()), ssl_ca_path: None, ssl_cert_path: None, ssl_key_path: None,
        max_pool_size: Some(10), min_idle: Some(2), idle_timeout_ms: None, max_lifetime_ms: None,
        connection_timeout_ms: None, create_timeout_ms: None, recycle_timeout_ms: None,
        current_database: None, keepalive_interval_secs: Some(30),
    };
    let key = config.connection_key();
    assert!(key.contains("localhost"));
    assert!(key.contains("3306"));
    assert!(key.contains("root"));
}

// ===== Query Models =====

#[test]
fn test_query_result_camelcase() {
    let qr = QueryResult {
        columns: vec![ColumnMeta { name: "id".into(), label: "id".into(), type_name: "INT".into() }],
        rows: vec![vec![serde_json::json!(1)]],
        query_time_secs: 0.05,
        fetch_time_secs: 0.01,
    };
    let json = serde_json::to_string(&qr).unwrap();
    assert!(json.contains("queryTimeSecs"));
    assert!(json.contains("fetchTimeSecs"));
    assert!(!json.contains("query_time_secs"));
}

#[test]
fn test_exec_result_camelcase() {
    let er = ExecResult {
        affected_rows: 5,
        last_insert_id: 42,
        query_time_secs: 0.1,
    };
    let json = serde_json::to_string(&er).unwrap();
    assert!(json.contains("affectedRows"));
    assert!(json.contains("lastInsertId"));
}

#[test]
fn test_sql_param_serialization() {
    let param = SqlParam { param_type: "string".into(), value: serde_json::json!("hello") };
    let json = serde_json::to_string(&param).unwrap();
    assert!(json.contains("type"));
    assert!(json.contains("hello"));
}

// ===== Error Handling =====

#[test]
fn test_app_error_serialization() {
    let err = AppError::PoolNotFound(42);
    let json = serde_json::to_string(&err).unwrap();
    assert!(json.contains("code"));
    assert!(json.contains("message"));
    assert!(json.contains("42"));
}

#[test]
fn test_app_error_conversion() {
    let err: AppError = serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::Other, "test")).into();
    let json = serde_json::to_string(&err).unwrap();
    assert!(json.contains("Json"));
}

#[test]
fn test_io_error_conversion() {
    let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
    let app_err: AppError = io_err.into();
    let json = serde_json::to_string(&app_err).unwrap();
    assert!(json.contains("Io"));
}

// ===== Backup Models =====

#[test]
fn test_backup_result_camelcase() {
    let br = BackupResult { output_path: "/tmp/backup.sql".into(), duration_ms: 12345 };
    let json = serde_json::to_string(&br).unwrap();
    assert!(json.contains("outputPath"));
    assert!(json.contains("durationMs"));
}

// ===== Import/Export Models =====

#[test]
fn test_export_result_serialization() {
    let er = ExportResult { success: true, rows_exported: 100, file_path: "/tmp/out.csv".into(), duration_ms: 500, error: None };
    let json = serde_json::to_string(&er).unwrap();
    assert!(json.contains("rowsExported"));
    assert!(json.contains("filePath"));
}

// ===== User Model =====

#[test]
fn test_user_model_serialization() {
    let user = UserModel {
        username: "test_user".into(), host: "%".into(),
        plugin: Some("caching_sha2_password".into()), password: None,
        server_privileges: vec!["Select".into(), "Insert".into()],
        database_privileges: std::collections::BTreeMap::new(),
    };
    let json = serde_json::to_string(&user).unwrap();
    assert!(json.contains("serverPrivileges"));
    assert!(json.contains("databasePrivileges"));
}
