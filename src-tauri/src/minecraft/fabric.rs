// ============================================================
// HyLauncher — Fabric Loader Installation (Headless via Meta API)
// ============================================================

use crate::utils::{error::{LauncherError, Result}, http, paths};
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::Emitter;

const FABRIC_META_BASE: &str = "https://meta.fabricmc.net/v2";

// ---- Types ----

#[derive(Debug, Deserialize)]
pub struct FabricLoaderVersion {
    pub loader: FabricLoader,
}

#[derive(Debug, Deserialize)]
pub struct FabricLoader {
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Deserialize)]
pub struct FabricProfile {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub libraries: Vec<FabricLibrary>,
    pub arguments: Option<FabricArguments>,
}

#[derive(Debug, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FabricArguments {
    pub game: Option<Vec<String>>,
    pub jvm: Option<Vec<String>>,
}

// ---- Implementation ----

/// Get the latest stable Fabric loader version for a given MC version
pub async fn get_latest_loader_version(
    client: &Client,
    mc_version: &str,
) -> Result<String> {
    let url = format!("{}/versions/loader/{}", FABRIC_META_BASE, mc_version);
    let versions: Vec<FabricLoaderVersion> = http::download_json(client, &url).await?;

    versions
        .iter()
        .find(|v| v.loader.stable)
        .or_else(|| versions.first())
        .map(|v| v.loader.version.clone())
        .ok_or_else(|| {
            LauncherError::Install(format!(
                "No Fabric loader found for Minecraft {}",
                mc_version
            ))
        })
}

/// Download and install Fabric loader using the Meta API (no fabric-installer.jar needed)
pub async fn install(
    client: &Client,
    mc_version: &str,
    loader_version: &str,
    app_handle: &tauri::AppHandle,
) -> Result<FabricProfile> {
    let _ = app_handle.emit("progress", serde_json::json!({
        "stage": "installing_fabric",
        "current": 0,
        "total": 1,
        "detail": format!("Fabric Loader {}", loader_version)
    }));

    // 1. Get the profile JSON from Fabric Meta
    let profile_url = format!(
        "{}/versions/loader/{}/{}/profile/json",
        FABRIC_META_BASE, mc_version, loader_version
    );

    log::info!("Fetching Fabric profile from: {}", profile_url);
    let profile: FabricProfile = http::download_json(client, &profile_url).await?;

    // 2. Save the profile JSON to the versions directory
    let version_dir = paths::versions_dir().join(&profile.id);
    std::fs::create_dir_all(&version_dir)?;

    let profile_path = version_dir.join(format!("{}.json", profile.id));
    let profile_json = serde_json::to_string_pretty(&serde_json::json!({
        "id": profile.id,
        "mainClass": profile.main_class,
        "libraries": profile.libraries.iter().map(|l| serde_json::json!({
            "name": l.name,
            "url": l.url,
        })).collect::<Vec<_>>(),
    }))?;
    std::fs::write(&profile_path, profile_json)?;

    // 3. Download all Fabric libraries
    let total = profile.libraries.len();
    for (i, lib) in profile.libraries.iter().enumerate() {
        let lib_path = maven_name_to_path(&lib.name);
        let full_path = paths::libraries_dir().join(&lib_path);

        if full_path.exists() {
            continue;
        }

        // Determine the download URL
        let base_url = lib
            .url
            .as_deref()
            .unwrap_or("https://maven.fabricmc.net/");

        let url = format!("{}{}", base_url.trim_end_matches('/'), &format!("/{}", lib_path));

        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "installing_fabric",
            "current": i,
            "total": total,
            "detail": lib.name.clone()
        }));

        // Download without SHA1 check (Fabric Meta doesn't provide hashes in profile)
        match http::download_file_with_retry(client, &url, &full_path, None, 3).await {
            Ok(_) => {}
            Err(e) => {
                // Try Maven Central as fallback
                let maven_central_url =
                    format!("https://repo1.maven.org/maven2/{}", lib_path);
                log::warn!(
                    "Fabric library download failed from {}, trying Maven Central: {}",
                    url,
                    e
                );
                http::download_file_with_retry(
                    client,
                    &maven_central_url,
                    &full_path,
                    None,
                    3,
                )
                .await?;
            }
        }
    }

    let _ = app_handle.emit("progress", serde_json::json!({
        "stage": "installing_fabric",
        "current": 1,
        "total": 1,
        "detail": "Fabric Loader instalado ✓"
    }));

    log::info!(
        "Fabric Loader {} for MC {} installed successfully",
        loader_version,
        mc_version
    );
    Ok(profile)
}

/// Convert a Maven coordinate (group:artifact:version) to a relative file path
/// e.g. "net.fabricmc:fabric-loader:0.16.14" -> "net/fabricmc/fabric-loader/0.16.14/fabric-loader-0.16.14.jar"
pub fn maven_name_to_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.to_string();
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    // Handle optional classifier (e.g. "group:artifact:version:classifier")
    if parts.len() >= 4 {
        let classifier = parts[3];
        format!(
            "{}/{}/{}/{}-{}-{}.jar",
            group, artifact, version, artifact, version, classifier
        )
    } else {
        format!(
            "{}/{}/{}/{}-{}.jar",
            group, artifact, version, artifact, version
        )
    }
}

/// Get the classpath for Fabric libraries
pub fn get_fabric_classpath(profile: &FabricProfile) -> Vec<PathBuf> {
    profile
        .libraries
        .iter()
        .map(|lib| paths::libraries_dir().join(maven_name_to_path(&lib.name)))
        .collect()
}
