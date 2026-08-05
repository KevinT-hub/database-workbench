use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use dashmap::DashMap;
use crate::errors::{AppResult, AppError};
use crate::models::connection::ConnectionProfile;
use crate::core::database::traits::DbConnectionHandle;
use crate::core::database::mysql::adapter::MysqlAdapter;
use crate::core::database::postgresql::adapter::PgAdapter;
use crate::core::database::sqlite::adapter::SqliteAdapter;
use crate::core::database::traits::DatabaseAdapter;

pub struct PoolRegistry {
    next_pool_id: AtomicU64,
    next_conn_id: AtomicU64,
    pools: DashMap<u64, Arc<DbConnectionHandle>>,
    adapters: DashMap<u64, Arc<dyn DatabaseAdapter>>,
    connections: DashMap<(u64, u64), ()>,
    key_to_pool_id: DashMap<String, u64>,
    conn_database: DashMap<(u64, u64), String>,
    // 连接池生命周期统计（审计用）：
    // - total_pool_creates: 池创建次数（pool_create / 共享池首建）
    // - total_pool_reuses:  共享池复用次数（get_or_create_pool 命中已有池）
    // - total_conn_acquires: 连接租约累计获取次数（pool_get_connection）
    // - total_conn_releases: 连接租约累计归还次数（pool_release_connection 成功）
    //   归还率 = releases / acquires；两者差值应等于当前未归还的租约数（connections.len()）
    total_pool_creates: AtomicU64,
    total_pool_reuses: AtomicU64,
    total_conn_acquires: AtomicU64,
    total_conn_releases: AtomicU64,
}

impl PoolRegistry {
    pub fn new() -> Self {
        Self {
            next_pool_id: AtomicU64::new(1),
            next_conn_id: AtomicU64::new(1),
            pools: DashMap::new(),
            adapters: DashMap::new(),
            connections: DashMap::new(),
            key_to_pool_id: DashMap::new(),
            conn_database: DashMap::new(),
            total_pool_creates: AtomicU64::new(0),
            total_pool_reuses: AtomicU64::new(0),
            total_conn_acquires: AtomicU64::new(0),
            total_conn_releases: AtomicU64::new(0),
        }
    }

    pub fn allocate_pool_id(&self) -> u64 {
        self.next_pool_id.fetch_add(1, Ordering::SeqCst)
    }

    pub fn allocate_conn_id(&self) -> u64 {
        self.next_conn_id.fetch_add(1, Ordering::SeqCst)
    }

    pub fn pool_exists(&self, pool_id: u64) -> bool {
        self.pools.contains_key(&pool_id)
    }

    pub fn get_pool_info(&self, pool_id: u64) -> Option<(Arc<dyn DatabaseAdapter>, Arc<DbConnectionHandle>)> {
        let handle = self.pools.get(&pool_id).map(|r| r.clone())?;
        let adapter = self.adapters.get(&pool_id).map(|r| r.clone())?;
        Some((adapter, handle))
    }

    pub fn get_adapter(&self, pool_id: u64) -> Option<Arc<dyn DatabaseAdapter>> {
        self.adapters.get(&pool_id).map(|r| r.clone())
    }

    pub fn get_handle(&self, pool_id: u64) -> Option<Arc<DbConnectionHandle>> {
        self.pools.get(&pool_id).map(|r| r.clone())
    }

    pub async fn get_or_create_pool(&self, profile: &ConnectionProfile) -> AppResult<u64> {
        let key = connection_key(profile);
        if let Some(id) = self.key_to_pool_id.get(&key) {
            if self.pools.contains_key(&*id) {
                // 共享池命中：统计复用次数
                self.total_pool_reuses.fetch_add(1, Ordering::Relaxed);
                return Ok(*id);
            }
        }
        self.create_pool(profile).await
    }

