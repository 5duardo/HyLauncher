// ============================================================
// HyLauncher — Tauri Command Registration (lib.rs)
// ============================================================

mod auth;
mod discord;
mod minecraft;
mod modpack;
mod updater;
mod utils;

use auth::{account_store::{AccountStore, StoredAccount, now_secs}, microsoft, offline};
use discord::{resolve_client_id, DiscordRpc};

use minecraft::{fabric, java_manager, launcher, version_manifest};
use modpack::{diff, downloader, manifest::PackManifest, modrinth};
use utils::{error::LauncherError, http, paths};

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

// ---- Application State ----

pub struct AppState {
    pub http_client: reqwest::Client,
    pub account_store: Mutex<AccountStore>,
    pub game_child: Mutex<Option<std::process::Child>>,
    pub game_logs: Arc<Mutex<Vec<String>>>,
    pub cached_manifest: Mutex<Option<PackManifest>>,
    pub cached_diff: Mutex<Option<diff::UpdateDiff>>,
    pub cached_version_json: Mutex<Option<version_manifest::VersionJson>>,
    pub cached_fabric_profile: Mutex<Option<fabric::FabricProfile>>,
    pub discord_rpc: Mutex<DiscordRpc>,
}

// ---- Config Constants ----
const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/5duardo/HyLauncher/main/manifest.json";
const MC_VERSION: &str = "1.20.1";

fn resolve_bundled_manifest_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    // Installed app: resource dir next to the exe (NSIS copies resources here)
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("manifest.json");
        if p.exists() {
            return Some(p);
        }
        let p = dir.join("resources").join("manifest.json");
        if p.exists() {
            return Some(p);
        }
    }

    // Dev / cwd fallbacks
    for candidate in [
        "resources/manifest.json",
        "../resources/manifest.json",
        "manifest.json",
        "../manifest.json",
        "manifest-example.json",
        "../manifest-example.json",
    ] {
        let p = std::path::PathBuf::from(candidate);
        if p.exists() {
            return Some(p);
        }
    }

    let data = paths::launcher_data_dir().join("manifest.json");
    if data.exists() {
        return Some(data);
    }

    None
}

fn read_manifest_file(path: &std::path::Path) -> Result<PackManifest, LauncherError> {
    let data = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&data)?)
}

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
    #[serde(default = "default_true", rename = "discordRpcEnabled")]
    pub discord_rpc_enabled: bool,
    #[serde(default = "default_true", rename = "notificationsUpdates")]
    pub notifications_updates: bool,
    #[serde(default = "default_true", rename = "notificationsDownloads")]
    pub notifications_downloads: bool,
    #[serde(default = "default_true", rename = "notificationsGame")]
    pub notifications_game: bool,
    #[serde(default, rename = "privacyShareUsage")]
    pub privacy_share_usage: bool,
    #[serde(default = "default_true", rename = "privacyCrashReports")]
    pub privacy_crash_reports: bool,
    #[serde(default = "default_true", rename = "checkUpdatesOnStart")]
    pub check_updates_on_start: bool,
}

