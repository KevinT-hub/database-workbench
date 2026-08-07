use database_workbench_lib::models::connection::*;
use database_workbench_lib::models::query::*;
use database_workbench_lib::models::metadata::*;
use database_workbench_lib::models::backup::*;
use database_workbench_lib::models::user::*;
use database_workbench_lib::models::import_export::*;
use database_workbench_lib::models::favorite::*;
use database_workbench_lib::errors::*;
use database_workbench_lib::core::import_export;
use database_workbench_lib::core::pool::manager::PoolRegistry;
use database_workbench_lib::core::query::session::SqlSplitSessionStore;
use database_workbench_lib::core::backup_restore::scheduler::SchedulerHandle;
use database_workbench_lib::services;

// ===== Command Result Type Verification =====

#[test]
fn test_pool_stats_type() {
    let stats = PoolStats {
        pool_id: 1,
        total_connections: 5,
        active_connections: 3,
        idle_connections: 2,
        max_size: 10,
        waiting_threads: 0,
        total_pool_creates: 1,
        total_pool_reuses: 0,
        total_conn_acquires: 3,
        total_conn_releases: 2,
    };
    assert_eq!(stats.pool_id, 1);
    assert_eq!(stats.total_connections, 5);
    let json = serde_json::to_string(&stats).unwrap();
    assert!(json.contains("poolId"));
}

#[test]
fn test_connection_properties_type() {
    let props = ConnectionProperties {
        connection_status: true,
        server_version: Some("8.0.33".into()),
        current_database: Some("test".into()),
        connection_charset: Some("utf8mb4".into()),
        wait_timeout_seconds: Some(28800),
        ssl_mode: Some("DISABLED".into()),
        table_count: Some(42),
        view_count: Some(5),
        function_count: Some(3),
        procedure_count: Some(10),
    };
    let json = serde_json::to_string(&props).unwrap();
    assert!(json.contains("connectionStatus"));
    assert!(json.contains("serverVersion"));
}

#[test]
fn test_query_result_type() {
    let result = QueryResult {
        columns: vec![
            ColumnMeta { name: "id".into(), label: "id".into(), type_name: "INT".into() },
            ColumnMeta { name: "name".into(), label: "name".into(), type_name: "VARCHAR".into() },
        ],
        rows: vec![
            vec![serde_json::json!(1), serde_json::json!("Alice")],
            vec![serde_json::json!(2), serde_json::json!("Bob")],
        ],
        query_time_secs: 0.005,
        fetch_time_secs: 0.001,
    };
    assert_eq!(result.columns.len(), 2);
    assert_eq!(result.rows.len(), 2);
    assert_eq!(result.rows[0][0], serde_json::json!(1));
}

#[test]
fn test_multi_query_result_type() {
    let result = MultiQueryResult {
        result_sets: vec![
            QueryResult {
                columns: vec![ColumnMeta { name: "x".into(), label: "x".into(), type_name: "INT".into() }],
                rows: vec![vec![serde_json::json!(1)]],
                query_time_secs: 0.01,
                fetch_time_secs: 0.0,
            }
        ],
        affected_rows: 0,
        last_insert_id: 0,
        query_time_secs: 0.01,
        fetch_time_secs: 0.0,
    };
    assert_eq!(result.result_sets.len(), 1);
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("resultSets"));
}

#[test]
fn test_exec_result_type() {
    let result = ExecResult {
        affected_rows: 10,
        last_insert_id: 42,
        query_time_secs: 0.05,
    };
    assert_eq!(result.affected_rows, 10);
    assert_eq!(result.last_insert_id, 42);
}

#[test]
fn test_script_execute_page_result_type() {
    let result = ScriptExecutePageResult {
        entries: vec![
            ScriptExecutePageEntry {
                result_type: "query".into(),
                statement_index: 0,
                sql: "SELECT 1".into(),
                query_result: Some(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    query_time_secs: 0.0,
                    fetch_time_secs: 0.0,
                }),
                exec_result: None,
                error: None,
            }
        ],
        page: 0,
        page_size: 200,
        total: 1,
        has_more: false,
    };
    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].result_type, "query");
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("resultType"));
    assert!(json.contains("queryResult"));
}

#[test]
fn test_sql_split_session_info_type() {
    let info = SqlSplitSessionInfo {
        session_id: 100,
        statement_count: 15,
        db_type: "MYSQL".into(),
    };
    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("sessionId"));
    assert!(json.contains("statementCount"));
}

#[test]
fn test_sql_split_statements_page_type() {
    let page = SqlSplitStatementsPage {
        statements: vec!["SELECT 1".into(), "SELECT 2".into()],
        page: 0,
        page_size: 10,
        total: 2,
        has_more: false,
    };
    assert_eq!(page.statements.len(), 2);
}

// ===== Metadata Type Verification =====

