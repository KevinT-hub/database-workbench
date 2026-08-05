use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserModel {
    pub username: String,
    pub host: String,
    pub plugin: Option<String>,
    pub password: Option<String>,
    #[serde(rename = "serverPrivileges")]
    pub server_privileges: Vec<String>,
    #[serde(rename = "databasePrivileges")]
    pub database_privileges: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserModelPayload {
    pub username: String,
    pub host: String,
    pub plugin: Option<String>,
    #[serde(rename = "serverPrivileges")]
    pub server_privileges: Vec<String>,
    #[serde(rename = "databasePrivileges")]
    pub database_privileges: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    pub username: String,
    pub host: String,
    pub plugin: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPrivileges {
    pub server: Vec<String>,
    pub database: BTreeMap<String, Vec<String>>,
}