    pub async fn create_pool(&self, profile: &ConnectionProfile) -> AppResult<u64> {
        let key = connection_key(profile);
        // V2 注意：`pool_create` 必须保持 V1 语义——每次都新建一个独立连接池。
        // 前端 TableDataTab / QueryTab / FunctionDesignerTab 等组件各自持有并关闭
        // 自己的 pool_id；若此处按 connection_key 复用，任何一方 `pool_close`
        // 都会让其他组件的 pool_id 失效，出现 "pool not found: pool_id=..."。
        // 元数据类命令需要共享池，走下面的 `get_or_create_pool`。
        let adapter: Arc<dyn DatabaseAdapter> = match profile.db_type() {
            crate::models::connection::DbType::Mysql => Arc::new(MysqlAdapter),
            crate::models::connection::DbType::PostgreSql => Arc::new(PgAdapter),
            crate::models::connection::DbType::Sqlite => Arc::new(SqliteAdapter),
            _ => return Err(AppError::UnsupportedFeature(format!("{:?}", profile.db_type()))),
        };
        let handle = adapter.create_pool(profile).await?;
        let pool_id = self.allocate_pool_id();
        self.adapters.insert(pool_id, adapter);
        self.pools.insert(pool_id, Arc::new(handle));
        self.key_to_pool_id.insert(key, pool_id);
        self.total_pool_creates.fetch_add(1, Ordering::Relaxed);
        Ok(pool_id)
    }

    pub fn register_connection(&self, pool_id: u64, conn_id: u64) {
        self.connections.insert((pool_id, conn_id), ());
        self.total_conn_acquires.fetch_add(1, Ordering::Relaxed);
    }

    pub fn release_connection(&self, pool_id: u64, conn_id: u64) -> bool {
        self.conn_database.remove(&(pool_id, conn_id));
        let removed = self.connections.remove(&(pool_id, conn_id)).is_some();
        if removed {
            self.total_conn_releases.fetch_add(1, Ordering::Relaxed);
        }
        removed
    }

    pub fn set_conn_database(&self, pool_id: u64, conn_id: u64, database: String) {
        self.conn_database.insert((pool_id, conn_id), database);
    }

    pub fn get_conn_database(&self, pool_id: u64, conn_id: u64) -> Option<String> {
        self.conn_database.get(&(pool_id, conn_id)).map(|r| r.clone())
    }

    pub fn close_pool(&self, pool_id: u64) {
        self.pools.remove(&pool_id);
        self.adapters.remove(&pool_id);
        self.connections.retain(|k, _| k.0 != pool_id);
        self.conn_database.retain(|k, _| k.0 != pool_id);
        let keys: Vec<String> = self.key_to_pool_id.iter()
            .filter(|e| *e.value() == pool_id)
            .map(|e| e.key().clone())
            .collect();
        for k in keys {
            self.key_to_pool_id.remove(&k);
        }
    }

    pub fn close_all(&self) {
        self.pools.clear();
        self.adapters.clear();
        self.connections.clear();
        self.conn_database.clear();
        self.key_to_pool_id.clear();
    }

    pub fn total_connections(&self) -> usize {
        self.connections.len()
    }

    pub fn pool_count(&self) -> usize {
        self.pools.len()
    }

    /// 连接池生命周期统计快照：(池创建数, 共享池复用数, 租约获取数, 租约归还数)
    pub fn lifecycle_stats(&self) -> (u64, u64, u64, u64) {
        (
            self.total_pool_creates.load(Ordering::Relaxed),
            self.total_pool_reuses.load(Ordering::Relaxed),
            self.total_conn_acquires.load(Ordering::Relaxed),
            self.total_conn_releases.load(Ordering::Relaxed),
        )
    }
}

fn connection_key(profile: &ConnectionProfile) -> String {
    format!(
        "{}:{}:{}:{}:{}",
        profile.host, profile.port, profile.username,
        profile.ssl_mode.as_deref().unwrap_or(""),
        profile.ssl_ca_path.as_deref().unwrap_or("")
    )
}
