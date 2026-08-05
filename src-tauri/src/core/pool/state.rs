use std::time::Instant;

pub struct ConnectionState {
    pub current_database: Option<String>,
    pub created_at: u64,
    last_used: Instant,
    last_health_check: Option<Instant>,
}

impl ConnectionState {
    pub fn new(current_database: Option<String>) -> Self {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        Self {
            current_database,
            created_at: now_ms,
            last_used: Instant::now(),
            last_health_check: None,
        }
    }

    pub fn record_use(&mut self) {
        self.last_used = Instant::now();
    }

    pub fn should_probe_health(&self) -> bool {
        match self.last_health_check {
            Some(check_time) => check_time.elapsed().as_secs() > 3,
            None => self.last_used.elapsed().as_secs() > 3,
        }
    }

    pub fn mark_health_checked(&mut self) {
        self.last_health_check = Some(Instant::now());
    }
}

pub struct ConnectionUsageStats {
    pub total_queries: u64,
    pub total_execute_ms: u64,
}
