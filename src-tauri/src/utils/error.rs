// ============================================================
// HyLauncher — Error Types
// ============================================================

use thiserror::Error;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Hash mismatch for {file}: expected {expected}, got {actual}")]
    HashMismatch {
        file: String,
        expected: String,
        actual: String,
    },

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Minecraft installation error: {0}")]
    Install(String),

    #[error("Java not found: {0}")]
    Java(String),

    #[error("Manifest error: {0}")]
    Manifest(String),

    #[error("Zip extraction error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("{0}")]
    Other(String),
}

// Make LauncherError serializable for Tauri
impl serde::Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, LauncherError>;
