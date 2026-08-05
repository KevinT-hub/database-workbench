use crate::errors::{AppResult, AppError};
use crate::models::favorite::FavoriteItem;
use crate::utils::file;
use std::sync::atomic::{AtomicU64, Ordering};
use dashmap::DashMap;

pub struct FavoritesStore {
    counter: AtomicU64,
    items: DashMap<String, FavoriteItem>,
}

impl FavoritesStore {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(1),
            items: DashMap::new(),
        }
    }

    pub fn load(&self) -> AppResult<()> {
        let path = file::favorites_file_path()?;
        if !path.exists() {
            return Ok(());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::Io(e))?;
        if let Ok(items) = serde_json::from_str::<Vec<FavoriteItem>>(&content) {
            for mut item in items {
                let id = item.id.clone().unwrap_or_else(|| {
                    self.counter.fetch_add(1, Ordering::SeqCst).to_string()
                });
                item.id = Some(id.clone());
                self.items.insert(id, item);
            }
        }
        Ok(())
    }

    pub fn save(&self) -> AppResult<()> {
        let path = file::favorites_file_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
        }
        let all: Vec<FavoriteItem> = self.items.iter().map(|e| e.value().clone()).collect();
        let json = serde_json::to_string_pretty(&all)?;
        std::fs::write(&path, json).map_err(|e| AppError::Io(e))?;
        Ok(())
    }

    pub fn next_id(&self) -> String {
        self.counter.fetch_add(1, Ordering::SeqCst).to_string()
    }

    pub fn get_all(&self) -> Vec<FavoriteItem> {
        self.items.iter().map(|e| e.value().clone()).collect()
    }

    pub fn get(&self, id: &str) -> Option<FavoriteItem> {
        self.items.get(id).map(|r| r.clone())
    }

    pub fn add(&self, mut item: FavoriteItem) -> FavoriteItem {
        let id = item.id.take().unwrap_or_else(|| self.next_id());
        item.id = Some(id.clone());
        self.items.insert(id.clone(), item.clone());
        let _ = self.save();
        item
    }

    pub fn update(&self, id: &str, mut item: FavoriteItem) -> bool {
        if self.items.contains_key(id) {
            item.id = Some(id.to_string());
            self.items.insert(id.to_string(), item);
            let _ = self.save();
            true
        } else {
            false
        }
    }

    pub fn remove(&self, id: &str) -> bool {
        let existed = self.items.remove(id).is_some();
        if existed { let _ = self.save(); }
        existed
    }

    pub fn clear(&self) {
        self.items.clear();
        let _ = self.save();
    }

    pub fn total(&self) -> usize {
        self.items.len()
    }

    pub fn record_usage(&self, id: &str) -> bool {
        if let Some(mut item) = self.items.get_mut(id) {
            item.usage_count += 1;
            item.last_used_time = chrono::Utc::now().timestamp_millis();
            drop(item);
            let _ = self.save();
            true
        } else {
            false
        }
    }
}
