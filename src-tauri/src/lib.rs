// ============================================================
// HyLauncher — Tauri Command Registration (lib.rs)
// ============================================================

mod auth;
mod minecraft;
mod modpack;
mod utils;

use auth::{account_store::{AccountStore, StoredAccount, now_secs}, microsoft, offline};
use minecraft::{fabric, java_manager, launcher, version_manifest};
use modpack::{diff, downloader, manifest::PackManifest};
use utils::{error::LauncherError, http, paths};

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// ---- Application State ----

pub struct AppState {
    pub http_client: reqwest::Client,
    pub account_store: Mutex<AccountStore>,
    pub game_child: Mutex<Option<std::process::Child>>,
    pub cached_manifest: Mutex<Option<PackManifest>>,
    pub cached_diff: Mutex<Option<diff::UpdateDiff>>,
    pub cached_version_json: Mutex<Option<version_manifest::VersionJson>>,
    pub cached_fabric_profile: Mutex<Option<fabric::FabricProfile>>,
}

// ---- Config Constants ----
// TODO: Replace with your actual manifest URL
const MANIFEST_URL: &str = "https://raw.githubusercontent.com/YOUR_USER/hypack/main/manifest.json";
const MC_VERSION: &str = "1.20.1";

// ---- Settings ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherSettings {
    #[serde(rename = "ramMb")]
    pub ram_mb: u32,
    #[serde(rename = "javaPathOverride")]
    pub java_path_override: Option<String>,
    #[serde(rename = "instancePath")]
    pub instance_path: Option<String>,
    pub theme: String,
    pub language: String,
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            ram_mb: 4096,
            java_path_override: None,
            instance_path: None,
            theme: "dark".to_string(),
            language: "es".to_string(),
        }
    }
}

// ============================================================
// Tauri Commands — Authentication
// ============================================================

#[tauri::command]
async fn start_microsoft_login(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LauncherError> {
    let dc = microsoft::request_device_code(&state.http_client).await?;
    Ok(serde_json::json!({
        "userCode": dc.user_code,
        "verificationUri": dc.verification_uri,
        "expiresIn": dc.expires_in,
        "interval": dc.interval,
        "deviceCode": dc.device_code,
    }))
}

#[tauri::command]
async fn poll_microsoft_login(
    state: State<'_, AppState>,
    device_code: String,
) -> Result<serde_json::Value, LauncherError> {
    // We need the full device code info — use a default interval/expiry
    let result = microsoft::full_microsoft_auth(
        &state.http_client,
        &device_code,
        5, // interval
        900, // expires_in
    )
    .await?;

    // Store account
    let account = StoredAccount {
        id: format!("ms_{}", result.uuid),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        mode: "premium".to_string(),
        access_token: Some(result.access_token),
        refresh_token: result.refresh_token,
        skin_url: Some(format!(
            "https://crafatar.com/avatars/{}?size=36&overlay",
            result.uuid.replace("-", "")
        )),
        last_used: now_secs(),
    };

    let mut store = state.account_store.lock().unwrap();
    store.upsert(account.clone());
    store.set_active(&account.id);
    store.save()?;

    Ok(serde_json::json!({
        "id": account.id,
        "username": account.username,
        "uuid": account.uuid,
        "mode": "premium",
        "skinUrl": account.skin_url,
        "lastUsed": account.last_used,
    }))
}

#[tauri::command]
async fn cancel_microsoft_login() -> Result<(), LauncherError> {
    // Device code flow is cancelled by simply stopping the polling
    Ok(())
}

#[tauri::command]
async fn login_offline(
    state: State<'_, AppState>,
    username: String,
) -> Result<serde_json::Value, LauncherError> {
    let uuid = offline::generate_offline_uuid(&username);

    let account = StoredAccount {
        id: format!("offline_{}", username.to_lowercase()),
        username: username.clone(),
        uuid: uuid.clone(),
        mode: "offline".to_string(),
        access_token: None,
        refresh_token: None,
        skin_url: None,
        last_used: now_secs(),
    };

    let mut store = state.account_store.lock().unwrap();
    store.upsert(account.clone());
    store.set_active(&account.id);
    store.save()?;

    Ok(serde_json::json!({
        "id": account.id,
        "username": account.username,
        "uuid": account.uuid,
        "mode": "offline",
        "lastUsed": account.last_used,
    }))
}

#[tauri::command]
fn get_accounts(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, LauncherError> {
    let store = state.account_store.lock().unwrap();
    let accounts = store
        .accounts
        .iter()
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "username": a.username,
                "uuid": a.uuid,
                "mode": a.mode,
                "skinUrl": a.skin_url,
                "lastUsed": a.last_used,
            })
        })
        .collect();
    Ok(accounts)
}

