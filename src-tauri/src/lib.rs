pub mod errors;
pub mod commands;
pub mod core;
pub mod models;
pub mod services;
pub mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 安装 sqlx Any 驱动（sqlx 0.8 要求在运行时显式安装）
            sqlx::any::install_default_drivers();

            // V1 -> V2 data migration
            if let Err(e) = services::migration::migrate_legacy_data() {
                eprintln!("[V2] Legacy data migration failed: {:?}", e);
            }
            app.manage(core::pool::manager::PoolRegistry::new());
            app.manage(core::pool::keepalive::KeepaliveManager::new(30));
            app.manage(core::backup_restore::scheduler::SchedulerHandle::new());
            app.manage(core::update::geo::CountryCodeCache::new());
            app.manage(core::query::session::SqlSplitSessionStore::new());
            app.manage(services::app_config::ConfigCache::new());
            app.manage(services::session_log::SessionLogger::new()?);
            app.manage(services::favorites::FavoritesStore::new());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(code) = core::update::geo::warmup_cache().await {
                    if let Some(cache) =
                        handle.try_state::<core::update::geo::CountryCodeCache>()
                    {
                        cache.set(code);
                    }
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // pool (9)
            commands::pool::pool_create, commands::pool::pool_get_connection, commands::pool::pool_set_database, commands::pool::pool_release_connection, commands::pool::pool_test_connection, commands::pool::pool_get_stats, commands::pool::pool_get_connection_properties, commands::pool::pool_close, commands::pool::pool_close_all,
            // query (8)
            commands::query::pool_query, commands::query::pool_query_page, commands::query::pool_query_multi, commands::query::pool_execute, commands::query::pool_query_prepared, commands::query::pool_execute_prepared, commands::query::pool_execute_statement_page, commands::query::pool_execute_script,
            // script (2)
            commands::script::sql_split_statements_create, commands::script::sql_split_statements_release,
            // metadata (18)
            commands::metadata::metadata_list_databases, commands::metadata::metadata_list_tables, commands::metadata::metadata_list_table_details, commands::metadata::metadata_list_views, commands::metadata::metadata_list_view_details, commands::metadata::metadata_list_functions, commands::metadata::metadata_list_routines_with_details, commands::metadata::metadata_list_function_details, commands::metadata::metadata_list_columns, commands::metadata::metadata_list_foreign_keys, commands::metadata::metadata_list_indexes, commands::metadata::metadata_list_triggers, commands::metadata::metadata_list_checks, commands::metadata::metadata_load_ddl, commands::metadata::metadata_get_current_user_info, commands::metadata::metadata_get_function_ddl, commands::metadata::metadata_get_routine_params, commands::metadata::metadata_get_all_databases,
            // user (5)
            commands::user::metadata_get_all_users, commands::user::metadata_get_user_detail, commands::user::metadata_get_user_model, commands::user::metadata_generate_user_sql, commands::user::metadata_execute_sql,
            // config (4)
            commands::config::config_load_connections, commands::config::config_save_connections, commands::config::config_import_connections, commands::config::config_export_connections,
            // backup (5)
            commands::backup::backup_execute, commands::backup::restore_execute, commands::backup::schedule_add, commands::backup::schedule_remove, commands::backup::schedule_list,
            // import_export (9)
            commands::import_export::export_table, commands::import_export::export_query_result, commands::import_export::export_query_result_csv, commands::import_export::export_to_csv, commands::import_export::export_to_jsonl, commands::import_export::import_table, commands::import_export::import_from_csv, commands::import_export::import_from_json, commands::import_export::import_from_jsonl,
            // favorites (11)
            commands::favorites::favorites_get_all, commands::favorites::favorites_get_by_type, commands::favorites::favorites_search, commands::favorites::favorites_get, commands::favorites::favorites_add, commands::favorites::favorites_update, commands::favorites::favorites_remove, commands::favorites::favorites_record_usage, commands::favorites::favorites_clear, commands::favorites::favorites_total, commands::favorites::favorites_stats,
            // sql_utils (3)
            commands::sql_utils::sql_format, commands::sql_utils::sql_extract_view_select, commands::sql_utils::sql_split_statements,
            // json (1)
            commands::json::json_parse_canonical,
            // app (4)
            commands::app::app_config_get, commands::app::app_config_set, commands::app::app_config_flush, commands::app::app_invalidate_runtime_cache,
            // updater (2)
            commands::updater::updater_check_by_region, commands::updater::updater_download_and_install_by_region,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
