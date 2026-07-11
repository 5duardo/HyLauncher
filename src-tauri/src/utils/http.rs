// ============================================================
// HyLauncher — HTTP Client Utilities
// ============================================================

use reqwest::Client;
use std::path::Path;
use tokio::io::AsyncWriteExt;
use crate::utils::error::{LauncherError, Result};

/// Create a shared HTTP client with reasonable defaults
pub fn create_client() -> Result<Client> {
    Client::builder()
        .user_agent("HyLauncher/1.0.0")
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(LauncherError::Http)
}

/// Download a file to disk with optional SHA1 verification
/// Returns the number of bytes written
pub async fn download_file(
    client: &Client,
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
) -> Result<u64> {
    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let response = client.get(url).send().await?.error_for_status()?;
    let bytes = response.bytes().await?;
    let len = bytes.len() as u64;

    // Verify hash if provided
    if let Some(expected) = expected_sha1 {
        let actual = compute_sha1(&bytes);
        if actual != expected {
            return Err(LauncherError::HashMismatch {
                file: dest.display().to_string(),
                expected: expected.to_string(),
                actual,
            });
        }
    }

    // Write to file
    let mut file = tokio::fs::File::create(dest).await?;
    file.write_all(&bytes).await?;
    file.flush().await?;

    Ok(len)
}


/// Download JSON and deserialize
pub async fn download_json<T: serde::de::DeserializeOwned>(
    client: &Client,
    url: &str,
) -> Result<T> {
    let response = client.get(url).send().await?.error_for_status()?;
    let json = response.json::<T>().await?;
    Ok(json)
}

/// Compute SHA1 hash of bytes
pub fn compute_sha1(data: &[u8]) -> String {
    use sha1::{Sha1, Digest};
    let mut hasher = Sha1::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Compute SHA1 hash of a file on disk
pub async fn compute_file_sha1(path: &Path) -> Result<String> {
    let data = tokio::fs::read(path).await?;
    Ok(compute_sha1(&data))
}

/// Download with retries (up to max_retries)
pub async fn download_file_with_retry(
    client: &Client,
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
    max_retries: u32,
) -> Result<u64> {
    let mut last_error = None;
    for attempt in 0..=max_retries {
        match download_file(client, url, dest, expected_sha1).await {
            Ok(bytes) => return Ok(bytes),
            Err(e) => {
                log::warn!(
                    "Download attempt {}/{} failed for {}: {}",
                    attempt + 1,
                    max_retries + 1,
                    url,
                    e
                );
                last_error = Some(e);
                if attempt < max_retries {
                    tokio::time::sleep(std::time::Duration::from_secs(2u64.pow(attempt))).await;
                }
            }
        }
    }
    Err(last_error.unwrap())
}
