use tauri::State;
use crate::errors::{AppResult, AppError};
use crate::models::connection::{ConnectionProfile, PoolStats, ConnectionProperties};
use crate::core::pool::manager::PoolRegistry;
use crate::core::database::traits::DatabaseAdapter;

#[tauri::command]
pub async fn pool_create(profile: ConnectionProfile, state: State<'_, PoolRegistry>) -> AppResult<u64> {
    state.create_pool(&profile).await
}

#[tauri::command]
pub async fn pool_get_connection(pool_id: u64, initial_database: Option<String>, state: State<'_, PoolRegistry>) -> AppResult<u64> {
    if !state.pool_exists(pool_id) {
        return Err(AppError::PoolNotFound(pool_id));
    }
    let conn_id = state.allocate_conn_id();
    state.register_connection(pool_id, conn_id);
    if let Some(db) = initial_database {
        state.set_conn_database(pool_id, conn_id, db);
    }
    Ok(conn_id)
}

#[tauri::command]
pub async fn pool_set_database(pool_id: u64, conn_id: u64, database: Option<String>, state: State<'_, PoolRegistry>) -> AppResult<()> {
    if let Some(db) = database {
        if let Some((adapter, handle)) = state.get_pool_info(pool_id) {
            adapter.use_database(&handle, &db).await?;
        }
        state.set_conn_database(pool_id, conn_id, db);
    } else {
        state.set_conn_database(pool_id, conn_id, String::new());
    }
    Ok(())
}

#[tauri::command]
pub async fn pool_release_connection(pool_id: u64, conn_id: u64, state: State<'_, PoolRegistry>) -> AppResult<bool> {
    Ok(state.release_connection(pool_id, conn_id))
}

#[tauri::command]
pub async fn pool_test_connection(profile: ConnectionProfile, _state: State<'_, PoolRegistry>) -> AppResult<bool> {
    let adapter: Box<dyn DatabaseAdapter> = match profile.db_type() {
        crate::models::connection::DbType::Mysql => {
            Box::new(crate::core::database::mysql::adapter::MysqlAdapter)
        }
        crate::models::connection::DbType::PostgreSql => {
            Box::new(crate::core::database::postgresql::adapter::PgAdapter)
        }
        crate::models::connection::DbType::Sqlite => {
            Box::new(crate::core::database::sqlite::adapter::SqliteAdapter)
        }
        _ => return Err(AppError::UnsupportedFeature(format!("{:?}", profile.db_type()))),
    };
    adapter.test_connection(&profile).await
}

#[tauri::command]
pub async fn pool_get_stats(pool_id: u64, state: State<'_, PoolRegistry>) -> AppResult<PoolStats> {
    if !state.pool_exists(pool_id) {
        return Err(AppError::PoolNotFound(pool_id));
    }
    let conn_count = state.total_connections();
    let (pool_creates, pool_reuses, conn_acquires, conn_releases) = state.lifecycle_stats();
    Ok(PoolStats {
        pool_id,
        total_connections: conn_count,
        active_connections: conn_count,
        idle_connections: 0,
        max_size: 10,
        waiting_threads: 0,
        total_pool_creates: pool_creates,
        total_pool_reuses: pool_reuses,
        total_conn_acquires: conn_acquires,
        total_conn_releases: conn_releases,
    })
}

#[tauri::command]
pub async fn pool_get_connection_properties(pool_id: u64, database: Option<String>, state: State<'_, PoolRegistry>) -> AppResult<ConnectionProperties> {
    let (adapter, handle) = state.get_pool_info(pool_id).ok_or(AppError::PoolNotFound(pool_id))?;
    adapter.get_connection_properties(&handle, database.as_deref()).await
}

#[tauri::command]
pub async fn pool_close(pool_id: u64, state: State<'_, PoolRegistry>) -> AppResult<()> {
    state.close_pool(pool_id);
    Ok(())
}

#[tauri::command]
pub async fn pool_close_all(state: State<'_, PoolRegistry>) -> AppResult<()> {
    state.close_all();
    Ok(())
}
