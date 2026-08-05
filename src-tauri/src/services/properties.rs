use std::collections::BTreeMap;
use crate::errors::AppResult;
use crate::models::connection::ConnectionProfile;

pub fn parse_properties(content: &str) -> AppResult<BTreeMap<String, ConnectionProfile>> {
    let mut map = BTreeMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(eq_pos) = line.find('=') {
            let name = line[..eq_pos].trim().to_string();
            let value = line[eq_pos + 1..].trim();
            if let Ok(profile) = serde_json::from_str::<ConnectionProfile>(value) {
                map.insert(name, profile);
            }
        }
    }
    Ok(map)
}

pub fn parse_to_map(content: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim().to_string();
            let value = line[eq_pos + 1..].trim().to_string();
            map.insert(key, value);
        }
    }
    map
}
