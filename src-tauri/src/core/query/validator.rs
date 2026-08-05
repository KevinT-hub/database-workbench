pub fn normalize_query_sql(sql: &str) -> String {
    sql.trim().to_string()
}

pub fn is_read_query(sql: &str) -> bool {
    let trimmed = sql.trim().to_ascii_uppercase();
    trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("DESCRIBE") || trimmed.starts_with("DESC ") || trimmed.starts_with("EXPLAIN")
}
