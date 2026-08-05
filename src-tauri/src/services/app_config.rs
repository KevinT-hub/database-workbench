use std::collections::BTreeMap;
use std::sync::RwLock;
use crate::errors::{AppResult, AppError};
use crate::utils::file;
use crate::services::properties;

pub struct ConfigCache {
    data: RwLock<Option<BTreeMap<String, String>>>,
}

impl ConfigCache {
    pub fn new() -> Self {
        Self { data: RwLock::new(None) }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.data.read().ok()?.as_ref()?.get(key).cloned()
    }

    pub fn set(&self, key: String, value: String) {
        if let Ok(mut data) = self.data.write() {
            let map = data.get_or_insert_with(BTreeMap::new);
            map.insert(key, value);
        }
    }

    pub fn flush(&self) {
        if let Ok(mut data) = self.data.write() {
            *data = None;
        }
    }

    pub fn load(&self) -> AppResult<()> {
        let path = file::app_config_file_path()?;
        if !path.exists() {
            if let Ok(mut data) = self.data.write() {
                *data = Some(BTreeMap::new());
            }
            return Ok(());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::Config(format!("Failed to read app config: {e}")))?;
        let map = properties::parse_to_map(&content);
        if let Ok(mut data) = self.data.write() {
            *data = Some(map);
        }
        Ok(())
    }
}
