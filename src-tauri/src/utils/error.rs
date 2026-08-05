use crate::errors::AppError;

pub fn to_app_error<E: std::fmt::Display>(err: E) -> AppError {
    AppError::Internal(err.to_string())
}
