// ============================================================
// HyLauncher — GitHub Releases updater
// ============================================================

use crate::utils::{error::LauncherError, http, paths};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

const GITHUB_REPO: &str = "5duardo/HyLauncher";

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    html_url: String,
    assets: Vec<GhAsset>,
    #[allow(dead_code)]
    prerelease: bool,
    draft: bool,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub release_notes: String,
    pub html_url: String,
    pub download_url: Option<String>,
    pub download_size: Option<u64>,
    pub download_filename: Option<String>,
}

fn normalize_version(raw: &str) -> String {
    raw.trim()
        .trim_start_matches('v')
        .trim_start_matches('V')
        .to_string()
}

fn parse_semver(v: &str) -> Vec<u64> {
    normalize_version(v)
        .split(|c| c == '.' || c == '-' || c == '+')
        .filter_map(|p| p.parse::<u64>().ok())
        .collect()
}

fn cmp_versions(a: &str, b: &str) -> Ordering {
    let av = parse_semver(a);
    let bv = parse_semver(b);
    let len = av.len().max(bv.len());
    for i in 0..len {
        let x = av.get(i).copied().unwrap_or(0);
        let y = bv.get(i).copied().unwrap_or(0);
        match x.cmp(&y) {
            Ordering::Equal => continue,
            other => return other,
        }
    }
    Ordering::Equal
}

fn pick_windows_asset(assets: &[GhAsset]) -> Option<&GhAsset> {
    let preferred = ["setup.exe", ".exe", ".msi", ".nsis.zip"];
    for tip in preferred {
        if let Some(a) = assets.iter().find(|a| {
            let n = a.name.to_lowercase();
            n.contains(tip) && !n.contains("pdb") && !n.contains("debug")
        }) {
            return Some(a);
        }
    }
    assets.iter().find(|a| {
        let n = a.name.to_lowercase();
        (n.ends_with(".exe") || n.ends_with(".msi")) && !n.contains("pdb")
    })
}

pub async fn check_for_update(
    client: &Client,
    current: &str,
) -> Result<UpdateCheckResult, LauncherError> {
    let repo = std::env::var("GITHUB_REPO").unwrap_or_else(|_| GITHUB_REPO.to_string());
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");

    let release: GhRelease = client
        .get(&url)
        .header("User-Agent", "HyLauncher")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .map_err(|e| LauncherError::Other(format!("GitHub API: {e}")))?;

    if release.draft {
        return Ok(UpdateCheckResult {
            update_available: false,
            current_version: current.to_string(),
            latest_version: current.to_string(),
            release_name: String::new(),
            release_notes: String::new(),
            html_url: release.html_url,
            download_url: None,
            download_size: None,
            download_filename: None,
        });
    }

    let latest = normalize_version(&release.tag_name);
    let current = normalize_version(current);
    let update_available = cmp_versions(&latest, &current) == Ordering::Greater;
    let asset = pick_windows_asset(&release.assets);

    Ok(UpdateCheckResult {
        update_available,
        current_version: current,
        latest_version: latest,
        release_name: release.name.unwrap_or_else(|| release.tag_name.clone()),
        release_notes: release.body.unwrap_or_default(),
        html_url: release.html_url,
        download_url: asset.map(|a| a.browser_download_url.clone()),
        download_size: asset.map(|a| a.size),
        download_filename: asset.map(|a| a.name.clone()),
    })
}

pub async fn download_update_installer(
    client: &Client,
    download_url: &str,
    filename: &str,
) -> Result<String, LauncherError> {
    let dest_dir = paths::cache_dir().join("updates");
    std::fs::create_dir_all(&dest_dir)?;
    let dest = dest_dir.join(filename);

    http::download_file_with_retry(client, download_url, &dest, None, 3).await?;

    Ok(dest.display().to_string())
}
