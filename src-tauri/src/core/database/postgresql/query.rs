use crate::core::database::traits::DbConnectionHandle;
use crate::errors::AppResult;
use crate::models::query::*;

pub fn execute_query(_handle: &DbConnectionHandle, _sql: &str) -> AppResult<QueryResult> { unimplemented!("PostgreSQL execute_query") }
pub fn execute_update(_handle: &DbConnectionHandle, _sql: &str) -> AppResult<ExecResult> { unimplemented!("PostgreSQL execute_update") }
