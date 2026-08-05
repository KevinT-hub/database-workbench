use tauri::State;
use crate::errors::AppResult;
use crate::models::favorite::*;
use crate::services::favorites::FavoritesStore;

#[tauri::command]
pub fn favorites_get_all(store: State<'_, FavoritesStore>) -> AppResult<Vec<FavoriteItem>> { Ok(store.get_all()) }
#[tauri::command]
pub fn favorites_get_by_type(favorite_type: FavoriteType, store: State<'_, FavoritesStore>) -> AppResult<Vec<FavoriteItem>> { Ok(store.get_all().into_iter().filter(|i| i.favorite_type == favorite_type).collect()) }
#[tauri::command]
pub fn favorites_search(query: String, store: State<'_, FavoritesStore>) -> AppResult<Vec<FavoriteItem>> { Ok(store.get_all().into_iter().filter(|i| i.name.contains(&query)).collect()) }
#[tauri::command]
pub fn favorites_get(id: String, store: State<'_, FavoritesStore>) -> AppResult<Option<FavoriteItem>> { Ok(store.get(&id)) }
#[tauri::command]
pub fn favorites_add(item: FavoriteItem, store: State<'_, FavoritesStore>) -> AppResult<FavoriteItem> { Ok(store.add(item)) }
#[tauri::command]
pub fn favorites_update(id: String, item: FavoriteItem, store: State<'_, FavoritesStore>) -> AppResult<bool> { Ok(store.update(&id, item)) }
#[tauri::command]
pub fn favorites_remove(id: String, store: State<'_, FavoritesStore>) -> AppResult<bool> { Ok(store.remove(&id)) }
#[tauri::command]
pub fn favorites_record_usage(id: String, store: State<'_, FavoritesStore>) -> AppResult<bool> { Ok(store.record_usage(&id)) }
#[tauri::command]
pub fn favorites_clear(store: State<'_, FavoritesStore>) -> AppResult<()> { store.clear(); Ok(()) }
#[tauri::command]
pub fn favorites_total(store: State<'_, FavoritesStore>) -> AppResult<usize> { Ok(store.total()) }
#[tauri::command]
pub fn favorites_stats(store: State<'_, FavoritesStore>) -> AppResult<String> { Ok(format!("{} items", store.total())) }
