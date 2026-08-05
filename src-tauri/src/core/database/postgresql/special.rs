use crate::core::database::traits::DbConnectionHandle;
use crate::errors::AppResult;
use crate::models::query::SpecialResult;

pub fn execute_special(_handle: &DbConnectionHandle, _sql: &str) -> AppResult<SpecialResult> {
    Err(crate::errors::AppError::UnsupportedFeature("PostgreSQL special SQL not yet implemented".into()))
}
