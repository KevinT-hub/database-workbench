use crate::models::connection::PoolConfig;

pub fn build_sqlite_url(config: &PoolConfig) -> String {
    let path = config.host.as_str();
    format!("sqlite://{}", path)
}
