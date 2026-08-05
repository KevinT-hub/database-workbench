//! 导入/导出共用的值转换：根据目标列类型把文本值或 JSON 值转成 SQL 字面量。
//!
//! V1 的导入按列类型（integer/float/boolean/date/json/string）分别处理，
//! V2 把 CSV/TXT/JSON/JSONL/XML 的值转换收敛到这里，避免“一律包成字符串”
//! 导致 JSON 列被二次包裹、数值列丢失精度等问题。

use serde_json::Value;
use crate::core::database::traits::DatabaseAdapter;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValueKind {
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    Time,
    Json,
    String,
}

/// 根据 information_schema 的 DATA_TYPE 判断值类别。
pub fn classify_data_type(data_type: &str) -> ValueKind {
    match data_type.trim().to_ascii_lowercase().as_str() {
        "tinyint" | "smallint" | "mediumint" | "int" | "integer" | "bigint" | "year" => ValueKind::Integer,
        "float" | "double" | "real" | "decimal" | "numeric" => ValueKind::Float,
        "bool" | "boolean" => ValueKind::Boolean,
        "date" => ValueKind::Date,
        "datetime" | "timestamp" => ValueKind::DateTime,
        "time" => ValueKind::Time,
        "json" => ValueKind::Json,
        _ => ValueKind::String,
    }
}

/// 兼容 CSV/文本里被外部双引号包裹的 JSON 文本（例如 `"{"a":1}"`），
/// 去掉外层引号让 MySQL 能正确解析；本身已是合法 JSON 则原样返回。
pub fn normalize_json_text(raw: &str) -> String {
    let trimmed = raw.trim();
    if serde_json::from_str::<Value>(trimmed).is_ok() {
        return trimmed.to_string();
    }
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        let inner = &trimmed[1..trimmed.len() - 1];
        if serde_json::from_str::<Value>(inner).is_ok() {
            return inner.to_string();
        }
    }
    trimmed.to_string()
}

/// JSON 列空值对应的 SQL 字面量：可空列 → NULL，非空列 → 空对象 `'{}'`。
/// 空字符串不是合法 JSON（MySQL 3140），不能原样传入。
pub fn json_empty_value_literal(nullable: bool) -> &'static str {
    if nullable { "NULL" } else { "'{}'" }
}

/// JSON 列“空值”判定：JSON null、空字符串，以及字符串形式的 "null"/"NULL"
/// （兼容旧版导出把 NULL 写成字符串 "NULL" 的文件）。
pub fn json_value_is_empty(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::String(s) => {
            let t = s.trim();
            t.is_empty() || t.eq_ignore_ascii_case("null")
        }
        _ => false,
    }
}

/// 文本值 → SQL 字面量（CSV/TXT/XML 导入使用）。
///
/// - 空串/`null`：可空列 → NULL，不可空列 → 空字符串；
/// - 数值列：合法数值原样输出（保留精度），否则退化为字符串交给 MySQL 处理；
/// - JSON 列：先做外层引号归一化，再以字符串字面量传入（MySQL 会解析为 JSON）。
pub fn text_to_sql_literal(
    adapter: &dyn DatabaseAdapter,
    raw: &str,
    data_type: &str,
    nullable: bool,
) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        // JSON 列不能接收空字符串（MySQL 报 3140 Invalid value），
        // 可空列映射为 NULL，非空列映射为空对象 '{}'。
        if classify_data_type(data_type) == ValueKind::Json {
            return json_empty_value_literal(nullable).into();
        }
        return if nullable { "NULL".into() } else { "''".into() };
    }
    if trimmed.eq_ignore_ascii_case("null") {
        return "NULL".into();
    }
    match classify_data_type(data_type) {
        ValueKind::Integer => {
            if trimmed.parse::<i64>().is_ok() {
                trimmed.to_string()
            } else {
                adapter.quote_string_literal(trimmed)
            }
        }
        ValueKind::Float => {
            if trimmed.parse::<f64>().is_ok() {
                trimmed.to_string()
            } else {
                adapter.quote_string_literal(trimmed)
            }
        }
        ValueKind::Boolean => {
            if trimmed.eq_ignore_ascii_case("true") || trimmed == "1" {
                "1".into()
            } else if trimmed.eq_ignore_ascii_case("false") || trimmed == "0" {
                "0".into()
            } else {
                adapter.quote_string_literal(trimmed)
            }
        }
        ValueKind::Date | ValueKind::DateTime | ValueKind::Time => adapter.quote_string_literal(trimmed),
        ValueKind::Json => adapter.quote_string_literal(&normalize_json_text(trimmed)),
        ValueKind::String => adapter.quote_string_literal(trimmed),
    }
}

