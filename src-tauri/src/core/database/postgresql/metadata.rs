use crate::core::database::traits::DbConnectionHandle;
use crate::errors::AppResult;
use crate::models::connection::ConnectionProperties;

pub fn get_connection_properties(_handle: &DbConnectionHandle, _database: Option<&str>) -> AppResult<ConnectionProperties> {
    Err(crate::errors::AppError::UnsupportedFeature("PostgreSQL metadata not yet implemented".into()))
}

pub fn list_databases(_handle: &DbConnectionHandle) -> AppResult<Vec<String>> { unimplemented!("PostgreSQL list_databases") }
pub fn list_tables(_handle: &DbConnectionHandle, _schema: &str) -> AppResult<Vec<String>> { unimplemented!("PostgreSQL list_tables") }
