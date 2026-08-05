use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FavoriteType {
    SqlQuery,
    ConnectionProfile,
    DatabaseObject,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteItem {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub favorite_type: FavoriteType,
    pub content: Option<String>,
    #[serde(rename = "createdTime")]
    pub created_time: i64,
    #[serde(rename = "lastUsedTime")]
    pub last_used_time: i64,
    #[serde(rename = "usageCount")]
    pub usage_count: i32,
}