fn default_true() -> bool {
    true
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            ram_mb: 4096,
            java_path_override: None,
            instance_path: None,
            theme: "dark".to_string(),
            language: "es".to_string(),
            discord_rpc_enabled: true,
            notifications_updates: true,
            notifications_downloads: true,
            notifications_game: true,
            privacy_share_usage: false,
            privacy_crash_reports: true,
            check_updates_on_start: true,
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
            "https://mc-heads.net/avatar/{}/36",
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
    app: AppHandle,
) -> Result<Option<serde_json::Value>, LauncherError> {
    log::info!("Checking for updates from {}", MANIFEST_URL);

    // Prefer remote pack list; fall back to bundled / local manifest (never invent an empty pack).
    let remote: PackManifest = match http::download_json::<PackManifest>(&state.http_client, MANIFEST_URL).await {
        Ok(manifest) if !manifest.mods.is_empty() => manifest,
        Ok(empty) => {
            log::warn!(
                "Remote manifest has {} mods — trying bundled/local fallback",
                empty.mods.len()
            );
            if let Some(path) = resolve_bundled_manifest_path(&app) {
                log::info!("Loading bundled manifest from {}", path.display());
                read_manifest_file(&path)?
            } else if empty.mods.is_empty() {
                return Err(LauncherError::Manifest(
                    "El manifest remoto está vacío y no hay copia local".to_string(),
                ));
            } else {
                empty
            }
        }
        Err(e) => {
            log::warn!("Remote manifest fetch failed: {e} — trying bundled/local fallback");
            if let Some(path) = resolve_bundled_manifest_path(&app) {
                log::info!("Loading bundled manifest from {}", path.display());
                read_manifest_file(&path)?
            } else {
                let local_path = paths::local_manifest_file();
                if local_path.exists() {
                    read_manifest_file(&local_path)?
                } else {
                    return Err(e);
                }
            }
        }
    };

    // Load local manifest
    let local_path = paths::local_manifest_file();
    let local: Option<PackManifest> = if local_path.exists() {
        read_manifest_file(&local_path).ok()
    } else {
        None
    };

    // Compute diff (fast-path skips hashing when only pack metadata changed)
    let update_diff = diff::compute_diff(&remote, local.as_ref()).await;

    if update_diff.is_empty() {
        // Nada que descargar: refrescar local-manifest (incluye updates solo de packVersion)
        let json = serde_json::to_string_pretty(&remote)?;
        if let Some(parent) = local_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&local_path, json)?;

        log::info!(
            "Update check done: kind={:?}, pack v{}",
            update_diff.update_kind,
            remote.pack_version
        );

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
        "updateKind": update_diff.update_kind,
    });

    log::info!(
        "Update check: kind=Content, download {} mods (~{} bytes)",
        update_diff.mods_to_download.len(),
        update_diff.total_download_size
    );

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

/// Delete and re-download all pack mods (force reinstall).
#[tauri::command]
async fn reinstall_mods(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<serde_json::Value, LauncherError> {
    // Prefer cached remote/local pack list
    let mut manifest = state.cached_manifest.lock().unwrap().clone();
    if manifest.is_none() {
        let path = paths::local_manifest_file();
        if path.exists() {
            manifest = Some(read_manifest_file(&path)?);
        }
    }
    // Last resort: bundled / remote
    let manifest = if let Some(m) = manifest {
        m
    } else if let Some(path) = resolve_bundled_manifest_path(&app) {
        read_manifest_file(&path)?
    } else {
        http::download_json::<PackManifest>(&state.http_client, MANIFEST_URL).await?
    };

    if manifest.mods.is_empty() {
        return Err(LauncherError::Manifest(
            "No hay mods en el manifest para reinstalar".to_string(),
        ));
    }

    let update_diff = diff::force_reinstall_mods_diff(&manifest);
    let count = update_diff.mods_to_download.len();
    let total = update_diff.total_download_size;

    log::info!("Force reinstalling {count} mods (~{total} bytes)");

    *state.cached_manifest.lock().unwrap() = Some(manifest.clone());
    *state.cached_diff.lock().unwrap() = Some(update_diff.clone());

    downloader::execute_diff(&state.http_client, &update_diff, &manifest, &app).await?;

    let local_path = paths::local_manifest_file();
    if let Some(parent) = local_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&local_path, json)?;
    *state.cached_diff.lock().unwrap() = None;

    Ok(serde_json::json!({
        "reinstalled": count,
        "totalDownloadSize": total,
    }))
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

#[tauri::command]
async fn get_mod_icons(
    state: State<'_, AppState>,
    mods: Vec<modrinth::ModIconRequest>,
) -> Result<std::collections::HashMap<String, String>, LauncherError> {
    modrinth::fetch_mod_icons(&state.http_client, &mods).await
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

    // Prefer managed/system Java 17–21; never silently use Java 25+
    let java_path = match java_manager::resolve_java_executable(
        settings.java_path_override.as_deref(),
    ) {
        Ok(path) => Some(path),
        Err(_) => {
            // Auto-install Temurin 17, then resolve again
            java_manager::install_java(&state.http_client, &app).await?;
            Some(java_manager::resolve_java_executable(None)?)
        }
    };

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
        java_path,
    };

    let java_used = config.java_path.clone().unwrap_or_else(|| "javaw".into());
    let mut child = launcher::launch(&config)?;

    // Reset console buffer and stream process output to the UI
    {
        let mut logs = state.game_logs.lock().unwrap();
        logs.clear();
        push_game_log_locked(
            &mut logs,
            &app,
            format!("[HyLauncher] Java: {java_used}"),
        );
        push_game_log_locked(
            &mut logs,
            &app,
            format!(
                "[HyLauncher] Iniciando Fabric {} / MC {}",
                manifest.fabric_loader, MC_VERSION
            ),
        );
        push_game_log_locked(
            &mut logs,
            &app,
            format!("[HyLauncher] RAM: {} MB · Usuario: {}", settings.ram_mb, config.account.username),
        );
    }

    attach_game_output_pipes(app.clone(), Arc::clone(&state.game_logs), &mut child);

    *state.game_child.lock().unwrap() = Some(child);

    // Keep launcher visible so the console is usable while diagnosing launch issues
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    let _ = app.emit("state_change", "running");

    Ok(())
}