#[tauri::command]
fn get_active_account(state: State<'_, AppState>) -> Result<Option<serde_json::Value>, LauncherError> {
    let store = state.account_store.lock().unwrap();
    Ok(store.active().map(|a| {
        serde_json::json!({
            "id": a.id,
            "username": a.username,
            "uuid": a.uuid,
            "mode": a.mode,
            "skinUrl": a.skin_url,
            "lastUsed": a.last_used,
        })
    }))
}

#[tauri::command]
fn set_active_account(state: State<'_, AppState>, account_id: String) -> Result<(), LauncherError> {
    let mut store = state.account_store.lock().unwrap();
    store.set_active(&account_id);
    store.save()?;
    Ok(())
}

#[tauri::command]
fn remove_account(state: State<'_, AppState>, account_id: String) -> Result<(), LauncherError> {
    let mut store = state.account_store.lock().unwrap();
    store.remove(&account_id);
    store.save()?;
    Ok(())
}

// ============================================================
// Tauri Commands — Modpack
// ============================================================

#[tauri::command]
async fn check_for_updates(
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<Option<serde_json::Value>, LauncherError> {
    log::info!("Checking for updates from {}", MANIFEST_URL);

    // Fetch remote manifest, with fallback to local manifest-example.json if using the placeholder URL
    let remote: PackManifest = if MANIFEST_URL.contains("YOUR_USER") {
        let fallback_path = if std::path::Path::new("manifest-example.json").exists() {
            std::path::Path::new("manifest-example.json").to_path_buf()
        } else if std::path::Path::new("../manifest-example.json").exists() {
            std::path::Path::new("../manifest-example.json").to_path_buf()
        } else {
            paths::launcher_data_dir().join("manifest.json")
        };

        if fallback_path.exists() {
            let data = std::fs::read_to_string(&fallback_path)?;
            serde_json::from_str(&data)?
        } else {
            let dummy = PackManifest {
                pack_version: "1.0.0".to_string(),
                pack_name: "HyPack".to_string(),
                pack_description: "Modpack de prueba (Modifica manifest-example.json)".to_string(),
                minecraft: "1.20.1".to_string(),
                fabric_loader: "0.19.3".to_string(),
                base_url: "https://github.com".to_string(),
                mods: vec![],
                configs: vec![],
                resource_packs: vec![],
                shader_packs: vec![],
                optional_resource_packs: vec![],
                optional_shader_packs: vec![],
                protected_paths: vec![],
                server: modpack::manifest::ServerConfig {
                    name: "HyServer".to_string(),
                    address: "localhost".to_string(),
                    port: 25565,
                    auto_connect: true,
                },
                java: None,
            };
            let json = serde_json::to_string_pretty(&dummy)?;
            std::fs::write(&fallback_path, json)?;
            dummy
        }
    } else {
        match http::download_json(&state.http_client, MANIFEST_URL).await {
            Ok(manifest) => manifest,
            Err(e) => {
                let local_path = paths::local_manifest_file();
                if local_path.exists() {
                    let data = std::fs::read_to_string(&local_path)?;
                    serde_json::from_str(&data)?
                } else {
                    return Err(e);
                }
            }
        }
    };

    // Load local manifest
    let local_path = paths::local_manifest_file();
    let local: Option<PackManifest> = if local_path.exists() {
        let data = std::fs::read_to_string(&local_path)?;
        serde_json::from_str(&data).ok()
    } else {
        None
    };

    // Compute diff
    let update_diff = diff::compute_diff(&remote, local.as_ref()).await;

    if update_diff.is_empty() {
        // Save manifest as up-to-date
        let json = serde_json::to_string_pretty(&remote)?;
        std::fs::write(&local_path, json)?;

        *state.cached_manifest.lock().unwrap() = Some(remote);
        *state.cached_diff.lock().unwrap() = None;
        return Ok(None);
    }

    let result = serde_json::json!({
        "modsToDownload": update_diff.mods_to_download.iter().map(|m| serde_json::json!({
            "id": m.id,
            "filename": m.filename,
            "url": m.url,
            "sha1": m.sha1,
            "size": m.size,
            "required": m.required,
            "side": m.side,
        })).collect::<Vec<_>>(),
        "modsToDelete": update_diff.mods_to_delete,
        "configsToUpdate": update_diff.configs_to_update.iter().map(|c| serde_json::json!({
            "path": c.path,
            "url": c.url,
            "sha1": c.sha1,
            "overwritePolicy": c.overwrite_policy,
        })).collect::<Vec<_>>(),
        "resourcePacksToUpdate": update_diff.resource_packs_to_update.len(),
        "shaderPacksToUpdate": update_diff.shader_packs_to_update.len(),
        "totalDownloadSize": update_diff.total_download_size,
        "isFullInstall": update_diff.is_full_install,
    });

    *state.cached_manifest.lock().unwrap() = Some(remote);
    *state.cached_diff.lock().unwrap() = Some(update_diff);

    Ok(Some(result))
}

#[tauri::command]
async fn execute_update(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), LauncherError> {
    let manifest = state
        .cached_manifest
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| LauncherError::Manifest("No manifest cached".to_string()))?;

    let update_diff = state
        .cached_diff
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| LauncherError::Manifest("No diff cached".to_string()))?;

    // Execute downloads
    downloader::execute_diff(&state.http_client, &update_diff, &manifest, &app).await?;

    // Save manifest as local
    let local_path = paths::local_manifest_file();
    let json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&local_path, json)?;

    *state.cached_diff.lock().unwrap() = None;

    Ok(())
}

