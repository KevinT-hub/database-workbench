use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("csv error: {0}")]
    Csv(String),
    #[error("xlsx error: {0}")]
    Xlsx(String),
    #[error("calamine error: {0}")]
    Calamine(String),
    #[error("pool not found: pool_id={0}")]
    PoolNotFound(u64),
    #[error("connection not found: pool_id={0}, conn_id={1}")]
    ConnectionNotFound(u64, u64),
    #[error("pool create failed: {0}")]
    PoolCreateFailed(String),
    #[error("connection lost: pool_id={0}, conn_id={1}")]
    ConnectionLost(u64, u64),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("query failed: {0}")]
    QueryFailed(String),
    #[error("execute failed: {0}")]
    ExecuteFailed(String),

    #[error("unsupported db_type: {0:?}")]
    UnsupportedDbType(crate::models::connection::DbType),
    #[error("unsupported feature: {0}")]
    UnsupportedFeature(String),

    #[error("config error: {0}")]
    Config(String),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("file not found: {0}")]
    FileNotFound(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("updater error: {0}")]
    Updater(String),

    #[error("invalid cron expression: {0}")]
    InvalidCron(String),
    #[error("schedule conflict: {0}")]
    ScheduleConflict(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl From<csv::Error> for AppError {
    fn from(e: csv::Error) -> Self { AppError::Csv(e.to_string()) }
}

impl From<rust_xlsxwriter::XlsxError> for AppError {
    fn from(e: rust_xlsxwriter::XlsxError) -> Self { AppError::Xlsx(e.to_string()) }
}

impl From<calamine::Error> for AppError {
    fn from(e: calamine::Error) -> Self { AppError::Calamine(e.to_string()) }
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("AppError", 2)?;
        st.serialize_field("code", &format!("{:?}", self))?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}