/// JSON 值 → SQL 字面量（JSON/JSONL 导入使用）。
pub fn json_to_sql_literal(
    adapter: &dyn DatabaseAdapter,
    v: &Value,
    data_type: &str,
    nullable: bool,
) -> String {
    let kind = classify_data_type(data_type);
    // JSON 列：NULL 或空字符串一律映射为 NULL（非空列给 '{}'），
    // 避免空串被 MySQL 判定为非法 JSON（3140）。
    if kind == ValueKind::Json {
        if json_value_is_empty(v) {
            return json_empty_value_literal(nullable).into();
        }
    }
    if v.is_null() {
        return if nullable { "NULL".into() } else { "''".into() };
    }
    match kind {
        ValueKind::Integer => match v {
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => if *b { "1".into() } else { "0".into() },
            Value::String(s) => {
                let t = s.trim();
                if let Ok(n) = t.parse::<i64>() {
                    n.to_string()
                } else {
                    adapter.quote_string_literal(t)
                }
            }
            _ => adapter.quote_string_literal(&v.to_string()),
        },
        ValueKind::Float => match v {
            Value::Number(n) => n.to_string(),
            Value::String(s) => {
                let t = s.trim();
                if t.parse::<f64>().is_ok() {
                    t.to_string()
                } else {
                    adapter.quote_string_literal(t)
                }
            }
            _ => adapter.quote_string_literal(&v.to_string()),
        },
        ValueKind::Boolean => match v {
            Value::Bool(b) => if *b { "1".into() } else { "0".into() },
            Value::Number(n) => n.to_string(),
            Value::String(s) => {
                if s.eq_ignore_ascii_case("true") || s == "1" {
                    "1".into()
                } else {
                    "0".into()
                }
            }
            _ => adapter.quote_string_literal(&v.to_string()),
        },
        ValueKind::Date | ValueKind::DateTime | ValueKind::Time => {
            adapter.quote_string_literal(&super::value_to_string(v))
        }
        ValueKind::Json => adapter.quote_string_literal(&super::value_to_string(v)),
        ValueKind::String => adapter.quote_string_literal(&super::value_to_string(v)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_json_text_plain() {
        assert_eq!(normalize_json_text(r#"{"a": 1}"#), r#"{"a": 1}"#);
    }

    #[test]
    fn test_normalize_json_text_outer_quotes() {
        // CSV 中出现的 `"{"a": 1}"`（外层引号包裹的 JSON 对象）
        assert_eq!(normalize_json_text(r#""{"a": 1}""#), r#"{"a": 1}"#);
    }

    #[test]
    fn test_normalize_json_text_keeps_json_string() {
        // 合法 JSON 字符串原样保留
        assert_eq!(normalize_json_text(r#""hello""#), r#""hello""#);
    }

    #[test]
    fn test_classify_data_type() {
        assert_eq!(classify_data_type("json"), ValueKind::Json);
        assert_eq!(classify_data_type("int"), ValueKind::Integer);
        assert_eq!(classify_data_type("decimal"), ValueKind::Float);
        assert_eq!(classify_data_type("datetime"), ValueKind::DateTime);
        assert_eq!(classify_data_type("varchar"), ValueKind::String);
    }

    #[test]
    fn test_json_empty_value_literal() {
        // 回归：空字符串不能作为 JSON 列值（MySQL 3140 Invalid value）
        assert_eq!(json_empty_value_literal(true), "NULL");
        assert_eq!(json_empty_value_literal(false), "'{}'");
    }

    #[test]
    fn test_json_value_is_empty() {
        assert!(json_value_is_empty(&Value::Null));
        assert!(json_value_is_empty(&Value::String(String::new())));
        assert!(json_value_is_empty(&Value::String("  ".into())));
        // 兼容旧版导出：NULL 被写成字符串 "NULL"
        assert!(json_value_is_empty(&Value::String("NULL".into())));
        assert!(json_value_is_empty(&Value::String("null".into())));
        assert!(json_value_is_empty(&Value::String(" Null ".into())));
        // 真实 JSON 值不应误判
        assert!(!json_value_is_empty(&Value::String(r#"{"a":1}"#.into())));
        assert!(!json_value_is_empty(&Value::String("0".into())));
        assert!(!json_value_is_empty(&Value::Bool(false)));
    }
}