#[tauri::command]
fn get_local_manifest(state: State<'_, AppState>) -> Result<Option<serde_json::Value>, LauncherError> {
    // Try cache first
    if let Some(ref manifest) = *state.cached_manifest.lock().unwrap() {
        return Ok(Some(serde_json::to_value(manifest).unwrap()));
    }

    // Try disk
    let path = paths::local_manifest_file();
    if path.exists() {
        let data = std::fs::read_to_string(&path)?;
        let manifest: PackManifest = serde_json::from_str(&data)?;
        let value = serde_json::to_value(&manifest).unwrap();
        *state.cached_manifest.lock().unwrap() = Some(manifest);
        return Ok(Some(value));
    }

    Ok(None)
}

// ============================================================
// Tauri Commands — Minecraft
// ============================================================

#[tauri::command]
fn is_minecraft_installed(state: State<'_, AppState>) -> bool {
    let vanilla_ok = version_manifest::is_installed(MC_VERSION);
    if !vanilla_ok {
        return false;
    }

    let manifest = state.cached_manifest.lock().unwrap();
    match manifest.as_ref() {
        Some(m) => {
            let fabric_dir = paths::versions_dir()
                .join(format!("fabric-loader-{}-{}", m.fabric_loader, MC_VERSION));
            fabric_dir.exists()
        }
        None => {
            if let Ok(entries) = std::fs::read_dir(paths::versions_dir()) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with("fabric-loader-") {
                        return true;
                    }
                }
            }
            false
        }
    }
}

