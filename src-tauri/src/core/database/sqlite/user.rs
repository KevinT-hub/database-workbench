use crate::core::database::traits::DbConnectionHandle;
use crate::errors::AppResult;
use crate::models::user::*;

pub fn get_all_users(_handle: &DbConnectionHandle) -> AppResult<Vec<UserSummary>> { unimplemented!("SQLite has no user management") }
pub fn get_user_detail(_handle: &DbConnectionHandle, _username: &str, _host: &str) -> AppResult<String> { unimplemented!("SQLite has no user management") }
pub fn get_user_model(_handle: &DbConnectionHandle, _username: &str, _host: &str) -> AppResult<UserModelPayload> { unimplemented!("SQLite has no user management") }
pub fn generate_user_sql_static(_current: &UserModel, _is_new: bool, _original: Option<&UserModel>) -> String { unimplemented!("SQLite has no user management") }
pub fn execute_sql(_handle: &DbConnectionHandle, _sql: &str, _database: Option<&str>) -> AppResult<()> { unimplemented!("SQLite has no user management") }
