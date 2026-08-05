use database_workbench_lib::utils::sql;
use database_workbench_lib::core::import_export::escape;

#[test]
fn test_escape_identifier() {
    assert_eq!(sql::escape_identifier("my_table"), "my_table");
    assert_eq!(sql::escape_identifier("my`table"), "my``table");
}

#[test]
fn test_escape_sql_string() {
    assert_eq!(sql::escape_sql_string("hello"), "hello");
    assert_eq!(sql::escape_sql_string("it's"), "it\\'s");
    assert_eq!(sql::escape_sql_string("back\\slash"), "back\\\\slash");
}

#[test]
fn test_beautify_ddl() {
    let ddl = "CREATE TABLE t(id INT, name VARCHAR(100), PRIMARY KEY(id))";
    let result = sql::beautify_ddl(ddl);
    assert!(result.contains(",\n"));
}

#[test]
fn test_format_sql_trims() {
    let result = sql::format_sql("  SELECT 1  ");
    assert_eq!(result, "SELECT 1");
}

#[test]
fn test_extract_view_select() {
    let result = sql::extract_view_select("CREATE VIEW v AS SELECT * FROM t WHERE x = 1");
    assert!(result.starts_with("SELECT"));
}

// Escape tests
#[test]
fn test_escape_csv_field() {
    assert_eq!(escape::escape_csv_field("hello"), "hello");
    assert_eq!(escape::escape_csv_field("hello,world"), "\"hello,world\"");
    assert_eq!(escape::escape_csv_field("say \"hi\""), "\"say \"\"hi\"\"\"");
}

#[test]
fn test_escape_json_string() {
    let escaped = escape::escape_json_string("line1\nline2");
    assert_eq!(escaped, "line1\\nline2");
}

#[test]
fn test_html_escape() {
    assert_eq!(escape::html_escape("<div>"), "&lt;div&gt;");
    assert_eq!(escape::html_escape("a & b"), "a &amp; b");
}

#[test]
fn test_xml_escape() {
    assert_eq!(escape::xml_escape("<tag>"), "&lt;tag&gt;");
    // The function only escapes ', not i
    assert_eq!(escape::xml_escape("it's"), "it&apos;s");
}