#[tauri::command]
async fn install_minecraft(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), LauncherError> {
    // Install vanilla Minecraft
    let version_json =
        version_manifest::install(&state.http_client, MC_VERSION, &app).await?;

    // Get Fabric loader version from cached manifest or use latest
    let cached_loader = state.cached_manifest.lock().unwrap().as_ref().map(|m| m.fabric_loader.clone());
    let loader_version = match cached_loader {
        Some(version) => version,
        None => {
            fabric::get_latest_loader_version(&state.http_client, MC_VERSION).await?
        }
    };

    // Install Fabric
    let fabric_profile =
        fabric::install(&state.http_client, MC_VERSION, &loader_version, &app).await?;

    // Generate servers.dat
    if let Some(ref manifest) = *state.cached_manifest.lock().unwrap() {
        let _ = launcher::generate_servers_dat(
            &manifest.server.name,
            &manifest.server.address,
            manifest.server.port,
        );
    }

    *state.cached_version_json.lock().unwrap() = Some(version_json);
    *state.cached_fabric_profile.lock().unwrap() = Some(fabric_profile);

    Ok(())
}

#[tauri::command]
async fn launch_game(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), LauncherError> {
    // Get account
    let account = {
        let store = state.account_store.lock().unwrap();
        store
            .active()
            .cloned()
            .ok_or_else(|| LauncherError::Auth("No active account".to_string()))?
    };

    // Get manifest
    let manifest = state
        .cached_manifest
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| LauncherError::Manifest("No manifest loaded".to_string()))?;

    // Get settings
    let settings = load_settings();

    // We need the version JSON and fabric profile
    // If not cached, reload them from disk
    let version_json = ensure_version_json(&state).await?;
    let fabric_profile = ensure_fabric_profile(&state).await?;

    let config = launcher::LaunchConfig {
        mc_version: MC_VERSION.to_string(),
        fabric_version: manifest.fabric_loader.clone(),
        ram_mb: settings.ram_mb,
        server_address: if manifest.server.auto_connect {
            Some(manifest.server.address.clone())
        } else {
            None
        },
        server_port: if manifest.server.auto_connect {
            Some(manifest.server.port)
        } else {
            None
        },
        account,
        fabric_main_class: fabric_profile.main_class.clone(),
        vanilla_classpath: version_manifest::get_vanilla_classpath(&version_json),
        fabric_classpath: fabric::get_fabric_classpath(&fabric_profile),
        java_path: settings.java_path_override.clone(),
    };

    let child = launcher::launch(&config)?;

    *state.game_child.lock().unwrap() = Some(child);

    let _ = app.emit("state_change", "running");

    Ok(())
}

#[tauri::command]
fn is_game_running(state: State<'_, AppState>) -> bool {
    let mut child_guard = state.game_child.lock().unwrap();
    if let Some(ref mut child) = *child_guard {
        match child.try_wait() {
            Ok(Some(_)) => {
                *child_guard = None;
                false
            }
            Ok(None) => true,
            Err(_) => {
                *child_guard = None;
                false
            }
        }
    } else {
        false
    }
}

// ============================================================
// Tauri Commands — Java
// ============================================================

#[tauri::command]
fn is_java_available() -> bool {
    java_manager::is_java_available()
}

#[tauri::command]
async fn install_java(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), LauncherError> {
    java_manager::install_java(&state.http_client, &app).await
}

// ============================================================
// Tauri Commands — Settings
// ============================================================

#[tauri::command]
fn get_settings() -> LauncherSettings {
    load_settings()
}

#[tauri::command]
fn save_settings(settings: LauncherSettings) -> Result<(), LauncherError> {
    let path = paths::settings_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(&settings)?;
    std::fs::write(&path, json)?;
    Ok(())
}

// ============================================================
// Tauri Commands — Window
// ============================================================

#[tauri::command]
async fn minimize_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
async fn close_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

// ============================================================
// Helpers
// ============================================================

fn load_settings() -> LauncherSettings {
    let path = paths::settings_file();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&data) {
                return settings;
            }
        }
    }
    LauncherSettings::default()
}

async fn ensure_version_json(
    state: &State<'_, AppState>,
) -> Result<version_manifest::VersionJson, LauncherError> {
    let _vj_exists = state.cached_version_json.lock().unwrap().is_some();

    // Reload from Mojang
    let client = &state.http_client;
    let manifest: version_manifest::VersionManifest =
        http::download_json(client, "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json").await?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == MC_VERSION)
        .ok_or_else(|| LauncherError::Install("MC version not found".to_string()))?;
    let version_json: version_manifest::VersionJson =
        http::download_json(client, &entry.url).await?;
    Ok(version_json)
}

