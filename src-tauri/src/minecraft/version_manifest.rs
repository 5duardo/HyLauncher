// ============================================================
// HyLauncher — Mojang Version Manifest & Asset/Library Downloader
// ============================================================

use crate::utils::{error::{LauncherError, Result}, http, paths};
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::Emitter;

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

// ---- Types ----

#[derive(Debug, Deserialize)]
pub struct VersionManifest {
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct VersionJson {
    pub id: String,
    pub downloads: Downloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    pub assets: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<Arguments>,
}

#[derive(Debug, Deserialize)]
pub struct Downloads {
    pub client: DownloadEntry,
}

#[derive(Debug, Deserialize)]
pub struct DownloadEntry {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<ArtifactDownload>,
}

#[derive(Debug, Deserialize)]
pub struct ArtifactDownload {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<RuleOs>,
}

#[derive(Debug, Deserialize)]
pub struct RuleOs {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexJson {
    pub objects: std::collections::HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
}

#[derive(Debug, Deserialize)]
pub struct Arguments {
    pub game: Option<Vec<serde_json::Value>>,
    pub jvm: Option<Vec<serde_json::Value>>,
}

// ---- Implementation ----

/// Check if Minecraft 1.20.1 client is fully installed
pub fn is_installed(mc_version: &str) -> bool {
    let client_jar = paths::versions_dir()
        .join(mc_version)
        .join(format!("{}.jar", mc_version));
    let asset_index = paths::assets_dir().join("indexes");

    client_jar.exists() && asset_index.exists()
}

/// Download Minecraft client, libraries, and assets
pub async fn install(
    client: &Client,
    mc_version: &str,
    app_handle: &tauri::AppHandle,
) -> Result<VersionJson> {
    log::info!("Fetching Mojang version manifest...");

    // 1. Get version manifest
    let manifest: VersionManifest = http::download_json(client, VERSION_MANIFEST_URL).await?;

    let version_entry = manifest
        .versions
        .iter()
        .find(|v| v.id == mc_version)
        .ok_or_else(|| {
            LauncherError::Install(format!("Minecraft version {} not found in manifest", mc_version))
        })?;

    // 2. Get version JSON
    let version_json: VersionJson = http::download_json(client, &version_entry.url).await?;

    // 3. Download client JAR
    let client_dir = paths::versions_dir().join(mc_version);
    std::fs::create_dir_all(&client_dir)?;
    let client_jar = client_dir.join(format!("{}.jar", mc_version));

    if !client_jar.exists() || needs_redownload(&client_jar, &version_json.downloads.client.sha1).await {
        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "downloading_minecraft",
            "current": 0,
            "total": 1,
            "detail": format!("{}.jar", mc_version)
        }));

        http::download_file_with_retry(
            client,
            &version_json.downloads.client.url,
            &client_jar,
            Some(&version_json.downloads.client.sha1),
            3,
        )
        .await?;
    }

    // 4. Download libraries
    let applicable_libs: Vec<&Library> = version_json
        .libraries
        .iter()
        .filter(|lib| is_library_applicable(lib))
        .collect();

    let total_libs = applicable_libs.len();
    for (i, lib) in applicable_libs.iter().enumerate() {
        if let Some(ref downloads) = lib.downloads {
            if let Some(ref artifact) = downloads.artifact {
                let lib_path = paths::libraries_dir().join(&artifact.path);
                if !lib_path.exists() || needs_redownload(&lib_path, &artifact.sha1).await {
                    let _ = app_handle.emit("progress", serde_json::json!({
                        "stage": "downloading_libraries",
                        "current": i,
                        "total": total_libs,
                        "detail": lib.name.clone()
                    }));

                    http::download_file_with_retry(
                        client,
                        &artifact.url,
                        &lib_path,
                        Some(&artifact.sha1),
                        3,
                    )
                    .await?;
                }
            }
        }
    }

    // 5. Download asset index
    let index_dir = paths::assets_dir().join("indexes");
    std::fs::create_dir_all(&index_dir)?;
    let index_file = index_dir.join(format!("{}.json", version_json.asset_index.id));

    if !index_file.exists() {
        http::download_file_with_retry(
            client,
            &version_json.asset_index.url,
            &index_file,
            Some(&version_json.asset_index.sha1),
            3,
        )
        .await?;
    }

    // 6. Download assets
    let index_data = std::fs::read_to_string(&index_file)?;
    let asset_index: AssetIndexJson = serde_json::from_str(&index_data)?;

    let total_assets = asset_index.objects.len();
    let objects_dir = paths::assets_dir().join("objects");
    std::fs::create_dir_all(&objects_dir)?;

    for (i, (_name, obj)) in asset_index.objects.iter().enumerate() {
        let prefix = &obj.hash[..2];
        let asset_path = objects_dir.join(prefix).join(&obj.hash);

        if !asset_path.exists() {
            if i % 50 == 0 {
                let _ = app_handle.emit("progress", serde_json::json!({
                    "stage": "downloading_assets",
                    "current": i,
                    "total": total_assets,
                    "detail": format!("{}/{}", prefix, &obj.hash[..8])
                }));
            }

            let url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                prefix, obj.hash
            );
            http::download_file_with_retry(client, &url, &asset_path, Some(&obj.hash), 3).await?;
        }
    }

    let _ = app_handle.emit("progress", serde_json::json!({
        "stage": "downloading_assets",
        "current": total_assets,
        "total": total_assets,
        "detail": "Assets completos ✓"
    }));

    // Save version JSON locally
    let version_json_path = client_dir.join(format!("{}.json", mc_version));
    let json_str = serde_json::to_string_pretty(&serde_json::json!({
        "id": version_json.id,
        "mainClass": version_json.main_class,
        "assets": version_json.assets,
    }))?;
    std::fs::write(&version_json_path, json_str)?;

    log::info!("Minecraft {} installation complete", mc_version);
    Ok(version_json)
}

/// Check if a library should be downloaded (OS-based rules)
fn is_library_applicable(lib: &Library) -> bool {
    match &lib.rules {
        None => true,
        Some(rules) => {
            let mut dominated_allow = false;
            for rule in rules {
                match rule.os {
                    None => {
                        dominated_allow = rule.action == "allow";
                    }
                    Some(ref os) => {
                        if os.name.as_deref() == Some("windows") {
                            dominated_allow = rule.action == "allow";
                        }
                    }
                }
            }
            dominated_allow
        }
    }
}

/// Check if a file needs re-downloading (hash mismatch)
async fn needs_redownload(path: &PathBuf, expected_sha1: &str) -> bool {
    match http::compute_file_sha1(path).await {
        Ok(hash) => hash != expected_sha1,
        Err(_) => true,
    }
}

/// Get the classpath for all vanilla libraries
pub fn get_vanilla_classpath(version_json: &VersionJson) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    for lib in &version_json.libraries {
        if !is_library_applicable(lib) {
            continue;
        }
        if let Some(ref downloads) = lib.downloads {
            if let Some(ref artifact) = downloads.artifact {
                paths.push(paths::libraries_dir().join(&artifact.path));
            }
        }
    }

    // Add client JAR
    paths.push(
        paths::versions_dir()
            .join(&version_json.id)
            .join(format!("{}.jar", version_json.id)),
    );

    paths
}
