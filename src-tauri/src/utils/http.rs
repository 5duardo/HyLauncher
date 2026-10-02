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
        .user_agent(concat!(
            "HyLauncher/",
            env!("CARGO_PKG_VERSION"),
            " (+https://github.com/5duardo/HyLauncher)"
        ))
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(15))
        .pool_max_idle_per_host(8)
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

    let response = client.get(url).send().await?;
    // 429/5xx: no consumir el error todavía, el retry necesita Retry-After.
    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
        || response.status().is_server_error()
    {
        return Err(rate_limit_error(url, &response));
    }
    let response = response.error_for_status()?;
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

/// Error de rate-limit con los segundos que pide el servidor (Retry-After).
fn rate_limit_error(url: &str, response: &reqwest::Response) -> LauncherError {
    let wait = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<u64>().ok())
        .unwrap_or(0)
        .min(60);
    LauncherError::RateLimited {
        url: url.to_string(),
        retry_after_secs: wait,
    }
}

fn is_retryable(e: &LauncherError) -> bool {
    match e {
        LauncherError::RateLimited { .. } => true,
        LauncherError::Http(e) => {
            e.is_timeout() || e.is_connect() || e.is_body() || e.is_decode()
                || e.status().map(|s| s == reqwest::StatusCode::TOO_MANY_REQUESTS || s.is_server_error()).unwrap_or(false)
        }
        LauncherError::Io(_) => true,
        _ => false,
    }
}

fn jitter_ms() -> u64 {
    // Sin crate rand: nanos del reloj como jitter barato.
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| (d.subsec_nanos() % 700) as u64)
        .unwrap_or(250)
}

/// Download with retries: backoff exponencial + respeta Retry-After (429/503).
/// Los 429 de Modrinth en descargas múltiples se absorben aquí.
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
                let retryable = is_retryable(&e);
                log::warn!(
                    "Download attempt {}/{} failed for {}: {} (retryable={})",
                    attempt + 1,
                    max_retries + 1,
                    url,
                    e,
                    retryable
                );
                last_error = Some(e);
                if attempt >= max_retries {
                    break;
                }
                let Some(err) = last_error.as_ref() else {
                    break;
                };
                if !retryable {
                    break;
                }
                // Si el CDN pidió espera, obedecerla; si no, backoff 1s/2s/4s... (tope 30s) + jitter.
                let mut wait = std::time::Duration::from_secs(1u64 << attempt.min(5))
                    + std::time::Duration::from_millis(jitter_ms());
                if let LauncherError::RateLimited { retry_after_secs, .. } = err {
                    if *retry_after_secs > 0 {
                        wait = std::time::Duration::from_secs((*retry_after_secs).min(60));
                    }
                }
                if wait > std::time::Duration::from_secs(30) {
                    wait = std::time::Duration::from_secs(30) + std::time::Duration::from_millis(jitter_ms());
                }
                tokio::time::sleep(wait).await;
            }
        }
    }
    Err(last_error.unwrap())
}
