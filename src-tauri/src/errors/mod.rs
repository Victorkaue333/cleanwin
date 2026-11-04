//! Application error type shared by every Tauri command.
//!
//! Errors cross the IPC boundary as `{ code, message }` so the frontend can
//! localise by `code` and still show the technical `message` when useful.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid operation: {0}")]
    InvalidOperation(String),
    #[error("protected: {0}")]
    Protected(String),
    #[error("unsupported: {0}")]
    Unsupported(String),
    #[error("busy: {0}")]
    Busy(String),
    #[allow(dead_code)]
    #[error("cancelled")]
    Cancelled,
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "io",
            AppError::PermissionDenied(_) => "permission_denied",
            AppError::NotFound(_) => "not_found",
            AppError::InvalidOperation(_) => "invalid_operation",
            AppError::Protected(_) => "protected",
            AppError::Unsupported(_) => "unsupported",
            AppError::Busy(_) => "busy",
            AppError::Cancelled => "cancelled",
            AppError::Internal(_) => "internal",
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload<'a> {
    code: &'a str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        ErrorPayload {
            code: self.code(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

impl From<tauri::Error> for AppError {
    fn from(value: tauri::Error) -> Self {
        AppError::Internal(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        AppError::Internal(format!("serialization error: {value}"))
    }
}

impl From<sysinfo::Error> for AppError {
    fn from(value: sysinfo::Error) -> Self {
        match value {
            sysinfo::Error::Unsupported => AppError::Unsupported("sysinfo".into()),
            other => AppError::Internal(other.to_string()),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
