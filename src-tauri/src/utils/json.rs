use serde_json::Value;

pub fn parse_to_canonical_json(input: &str) -> Result<Value, String> {
    serde_json::from_str::<Value>(input).map_err(|e| format!("Invalid JSON: {e}"))
}
