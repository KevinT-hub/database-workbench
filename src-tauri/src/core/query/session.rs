use std::sync::atomic::{AtomicU64, Ordering};
use dashmap::DashMap;

pub struct SqlSplitSession {
    pub statements: Vec<String>,
    pub db_type: String,
    pub created_at: std::time::Instant,
}

pub struct SqlSplitSessionStore {
    next_id: AtomicU64,
    sessions: DashMap<u64, SqlSplitSession>,
}

impl SqlSplitSessionStore {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            sessions: DashMap::new(),
        }
    }

    pub fn create(&self, statements: Vec<String>, db_type: String) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        self.sessions.insert(id, SqlSplitSession {
            statements,
            db_type,
            created_at: std::time::Instant::now(),
        });
        id
    }

    pub fn get(&self, session_id: u64) -> Option<Vec<String>> {
        self.sessions.get(&session_id).map(|s| s.statements.clone())
    }

    pub fn release(&self, session_id: u64) -> bool {
        self.sessions.remove(&session_id).is_some()
    }
}
