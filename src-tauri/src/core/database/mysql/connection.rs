use crate::models::connection::PoolConfig;

pub fn build_mysql_url(config: &PoolConfig) -> String {
    let mut url = format!("mysql://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port,
        config.database.as_deref().unwrap_or("")
    );

    let mut params = Vec::new();
    if let Some(cs) = &config.charset {
        params.push(format!("charset={}", cs));
    }

    let (connect_timeout_ms, read_timeout_ms) = crate::core::pool::config::derive_timeouts(config);
    if connect_timeout_ms > 0 {
        params.push(format!("connect-timeout={}", connect_timeout_ms / 1000));
    }
    if read_timeout_ms > 0 {
        params.push(format!("read-timeout={}", read_timeout_ms / 1000));
    }

    if let Some(ref mode) = config.ssl_mode {
        let ssl_mode = match mode.to_ascii_lowercase().replace('-', "_").as_str() {
            "disabled" => "disabled",
            "preferred" => "preferred",
            "required" => "required",
            "verify_ca" | "verifyca" => "verify_ca",
            "verify_identity" | "verifyidentity" => "verify_identity",
            _ => "preferred",
        };
        params.push(format!("ssl-mode={}", ssl_mode));
    }

    if !params.is_empty() {
        url.push('?');
        url.push_str(&params.join("&"));
    }
    url
}

pub fn build_session_init_sql(config: &PoolConfig) -> Vec<String> {
    let mut sqls = Vec::new();
    if let Some(db) = &config.current_database {
        if !db.trim().is_empty() { sqls.push(format!("USE `{}`", db.replace('`', "``"))); }
    }
    if let Some(cs) = config.charset.as_deref().filter(|v| is_safe_token(v)) {
        if let Some(cl) = config.collation.as_deref().filter(|v| is_safe_token(v)) {
            sqls.push(format!("SET NAMES {} COLLATE {}", cs, cl));
        } else { sqls.push(format!("SET NAMES {}", cs)); }
    }
    if let Some(t) = config.timeout_seconds.filter(|v| *v > 0) {
        sqls.push(format!("SET SESSION wait_timeout = {}", t));
    }
    sqls
}

fn is_safe_token(value: &str) -> bool {
    value.trim().chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}