#[test]
fn test_table_detail_type() {
    let td = TableDetail {
        name: "employees".into(),
        rows: Some(500),
        data_length: Some(65536),
        engine: Some("InnoDB".into()),
        update_time: None,
        comment: Some("Employee records".into()),
    };
    let json = serde_json::to_string(&td).unwrap();
    assert!(json.contains("\"Name\""));
    assert!(json.contains("\"Rows\""));
    assert!(json.contains("\"Engine\""));
}

#[test]
fn test_view_detail_type() {
    let vd = ViewDetail {
        name: "active_users".into(),
        definition: Some("SELECT * FROM users WHERE active = 1".into()),
        check_option: Some("NONE".into()),
        is_updatable: Some("YES".into()),
        definer: Some("root@localhost".into()),
        security_type: Some("DEFINER".into()),
        create_time: None,
        update_time: None,
    };
    let json = serde_json::to_string(&vd).unwrap();
    assert!(json.contains("\"Name\""));
    assert!(json.contains("\"Definition\""));
}

#[test]
fn test_function_detail_type() {
    let fd = FunctionDetail {
        name: "calculate_tax".into(),
        routine_type: "FUNCTION".into(),
        data_type: Some("decimal".into()),
        definition: Some("BEGIN RETURN amount * 0.1; END".into()),
        is_deterministic: Some("NO".into()),
        sql_data_access: Some("READS SQL DATA".into()),
        security_type: Some("DEFINER".into()),
        definer: Some("root@localhost".into()),
        create_time: None,
        update_time: None,
        comment: Some("Tax calculator".into()),
    };
    assert_eq!(fd.name, "calculate_tax");
    assert_eq!(fd.routine_type, "FUNCTION");
}

#[test]
fn test_column_info_type() {
    let col = ColumnInfo {
        name: "id".into(),
        data_type: "int".into(),
        column_type: "int(11)".into(),
        is_nullable: "NO".into(),
        column_default: None,
        column_key: "PRI".into(),
        extra: "auto_increment".into(),
        char_max_length: None,
        numeric_precision: Some("10".into()),
        numeric_scale: Some("0".into()),
        column_comment: "Primary key".into(),
        charset: None,
        collation: None,
    };
    assert_eq!(col.name, "id");
    assert_eq!(col.column_type, "int(11)");
}

#[test]
fn test_index_info_type() {
    let idx = IndexInfo {
        name: "PRIMARY".into(),
        non_unique: "0".into(),
        columns: "id".into(),
        index_type: "BTREE".into(),
    };
    assert_eq!(idx.name, "PRIMARY");
    assert_eq!(idx.non_unique, "0");
}

#[test]
fn test_foreign_key_info_type() {
    let fk = ForeignKeyInfo {
        column_name: "dept_id".into(),
        ref_schema: "company".into(),
        ref_table: "departments".into(),
        ref_column: "id".into(),
        constraint_name: "fk_emp_dept".into(),
    };
    assert_eq!(fk.column_name, "dept_id");
    assert_eq!(fk.ref_table, "departments");
}

#[test]
fn test_trigger_info_type() {
    let tr = TriggerInfo {
        name: "before_insert_audit".into(),
        timing: "BEFORE".into(),
        event: "INSERT".into(),
        statement: "SET NEW.created_at = NOW()".into(),
    };
    assert_eq!(tr.timing, "BEFORE");
    assert_eq!(tr.event, "INSERT");
}

#[test]
fn test_check_info_type() {
    let chk = CheckInfo {
        name: "chk_age".into(),
        clause: "age >= 18".into(),
        enforced: "YES".into(),
    };
    assert_eq!(chk.name, "chk_age");
}

#[test]
fn test_routine_detail_type() {
    let rd = RoutineDetail {
        name: "sp_update".into(),
        routine_type: "PROCEDURE".into(),
        return_type: None,
        params: vec![RoutineParam {
            name: "p_id".into(),
            param_type: "INT".into(),
            mode: Some("IN".into()),
        }],
    };
    assert_eq!(rd.name, "sp_update");
    assert_eq!(rd.params.len(), 1);
    let json = serde_json::to_string(&rd).unwrap();
    assert!(json.contains("returnType"));
}

// ===== User Management Type Verification =====

#[test]
fn test_user_summary_type() {
    let us = UserSummary {
        username: "app_user".into(),
        host: "192.168.%.%".into(),
        plugin: Some("mysql_native_password".into()),
        status: "active".into(),
    };
    let json = serde_json::to_string(&us).unwrap();
    assert!(json.contains("app_user"));
}

#[test]
fn test_user_model_payload_type() {
    let up = UserModelPayload {
        username: "admin".into(),
        host: "localhost".into(),
        plugin: Some("mysql_native_password".into()),
        server_privileges: vec!["Select".into(), "Insert".into(), "Update".into(), "Delete".into()],
        database_privileges: {
            let mut m = std::collections::BTreeMap::new();
            m.insert("mydb".into(), vec!["Select".into(), "Insert".into()]);
            m
        },
    };
    let json = serde_json::to_string(&up).unwrap();
    assert!(json.contains("username"));
    assert!(json.contains("serverPrivileges"));
    assert!(json.contains("databasePrivileges"));
}

