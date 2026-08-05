use std::time::Duration;

pub struct KeepaliveManager {
    default_interval_secs: u64,
}

impl KeepaliveManager {
    pub fn new(default_interval_secs: u64) -> Self {
        Self { default_interval_secs }
    }

    pub fn set_default_interval(&mut self, interval_secs: u64) {
        self.default_interval_secs = interval_secs;
    }

    pub fn get_default_interval(&self) -> Duration {
        Duration::from_secs(self.default_interval_secs)
    }
}
