pub fn escape_identifier(identifier: &str) -> String {
    identifier.replace('`', "``")
}

pub fn escape_sql_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', "\\n").replace('\r', "\\r").replace('\0', "\\0")
}

pub fn beautify_ddl(ddl: &str) -> String {
    ddl.replace(",", ",\n  ")
}

pub fn format_sql(sql: &str) -> String {
    sql.trim().to_string()
}

pub fn extract_view_select(definition: &str) -> String {
    let def = definition.trim();
    if let Some(start) = def.to_ascii_uppercase().find("SELECT") {
        def[start..].to_string()
    } else {
        def.to_string()
    }
}