// ===== Backup & Scheduler =====

#[test]
fn test_backup_options_type() {
    let opts = BackupOptions {
        include_structure: true,
        include_data: false,
        include_views: true,
        include_routines: false,
        include_triggers: true,
        add_drop_table: true,
        use_transaction: true,
        compress_output: true,
        compression_level: Some(9),
        insert_batch_size: Some(500),
    };
    let json = serde_json::to_string(&opts).unwrap();
    assert!(json.contains("includeStructure"));
    assert!(json.contains("compressionLevel"));
}

#[test]
fn test_restore_request_type() {
    let req = RestoreRequest {
        conn: ConnectionProfile {
            name: None, host: "localhost".into(), port: 3306, username: "root".into(),
            password: "".into(), database: None, charset: None, collation: None, timeout: None,
            connection_timeout: Some(30), ssl: None, ssl_mode: None,
            ssl_ca_path: None, ssl_cert_path: None, ssl_key_path: None, db_type: DbType::Mysql,
        },
        target_schema: "test_db".into(),
        mysql_path: None,
        input_path: "/tmp/backup.sql".into(),
        create_schema: true,
        continue_on_error: false,
        use_transaction: true,
    };
    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("targetSchema"));
    assert!(json.contains("inputPath"));
}

#[test]
fn test_scheduler_handle_add_list_remove() {
    let sh = SchedulerHandle::new();
    let req = ScheduleRequest {
        schedule_id: "daily-backup".into(),
        cron: "0 3 * * *".into(),
        backup: BackupRequest {
            conn: ConnectionProfile {
                name: None, host: "localhost".into(), port: 3306, username: "root".into(),
                password: "".into(), database: None, charset: None, collation: None, timeout: None,
                connection_timeout: Some(30), ssl: None, ssl_mode: None,
                ssl_ca_path: None, ssl_cert_path: None, ssl_key_path: None, db_type: DbType::Mysql,
            },
            schema: "mydb".into(),
            output_path: "/backups/mydb.sql".into(),
            mysqldump_path: None,
            selected_tables: None, selected_views: None, selected_routines: None,
            options: BackupOptions::default(),
        },
    };
    let id = sh.add(req.clone());
    assert!(id > 0);

    let list = sh.list();
    assert_eq!(list.len(), 1);

    assert!(sh.remove(id));
    assert!(sh.list().is_empty());
}

// ===== Import/Export Format Types =====

#[test]
fn test_export_result_validation() {
    let er = ExportResult {
        success: true,
        rows_exported: 1000,
        file_path: "/output/data.json".into(),
        duration_ms: 2345,
        error: None,
    };
    assert!(er.success);
    assert_eq!(er.rows_exported, 1000);
}

#[test]
fn test_import_result_validation() {
    let ir = ImportResult {
        success: true,
        rows_imported: 500,
        duration_ms: 1234,
        error: None,
    };
    assert!(ir.success);
    assert_eq!(ir.rows_imported, 500);
}

#[test]
fn test_import_result_error() {
    let ir = ImportResult {
        success: false,
        rows_imported: 0,
        duration_ms: 100,
        error: Some("Column mismatch".into()),
    };
    assert!(!ir.success);
    assert_eq!(ir.error.unwrap(), "Column mismatch");
}

// ===== Favorites Type =====

#[test]
fn test_favorite_type_serialization() {
    let fv = FavoriteType::ConnectionProfile;
    let json = serde_json::to_string(&fv).unwrap();
    assert!(json.contains("CONNECTION_PROFILE"));
}

#[test]
fn test_favorite_item_type() {
    let item = FavoriteItem {
        id: Some("fav_001".into()),
        name: "Test DB".into(),
        description: None,
        favorite_type: FavoriteType::ConnectionProfile,
        content: Some("{}".into()),
        created_time: 1234567890,
        last_used_time: 0,
        usage_count: 5,
    };
    let json = serde_json::to_string(&item).unwrap();
    assert!(json.contains("fav_001"));
    assert!(json.contains("Test DB"));
}

// ===== Error Types =====

#[test]
fn test_all_app_error_variants_serialize() {
    let errors = vec![
        AppError::PoolNotFound(1),
        AppError::ConnectionNotFound(2, 3),
        AppError::PoolCreateFailed("timeout".into()),
        AppError::QueryFailed("syntax error".into()),
        AppError::UnsupportedFeature("Oracle".into()),
        AppError::Config("invalid".into()),
        AppError::NotFound("table not found".into()),
        AppError::InvalidInput("bad format".into()),
        AppError::Updater("network error".into()),
        AppError::Internal("unexpected".into()),
        AppError::Csv("parse error".into()),
        AppError::Xlsx("write error".into()),
        AppError::Calamine("read error".into()),
    ];
    for err in &errors {
        let json = serde_json::to_string(err).unwrap();
        assert!(json.contains("code"));
        assert!(json.contains("message"));
    }
}
