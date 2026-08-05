use database_workbench_lib::core::query::splitter;

#[test]
fn test_split_basic() {
    let result = splitter::split_statements("SELECT 1; SELECT 2");
    assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
}

#[test]
fn test_split_empty() {
    let result = splitter::split_statements("");
    assert!(result.is_empty());
}

#[test]
fn test_split_single() {
    let result = splitter::split_statements("SELECT 1");
    assert_eq!(result, vec!["SELECT 1"]);
}

#[test]
fn test_split_with_semicolon_in_string() {
    let result = splitter::split_statements("SELECT 'hello; world'; SELECT 2");
    assert_eq!(result, vec!["SELECT 'hello; world'", "SELECT 2"]);
}

#[test]
fn test_split_with_double_quotes() {
    let result = splitter::split_statements("SELECT \"col;name\" FROM t; SELECT 1");
    assert_eq!(result, vec!["SELECT \"col;name\" FROM t", "SELECT 1"]);
}

#[test]
fn test_split_with_backtick() {
    let result = splitter::split_statements("SELECT `a;b` FROM t; SELECT 2");
    assert_eq!(result, vec!["SELECT `a;b` FROM t", "SELECT 2"]);
}

#[test]
fn test_split_with_line_comment() {
    let result = splitter::split_statements("SELECT 1; -- this is a comment\nSELECT 2");
    assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
}

#[test]
fn test_split_with_block_comment() {
    let result = splitter::split_statements("SELECT /* a; b */ 1; SELECT 2");
    assert_eq!(result, vec!["SELECT /* a; b */ 1", "SELECT 2"]);
}

#[test]
fn test_split_multi_line_block_comment() {
    // Block comments are part of SQL and should be preserved
    let result = splitter::split_statements("SELECT 1;\n/* multi\nline; comment\n*/\nSELECT 2");
    assert_eq!(result, vec!["SELECT 1", "/* multi\nline; comment\n*/\nSELECT 2"]);
}

#[test]
fn test_split_multiple_statements() {
    let result = splitter::split_statements("CREATE TABLE t(id INT); INSERT INTO t VALUES(1); SELECT * FROM t");
    assert_eq!(result.len(), 3);
}

#[test]
fn test_split_trim_whitespace() {
    let result = splitter::split_statements("  SELECT 1  ;   SELECT 2  ");
    assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
}

#[test]
fn test_split_with_escaped_quotes() {
    let result = splitter::split_statements("SELECT 'it''s okay'; SELECT 2");
    assert_eq!(result, vec!["SELECT 'it''s okay'", "SELECT 2"]);
}
