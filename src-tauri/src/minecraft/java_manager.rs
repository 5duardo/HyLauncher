// ============================================================
// HyLauncher — Java Runtime Manager
// ============================================================

use crate::utils::error::Result;
use reqwest::Client;

/// Check if Java 17 is available (always returns true, using system java)
pub fn is_java_available() -> bool {
    true
}

/// Download and install Java 17 JRE (no-op since we use system Java)
pub async fn install_java(_client: &Client, _app_handle: &tauri::AppHandle) -> Result<()> {
    log::info!("Using system Java runtime");
    Ok(())
}
