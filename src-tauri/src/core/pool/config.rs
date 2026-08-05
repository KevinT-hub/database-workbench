use crate::models::connection::PoolConfig;

pub fn derive_timeouts(config: &PoolConfig) -> (u64, u64) {
    let connect_timeout = config.connection_timeout_ms.unwrap_or(10000);
    let read_timeout = config.timeout_seconds.unwrap_or(30000);
    (connect_timeout, read_timeout)
}
