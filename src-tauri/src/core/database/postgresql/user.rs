use crate::core::database::traits::DbConnectionHandle;
use crate::errors::AppResult;
use crate::models::user::*;

pub fn get_all_users(_handle: &DbConnectionHandle) -> AppResult<Vec<UserSummary>> { unimplemented!("PostgreSQL get_all_users") }
pub fn get_user_detail(_handle: &DbConnectionHandle, _username: &str, _host: &str) -> AppResult<String> { unimplemented!("PostgreSQL get_user_detail") }
pub fn get_user_model(_handle: &DbConnectionHandle, _username: &str, _host: &str) -> AppResult<UserModelPayload> { unimplemented!("PostgreSQL get_user_model") }
pub fn generate_user_sql_static(_current: &UserModel, _is_new: bool, _original: Option<&UserModel>) -> String { unimplemented!("PostgreSQL generate_user_sql") }
pub fn execute_sql(_handle: &DbConnectionHandle, _sql: &str, _database: Option<&str>) -> AppResult<()> { unimplemented!("PostgreSQL execute_sql") }
