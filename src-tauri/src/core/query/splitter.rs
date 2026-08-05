pub fn split_statements(sql: &str) -> Vec<String> {
    #[derive(PartialEq)]
    enum Mode { Normal, SingleQuote, DoubleQuote, Backtick, LineComment, BlockComment }

    let mut mode = Mode::Normal;
    let mut start = 0usize;
    let mut results = Vec::new();
    let chars: Vec<char> = sql.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let (c, next) = (chars[i], chars.get(i + 1).copied());
        match mode {
            Mode::Normal => {
                if c == '\'' { mode = Mode::SingleQuote; }
                else if c == '"' { mode = Mode::DoubleQuote; }
                else if c == '`' { mode = Mode::Backtick; }
                else if c == '-' && next == Some('-') { mode = Mode::LineComment; i += 2; continue; }
                else if c == '/' && next == Some('*') { mode = Mode::BlockComment; i += 2; continue; }
                else if c == ';' {
                    // 用字符切片重建字符串，避免对 &str 做字节切片时中文（多字节 UTF-8）
                    // 落在字符中间触发 "byte boundary" panic。
                    let stmt: String = chars[start..i].iter().collect();
                    let stmt = stmt.trim().to_string();
                    if !stmt.is_empty() { results.push(stmt); }
                    start = i + 1;
                }
            }
            Mode::SingleQuote => { if c == '\'' { mode = Mode::Normal; } }
            Mode::DoubleQuote => { if c == '"' { mode = Mode::Normal; } }
            Mode::Backtick => { if c == '`' { mode = Mode::Normal; } }
            Mode::LineComment => { if c == '\n' || c == '\r' { mode = Mode::Normal; start = i + 1; } }
            Mode::BlockComment => { if c == '*' && next == Some('/') { mode = Mode::Normal; i += 2; continue; } }
        }
        i += 1;
    }

    // 用字符切片重建字符串，避免对 &str 做字节切片时中文（多字节 UTF-8）
    // 落在字符中间触发 "byte boundary" panic。
    let remaining: String = chars[start..].iter().collect();
    let remaining = remaining.trim().to_string();
    if !remaining.is_empty() { results.push(remaining); }

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_split_basic() {
        let result = split_statements("SELECT 1; SELECT 2");
        assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
    }
    #[test]
    fn test_split_with_string() {
        let result = split_statements("SELECT 'hello; world'; SELECT 2");
        assert_eq!(result, vec!["SELECT 'hello; world'", "SELECT 2"]);
    }
    #[test]
    fn test_split_with_comment() {
        let result = split_statements("SELECT 1; -- comment\nSELECT 2");
        assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
    }
    #[test]
    fn test_split_with_block_comment() {
        let result = split_statements("SELECT /* a; b */ 1; SELECT 2");
        assert_eq!(result, vec!["SELECT /* a; b */ 1", "SELECT 2"]);
    }
    #[test]
    fn test_split_with_multibyte_char() {
        // 包含中文字符，确保不会 panic 在 char boundary 上
        let sql = "/* 用户表 */\nSELECT '用户' FROM `user`;\nSELECT 1;";
        let result = split_statements(sql);
        assert_eq!(result.len(), 2);
        assert!(result[0].contains("用户"));
        assert_eq!(result[1], "SELECT 1");
    }
}
