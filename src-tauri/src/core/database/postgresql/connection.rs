use crate::models::connection::PoolConfig;

pub fn build_pg_url(config: &PoolConfig) -> String {
    format!(
        "postgres://{}:{}@{}:{}/{}",
        config.username,
        config.password,
        config.host,
        config.port,
        config.database.as_deref().unwrap_or("postgres"),
    )
}
