use sqlx::Row;
use sqlx::Column;
use sqlx::TypeInfo;
use crate::errors::AppResult;
use crate::models::query::*;
use crate::core::database::mysql::query::row_value_to_json;

/// MySQL 专用 SQL 切分器，支持 `DELIMITER` 指令。
///
/// 在标准 ANSI 切分器（按 `;` 切分，尊重引号/注释）基础上，增加对
/// `DELIMITER X` 行的处理：遇到该行时切换语句终止符为 `X`，直到下一条
/// `DELIMITER ;` 恢复。`DELIMITER` 行本身不会出现在结果中。
///
/// 这使得包含 `DELIMITER $$\nCREATE ... BEGIN ... END$$\nDELIMITER ;` 的
/// 备份文件能被正确切分为单条完整语句。
pub fn split_statements_mysql(sql: &str) -> Vec<String> {
    #[derive(PartialEq)]
    enum Mode { Normal, SingleQuote, DoubleQuote, Backtick, LineComment, BlockComment }

    let mut mode = Mode::Normal;
    let mut start = 0usize;
    let mut results = Vec::new();
    let chars: Vec<char> = sql.chars().collect();
    let len = chars.len();
    let mut i = 0;
    // 当前语句终止符，默认 ";"
    let mut delimiter: Vec<char> = vec![';'];
    // 标记是否在行首（用于检测 DELIMITER 指令）
    let mut at_line_start = true;

    while i < len {
        let (c, next) = (chars[i], chars.get(i + 1).copied());

        match mode {
            Mode::Normal => {
                // 检测行首 DELIMITER 指令（允许前导空格/Tab）
                if at_line_start && (c == 'D' || c == 'd') {
                    let remaining: String = chars[i..].iter().take_while(|&&ch| ch != '\n').collect();
                    let trimmed = remaining.trim();
                    if trimmed.to_ascii_lowercase().starts_with("delimiter ") {
                        // 解析新分隔符
                        let new_delim_str = trimmed["delimiter ".len()..].trim();
                        if !new_delim_str.is_empty() {
                            delimiter = new_delim_str.chars().collect();
                        }
                        // 跳过整行
                        while i < len && chars[i] != '\n' { i += 1; }
                        if i < len { i += 1; } // 跳过 \n
                        start = i;
                        at_line_start = true;
                        continue;
                    }
                }

                if c == '\'' { mode = Mode::SingleQuote; }
                else if c == '"' { mode = Mode::DoubleQuote; }
                else if c == '`' { mode = Mode::Backtick; }
                else if c == '-' && next == Some('-') { mode = Mode::LineComment; i += 2; continue; }
                else if c == '/' && next == Some('*') { mode = Mode::BlockComment; i += 2; continue; }
                else {
                    // 检测当前 delimiter 是否匹配
                    if chars_match_at(&chars, i, &delimiter) {
                        let stmt: String = chars[start..i].iter().collect();
                        let stmt = stmt.trim().to_string();
                        if !stmt.is_empty() { results.push(stmt); }
                        i += delimiter.len();
                        start = i;
                        at_line_start = true;
                        continue;
                    }
                }
                // 行首状态：换行后为 true，空格/Tab 保持，其余为 false
                if c == '\n' { at_line_start = true; }
                else if c != ' ' && c != '\t' && c != '\r' { at_line_start = false; }
            }
            Mode::SingleQuote => {
                if c == '\'' { mode = Mode::Normal; }
                at_line_start = false;
            }
            Mode::DoubleQuote => {
                if c == '"' { mode = Mode::Normal; }
                at_line_start = false;
            }
            Mode::Backtick => {
                if c == '`' { mode = Mode::Normal; }
                at_line_start = false;
            }
            Mode::LineComment => {
                if c == '\n' || c == '\r' { mode = Mode::Normal; start = i + 1; at_line_start = true; }
            }
            Mode::BlockComment => {
                if c == '*' && next == Some('/') { mode = Mode::Normal; i += 2; continue; }
            }
        }
        i += 1;
    }

    let remaining: String = chars[start..].iter().collect();
    let remaining = remaining.trim().to_string();
    if !remaining.is_empty() { results.push(remaining); }

    results
}

/// 检查 chars[pos..] 是否以 delim 开头
fn chars_match_at(chars: &[char], pos: usize, delim: &[char]) -> bool {
    if pos + delim.len() > chars.len() { return false; }
    for (j, dc) in delim.iter().enumerate() {
        if chars[pos + j] != *dc { return false; }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_mysql_basic() {
        let result = split_statements_mysql("SELECT 1; SELECT 2");
        assert_eq!(result, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_split_mysql_delimiter() {
        let sql = "SELECT 1;\nDELIMITER $$\nCREATE PROCEDURE p() BEGIN SELECT 1; END$$\nDELIMITER ;\nSELECT 2;";
        let result = split_statements_mysql(sql);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], "SELECT 1");
        assert!(result[1].contains("CREATE PROCEDURE p() BEGIN SELECT 1; END"));
        assert_eq!(result[2], "SELECT 2");
    }

    #[test]
    fn test_split_mysql_delimiter_double_slash() {
        let sql = "DELIMITER //\nCREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW BEGIN SET NEW.a = 1; END//\nDELIMITER ;";
        let result = split_statements_mysql(sql);
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("CREATE TRIGGER t"));
    }

    #[test]
    fn test_split_mysql_multibyte_char_boundary() {
        // 包含中文字符，确保不会 panic 在 char boundary 上
        let sql = "/* 用户表 */\nSELECT '用户' FROM `user`;\nSELECT 1;";
        let result = split_statements_mysql(sql);
        assert_eq!(result.len(), 2);
        assert!(result[0].contains("用户"));
        assert_eq!(result[1], "SELECT 1");
    }
}

pub async fn execute_special(pool: &sqlx::mysql::MySqlPool, sql: &str) -> AppResult<SpecialResult> {
    let t = sql.trim();
    let tl = t.to_ascii_lowercase();
    if tl.starts_with("call ") || tl.starts_with("show ") || tl.starts_with("describe ") || tl.starts_with("desc ") || tl.starts_with("explain ") {
        // SHOW / DESCRIBE / EXPLAIN 等命令不支持 prepared statement 协议（MySQL 错误 1295），
        // 必须用 raw_sql 走简单查询协议
        let rows = sqlx::raw_sql(t).fetch_all(pool).await?;
        let col_count = if !rows.is_empty() { rows[0].columns().len() } else { 0 };
        let cols: Vec<ColumnMeta> = if !rows.is_empty() {
            rows[0].columns().iter().map(|c| ColumnMeta{
                name: c.name().to_string(),
                label: c.name().to_string(),
                type_name: c.type_info().name().to_string(),
            }).collect()
        } else { vec![] };
        // 真正读取行数据（之前只 push Null，导致 SHOW 结果全空）
        let rrows: Vec<Vec<serde_json::Value>> = rows.iter().map(|r| {
            (0..col_count).map(|i| row_value_to_json(r, i)).collect()
        }).collect();
        let st = if tl.starts_with("call ") { Some("CALL".to_string()) } else { Some("SHOW".to_string()) };
        return Ok(SpecialResult { is_special: true, columns: cols, rows: rrows, special_type: st });
    }
    Ok(SpecialResult { is_special: false, columns: vec![], rows: vec![], special_type: None })
}