const GAME_LOG_CAP: usize = 800;

fn push_game_log_locked(logs: &mut Vec<String>, app: &AppHandle, line: String) {
    logs.push(line.clone());
    if logs.len() > GAME_LOG_CAP {
        let overflow = logs.len() - GAME_LOG_CAP;
        logs.drain(0..overflow);
    }
    let _ = app.emit("game_log", serde_json::json!({ "line": line }));
}

fn attach_game_output_pipes(app: AppHandle, logs: Arc<Mutex<Vec<String>>>, child: &mut std::process::Child) {
    use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let pump = |app: AppHandle, logs: Arc<Mutex<Vec<String>>>, reader: Box<dyn Read + Send>| {
        std::thread::spawn(move || {
            let reader = BufReader::new(reader);
            for line in reader.lines().flatten() {
                if let Ok(mut guard) = logs.lock() {
                    push_game_log_locked(&mut guard, &app, line);
                }
            }
        });
    };

    if let Some(out) = stdout {
        pump(app.clone(), logs.clone(), Box::new(out));
    }
    if let Some(err) = stderr {
        pump(app.clone(), logs.clone(), Box::new(err));
    }

    // Tail Fabric's latest.log (most useful for crashes)
    let log_path = paths::instance_dir().join("logs").join("latest.log");
    let app_tail = app;
    let logs_tail = logs;
    std::thread::spawn(move || {
        for _ in 0..60 {
            if log_path.exists() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        if !log_path.exists() {
            if let Ok(mut guard) = logs_tail.lock() {
                push_game_log_locked(
                    &mut guard,
                    &app_tail,
                    "[HyLauncher] No aparece latest.log — el juego puede haber fallado al instante.".into(),
                );
            }
            return;
        }

        let Ok(mut file) = std::fs::File::open(&log_path) else {
            return;
        };
        // New launches rewrite latest.log — read from start, then follow
        let mut pos = 0u64;
        let mut carry = String::new();
        loop {
            if file.seek(SeekFrom::Start(pos)).is_err() {
                break;
            }
            let mut chunk = vec![0u8; 8192];
            match file.read(&mut chunk) {
                Ok(0) => {
                    std::thread::sleep(std::time::Duration::from_millis(350));
                    // Handle log rotation / truncate
                    if let Ok(meta) = std::fs::metadata(&log_path) {
                        if meta.len() < pos {
                            pos = 0;
                            carry.clear();
                            if let Ok(f) = std::fs::File::open(&log_path) {
                                file = f;
                            }
                        }
                    }
                }
                Ok(n) => {
                    pos += n as u64;
                    carry.push_str(&String::from_utf8_lossy(&chunk[..n]));
                    while let Some(idx) = carry.find('\n') {
                        let mut line = carry[..idx].to_string();
                        if line.ends_with('\r') {
                            line.pop();
                        }
                        carry.drain(..=idx);
                        if !line.is_empty() {
                            if let Ok(mut guard) = logs_tail.lock() {
                                push_game_log_locked(&mut guard, &app_tail, line);
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
    });
}

#[tauri::command]
fn get_game_console_logs(state: State<'_, AppState>) -> Vec<String> {
    state.game_logs.lock().unwrap().clone()
}

#[tauri::command]
fn is_game_running(state: State<'_, AppState>) -> bool {
    let mut child_guard = state.game_child.lock().unwrap();
    if let Some(ref mut child) = *child_guard {
        match child.try_wait() {
            Ok(Some(status)) => {
                *child_guard = None;
                // Note: frontend listens via poll; also emit a log line if possible is hard without AppHandle
                let _ = status;
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
fn save_settings(
    state: State<'_, AppState>,
    settings: LauncherSettings,
) -> Result<(), LauncherError> {
    let path = paths::settings_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(&settings)?;
    std::fs::write(&path, json)?;

    if !settings.discord_rpc_enabled {
        if let Ok(mut rpc) = state.discord_rpc.lock() {
            rpc.clear();
        }
    }

    Ok(())
}

#[tauri::command]
fn update_discord_presence(
    state: State<'_, AppState>,
    details: String,
    presence_state: String,
) -> Result<(), String> {
    let settings = load_settings();
    let client_id = resolve_client_id();

    let mut rpc = state.discord_rpc.lock().map_err(|e| e.to_string())?;
    rpc.update(
        settings.discord_rpc_enabled,
        &client_id,
        &details,
        &presence_state,
    )
}

#[tauri::command]
fn clear_discord_presence(state: State<'_, AppState>) -> Result<(), String> {
    let mut rpc = state.discord_rpc.lock().map_err(|e| e.to_string())?;
    rpc.clear();
    Ok(())
}

#[tauri::command]
fn get_discord_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let rpc = state.discord_rpc.lock().map_err(|e| e.to_string())?;
    let settings = load_settings();
    Ok(serde_json::json!({
        "connected": rpc.connected,
        "enabled": settings.discord_rpc_enabled,
        "lastError": rpc.last_error,
        "clientId": resolve_client_id(),
    }))
}

// ============================================================
// Tauri Commands — Storage / Updater
// ============================================================

#[tauri::command]
fn get_storage_info() -> utils::storage::StorageInfo {
    utils::storage::collect_storage_info()
}

#[tauri::command]
fn clear_launcher_cache() -> Result<u64, String> {
    utils::storage::clear_cache()
}

#[tauri::command]
fn clear_launcher_logs() -> Result<u64, String> {
    utils::storage::clear_logs()
}

#[tauri::command]
fn open_storage_folder(which: String) -> Result<(), String> {
    let path = match which.as_str() {
        "instance" => paths::instance_dir(),
        "cache" => paths::cache_dir(),
        "java" => paths::java_dir(),
        "data" => paths::launcher_data_dir(),
        _ => paths::launcher_root(),
    };
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    open_path(&path)
}

fn open_path(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn get_app_version() -> String {
    updater::current_version()
}

#[tauri::command]
async fn check_for_launcher_update(
    state: State<'_, AppState>,
) -> Result<updater::UpdateCheckResult, LauncherError> {
    updater::check_for_update(&state.http_client).await
}

#[tauri::command]
async fn install_launcher_update(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, LauncherError> {
    let check = updater::check_for_update(&state.http_client).await?;
    if !check.update_available {
        return Err(LauncherError::Other(
            "No hay una actualización disponible".to_string(),
        ));
    }
    let url = check.download_url.ok_or_else(|| {
        LauncherError::Other(
            "La release no incluye un instalador para Windows (.exe / .msi)".to_string(),
        )
    })?;
    let filename = check
        .download_filename
        .unwrap_or_else(|| "HyLauncher-Setup.exe".to_string());

    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "downloading_update",
            "label": "Descargando actualización del launcher...",
            "percent": 40.0,
        }),
    );

    let path = updater::download_update_installer(&state.http_client, &url, &filename).await?;

    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "installing_update",
            "label": "Abriendo instalador...",
            "percent": 95.0,
        }),
    );

    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| LauncherError::Other(format!("No se pudo abrir el instalador: {e}")))?;

    // Leave the installer running and quit so files can be replaced.
    let app_exit = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(900)).await;
        app_exit.exit(0);
    });

    Ok(path)
}

// ============================================================
// Tauri Commands — Window
// ============================================================

#[tauri::command]
fn stop_game(state: State<'_, AppState>, app: AppHandle) -> Result<(), LauncherError> {
    let mut child_guard = state.game_child.lock().unwrap();
    if let Some(ref mut child) = *child_guard {
        let _ = child.kill();
        let _ = child.wait();
    }
    *child_guard = None;
    let _ = app.emit("state_change", "ready");
    Ok(())
}

#[tauri::command]
async fn restore_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
async fn toggle_maximize_window(app: AppHandle) -> Result<bool, LauncherError> {
    if let Some(window) = app.get_webview_window("main") {
        let maximized = window.is_maximized().unwrap_or(false);
        if maximized {
            let _ = window.unmaximize();
            Ok(false)
        } else {
            let _ = window.maximize();
            Ok(true)
        }
    } else {
        Err(LauncherError::Install("Window not found".to_string()))
    }
}

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

#[tauri::command]
async fn set_window_splash(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    let _ = window.set_shadow(false);
    let _ = window.set_resizable(false);
    let _ = window.set_minimizable(true);
    let _ = window.set_maximizable(false);
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
        360.0, 360.0,
    ))));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(420.0, 420.0)));
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
async fn set_window_main(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    let _ = window.set_shadow(false);
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
        1024.0, 680.0,
    ))));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(1360.0, 800.0)));
    let _ = window.set_resizable(true);
    let _ = window.set_maximizable(true);
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
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
    // Load .env from project root (dev) — Rust needs this; Vite alone is not enough
    let _ = dotenvy::dotenv();
    let _ = dotenvy::from_filename("../.env");
    if let Ok(mut dir) = std::env::current_dir() {
        let _ = dotenvy::from_path(dir.join(".env"));
        dir.pop();
        let _ = dotenvy::from_path(dir.join(".env"));
    }
    if let Ok(mut exe) = std::env::current_exe() {
        exe.pop();
        let _ = dotenvy::from_path(exe.join(".env"));
        exe.pop();
        let _ = dotenvy::from_path(exe.join(".env"));
    }

    log::info!("Discord RPC client id configured: {}", resolve_client_id());

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
            game_logs: Arc::new(Mutex::new(Vec::new())),
            cached_manifest: Mutex::new(None),
            cached_diff: Mutex::new(None),
            cached_version_json: Mutex::new(None),
            cached_fabric_profile: Mutex::new(None),
            discord_rpc: Mutex::new(DiscordRpc::new()),
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
            }
            // Publicar estado en Discord al abrir el launcher (con reintentos)
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let client_id = resolve_client_id();
                eprintln!("[Discord RPC] Client ID: {client_id}");
                for attempt in 0..12u32 {
                    std::thread::sleep(std::time::Duration::from_millis(
                        600 + u64::from(attempt) * 350,
                    ));
                    let settings = load_settings();
                    if !settings.discord_rpc_enabled {
                        eprintln!("[Discord RPC] Desactivado en ajustes");
                        return;
                    }
                    let Some(state) = handle.try_state::<AppState>() else {
                        continue;
                    };
                    let Ok(mut rpc) = state.discord_rpc.lock() else {
                        continue;
                    };
                    match rpc.update(
                        true,
                        &client_id,
                        "Usando HyLauncher",
                        "En el menú",
                    ) {
                        Ok(()) => {
                            eprintln!("[Discord RPC] Presence activo");
                            return;
                        }
                        Err(err) => {
                            eprintln!(
                                "[Discord RPC] intento {}: {err}",
                                attempt + 1
                            );
                        }
                    }
                }
                eprintln!("[Discord RPC] No se pudo activar tras varios intentos");
            });
            Ok(())
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
            reinstall_mods,
            get_local_manifest,
            get_mod_icons,
            // Minecraft
            is_minecraft_installed,
            install_minecraft,
            launch_game,
            is_game_running,
            get_game_console_logs,
            stop_game,
            // Java
            is_java_available,
            install_java,
            // Settings
            get_settings,
            save_settings,
            update_discord_presence,
            clear_discord_presence,
            get_discord_status,
            get_storage_info,
            clear_launcher_cache,
            clear_launcher_logs,
            open_storage_folder,
            get_app_version,
            check_for_launcher_update,
            install_launcher_update,
            // Window
            minimize_window,
            toggle_maximize_window,
            restore_window,
            close_window,
            set_window_splash,
            set_window_main,
            // Optional components
            check_optional_file,
            download_optional_file,
            delete_optional_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HyLauncher");
}