async fn ensure_fabric_profile(
    state: &State<'_, AppState>,
) -> Result<fabric::FabricProfile, LauncherError> {
    let loader_version = {
        let manifest = state.cached_manifest.lock().unwrap();
        manifest
            .as_ref()
            .map(|m| m.fabric_loader.clone())
            .unwrap_or_else(|| "0.16.14".to_string())
    };

    let url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        MC_VERSION, loader_version
    );
    let profile: fabric::FabricProfile =
        http::download_json(&state.http_client, &url).await?;
    Ok(profile)
}

// ============================================================
// Tauri Commands — Shaders and Resource Packs
// ============================================================

#[tauri::command]
async fn check_optional_file(folder_type: String, filename: String) -> Result<bool, LauncherError> {
    let dir = match folder_type.as_str() {
        "resourcepack" => paths::resourcepacks_dir(),
        "shaderpack" => paths::shaderpacks_dir(),
        _ => return Err(LauncherError::Other("Invalid folder type".to_string())),
    };
    Ok(dir.join(filename).exists())
}

#[tauri::command]
async fn download_optional_file(
    state: State<'_, AppState>,
    app: AppHandle,
    url: String,
    folder_type: String,
    filename: String,
    sha1: String,
) -> Result<(), LauncherError> {
    let dir = match folder_type.as_str() {
        "resourcepack" => paths::resourcepacks_dir(),
        "shaderpack" => paths::shaderpacks_dir(),
        _ => return Err(LauncherError::Other("Invalid folder type".to_string())),
    };
    std::fs::create_dir_all(&dir)?;
    let dest = dir.join(&filename);

    let _ = app.emit("progress", serde_json::json!({
        "stage": "downloading_optional",
        "current": 0,
        "total": 1,
        "detail": filename.clone()
    }));

    let expected_sha1 = if sha1 == "REPLACE_WITH_ACTUAL_SHA1" || sha1.is_empty() {
        None
    } else {
        Some(sha1.as_str())
    };

    http::download_file_with_retry(
        &state.http_client,
        &url,
        &dest,
        expected_sha1,
        3,
    )
    .await?;

    let _ = app.emit("progress", serde_json::json!({
        "stage": "verifying",
        "current": 1,
        "total": 1,
        "detail": format!("{} instalado ✓", filename)
    }));

    Ok(())
}

#[tauri::command]
async fn delete_optional_file(folder_type: String, filename: String) -> Result<(), LauncherError> {
    let dir = match folder_type.as_str() {
        "resourcepack" => paths::resourcepacks_dir(),
        "shaderpack" => paths::shaderpacks_dir(),
        _ => return Err(LauncherError::Other("Invalid folder type".to_string())),
    };
    let path = dir.join(filename);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

// ============================================================
// Plugin Registration
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure directories exist
    let _ = paths::ensure_dirs();

    // Load account store
    let account_store = AccountStore::load().unwrap_or_default();

    // Create HTTP client
    let http_client = http::create_client().expect("Failed to create HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            http_client,
            account_store: Mutex::new(account_store),
            game_child: Mutex::new(None),
            cached_manifest: Mutex::new(None),
            cached_diff: Mutex::new(None),
            cached_version_json: Mutex::new(None),
            cached_fabric_profile: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            start_microsoft_login,
            poll_microsoft_login,
            cancel_microsoft_login,
            login_offline,
            get_accounts,
            get_active_account,
            set_active_account,
            remove_account,
            // Modpack
            check_for_updates,
            execute_update,
            get_local_manifest,
            // Minecraft
            is_minecraft_installed,
            install_minecraft,
            launch_game,
            is_game_running,
            // Java
            is_java_available,
            install_java,
            // Settings
            get_settings,
            save_settings,
            // Window
            minimize_window,
            close_window,
            // Optional components
            check_optional_file,
            download_optional_file,
            delete_optional_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HyLauncher");
}
