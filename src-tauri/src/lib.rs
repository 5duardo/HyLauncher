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
use modpack::{diff, downloader, manifest::PackManifest, modrinth, packs};
use utils::{error::LauncherError, http, paths};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

// ---- Application State ----

pub struct AppState {
    pub http_client: reqwest::Client,
    pub account_store: Mutex<AccountStore>,
    pub game_child: Mutex<Option<std::process::Child>>,
    pub game_logs: Arc<Mutex<Vec<String>>>,
    /// Índice de modpacks disponibles (se carga una vez por sesión).
    pub cached_packs: Mutex<Option<Vec<packs::ModpackSummary>>>,
    /// Manifests y diffs por pack id (cada pack tiene su instancia aislada).
    pub cached_manifests: Mutex<HashMap<String, PackManifest>>,
    pub cached_diffs: Mutex<HashMap<String, diff::UpdateDiff>>,
    pub discord_rpc: Mutex<DiscordRpc>,
}

// ---- Config Constants ----
/// Índice de modpacks disponibles (id, nombre, manifestUrl, ...).
const PACKS_URL: &str =
    "https://raw.githubusercontent.com/5duardo/HyLauncher/main/modpacks.json";

/// Resuelve qué pack usar: el `pack_id` explícito o el activo persistido.
/// Si el usuario aún no eligió ninguno → error (nada por default).
fn resolve_pack_id(pack_id: Option<String>) -> Result<String, LauncherError> {
    if let Some(id) = pack_id {
        let id = id.trim().to_string();
        if !id.is_empty() {
            return Ok(id);
        }
    }
    packs::load_active_pack_id().ok_or_else(|| {
        LauncherError::Manifest(
            "No hay ningún modpack seleccionado. Elige uno en la pestaña Modpacks.".to_string(),
        )
    })
}

fn pack_paths(pack_id: &str) -> paths::PackPaths {
    let p = paths::PackPaths::new(pack_id);
    let _ = p.ensure_dirs();
    p
}

/// Carga el índice de modpacks (caché de sesión → remoto → bundled).
async fn load_packs_index(
    state: &State<'_, AppState>,
    app: &AppHandle,
) -> Result<Vec<packs::ModpackSummary>, LauncherError> {
    if let Some(cached) = state.cached_packs.lock().unwrap().clone() {
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    let index = fetch_packs_index(&state.http_client, app).await;
    *state.cached_packs.lock().unwrap() = Some(index.clone());
    Ok(index)
}

async fn fetch_packs_index(
    client: &reqwest::Client,
    app: &AppHandle,
) -> Vec<packs::ModpackSummary> {
    // 1. Remoto
    if let Ok(index) = http::download_json::<packs::PacksIndex>(client, PACKS_URL).await {
        if !index.packs.is_empty() {
            return index.packs;
        }
        log::warn!("Remote modpacks.json is empty — trying bundled fallback");
    } else {
        log::warn!("Remote modpacks.json fetch failed — trying bundled fallback");
    }
    // 2. Bundled modpacks.json
    if let Some(path) = resolve_bundled_packs_path(app) {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(index) = serde_json::from_str::<packs::PacksIndex>(&data) {
                if !index.packs.is_empty() {
                    log::info!("Loaded modpacks index from {}", path.display());
                    return index.packs;
                }
            }
        }
    }
    // 3. Sin índice por ningún lado: lista vacía (la UI pide elegir pack).
    log::warn!("No modpacks index available (remote + bundled failed)");
    Vec::new()
}

fn resolve_bundled_packs_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("modpacks.json");
        if p.exists() {
            return Some(p);
        }
        let p = dir.join("resources").join("modpacks.json");
        if p.exists() {
            return Some(p);
        }
    }
    for candidate in [
        "resources/modpacks.json",
        "../resources/modpacks.json",
        "modpacks.json",
        "../modpacks.json",
    ] {
        let p = std::path::PathBuf::from(candidate);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Bundled manifest de un pack: `manifest-<id>.json` (p. ej.
/// `manifest-keo-vanilla.json`). Sirve como fallback cuando el remoto
/// aún no está publicado (404) o no hay conexión.
fn resolve_bundled_manifest_path(
    app: &AppHandle,
    pack_id: &str,
) -> Option<std::path::PathBuf> {
    let filename = format!(
        "manifest-{}.json",
        paths::sanitize_pack_id(pack_id)
    );
    // Installed app: resource dir next to the exe (NSIS copies resources here)
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join(&filename);
        if p.exists() {
            return Some(p);
        }
        let p = dir.join("resources").join(&filename);
        if p.exists() {
            return Some(p);
        }
    }

    // Dev / cwd fallbacks
    let candidates = [
        format!("resources/{filename}"),
        format!("../resources/{filename}"),
        filename.clone(),
        format!("../{filename}"),
        "manifest-example.json".to_string(),
        "../manifest-example.json".to_string(),
    ];
    for candidate in &candidates {
        let p = std::path::PathBuf::from(candidate);
        if p.exists() {
            return Some(p);
        }
    }

    let data = paths::launcher_data_dir().join(&filename);
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

/// Verifica (y si hace falta renueva) la sesión premium de una cuenta.
/// Las offline no necesitan verificación. Persiste los tokens renovados.
async fn verify_account_session(
    state: &State<'_, AppState>,
    account: &StoredAccount,
) -> Result<StoredAccount, LauncherError> {
    if account.mode != "premium" {
        return Ok(account.clone());
    }
    let Some(access) = account.access_token.clone() else {
        return Err(LauncherError::Auth(
            "La cuenta premium no tiene sesión guardada. Vuelve a iniciar sesión con Microsoft.".to_string(),
        ));
    };
    let verified =
        microsoft::verify_premium_session(&state.http_client, &access, account.refresh_token.clone())
            .await?;
    let mut updated = account.clone();
    updated.username = verified.username;
    updated.uuid = verified.uuid;
    updated.access_token = Some(verified.access_token);
    if verified.refresh_token.is_some() {
        updated.refresh_token = verified.refresh_token;
    }
    updated.last_used = now_secs();
    let mut store = state.account_store.lock().unwrap();
    store.upsert(updated.clone());
    store.save()?;
    Ok(updated)
}

/// Re-verificación manual de sesión premium (botón en Ajustes + gate al jugar).
#[tauri::command]
async fn verify_premium_session(
    state: State<'_, AppState>,
    account_id: Option<String>,
) -> Result<serde_json::Value, LauncherError> {
    let account = {
        let store = state.account_store.lock().unwrap();
        match account_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            Some(id) => store
                .accounts
                .iter()
                .find(|a| a.id == id)
                .cloned()
                .ok_or_else(|| LauncherError::Auth("Cuenta no encontrada".to_string()))?,
            None => store
                .active()
                .cloned()
                .ok_or_else(|| LauncherError::Auth("No active account".to_string()))?,
        }
    };
    if account.mode != "premium" {
        return Ok(serde_json::json!({
            "valid": true,
            "mode": "offline",
            "username": account.username,
            "uuid": account.uuid,
            "refreshed": false,
        }));
    }
    let before = account.access_token.clone().unwrap_or_default();
    let updated = verify_account_session(&state, &account).await?;
    Ok(serde_json::json!({
        "valid": true,
        "mode": "premium",
        "username": updated.username,
        "uuid": updated.uuid,
        "refreshed": updated.access_token.as_deref().unwrap_or("") != before,
    }))
}

#[tauri::command]
fn remove_account(state: State<'_, AppState>, account_id: String) -> Result<(), LauncherError> {
    let mut store = state.account_store.lock().unwrap();
    store.remove(&account_id);
    store.save()?;
    Ok(())
}

// ============================================================
// Tauri Commands — Modpacks (registry + per-pack manifests)
// ============================================================

/// Lista de modpacks disponibles (índice remoto + fallbacks).
#[tauri::command]
async fn get_modpacks(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<packs::ModpackSummary>, LauncherError> {
    load_packs_index(&state, &app).await
}

/// El modpack elegido por el usuario (None si aún no eligió ninguno).
#[tauri::command]
async fn get_active_pack(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Option<packs::ModpackSummary>, LauncherError> {
    let index = load_packs_index(&state, &app).await?;
    let Some(id) = packs::load_active_pack_id() else {
        return Ok(None);
    };
    Ok(packs::find_pack(&index, &id).cloned())
}

/// El usuario elige un modpack: se persiste y se prepara su instancia.
#[tauri::command]
async fn set_active_pack(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: String,
) -> Result<packs::ModpackSummary, LauncherError> {
    let index = load_packs_index(&state, &app).await?;
    let id = pack_id.trim();
    let pack = packs::find_pack(&index, id)
        .cloned()
        .ok_or_else(|| {
            LauncherError::Manifest(format!("Modpack desconocido: {id}"))
        })?;
    packs::save_active_pack_id(&pack.id)
        .map_err(|e| LauncherError::Manifest(format!("No se pudo guardar la selección: {e}")))?;
    // Prepara la instancia aislada del pack.
    let _ = pack_paths(&pack.id);
    log::info!("Active modpack set to {}", pack.id);
    Ok(pack)
}

/// Descarga el manifest remoto de un pack (con fallbacks bundled/local).
async fn fetch_remote_manifest(
    client: &reqwest::Client,
    app: &AppHandle,
    pack: &packs::ModpackSummary,
    local_path: &std::path::Path,
) -> Result<PackManifest, LauncherError> {
    log::info!(
        "Checking for updates for pack {} from {}",
        pack.id, pack.manifest_url
    );
    match http::download_json::<PackManifest>(client, &pack.manifest_url).await {
        Ok(manifest) if !manifest.mods.is_empty() => Ok(manifest),
        Ok(empty) => {
            log::warn!(
                "Remote manifest for {} has {} mods — trying bundled/local fallback",
                pack.id,
                empty.mods.len()
            );
            if let Some(path) = resolve_bundled_manifest_path(app, &pack.id) {
                log::info!("Loading bundled manifest from {}", path.display());
                return read_manifest_file(&path);
            }
            if local_path.exists() {
                read_manifest_file(local_path)
            } else if empty.mods.is_empty() {
                Err(LauncherError::Manifest(
                    "El manifest remoto está vacío y no hay copia local".to_string(),
                ))
            } else {
                Ok(empty)
            }
        }
        Err(e) => {
            log::warn!("Remote manifest fetch failed for {}: {e} — trying fallback", pack.id);
            if let Some(path) = resolve_bundled_manifest_path(app, &pack.id) {
                log::info!("Loading bundled manifest from {}", path.display());
                return read_manifest_file(&path);
            }
            if local_path.exists() {
                read_manifest_file(local_path)
            } else {
                Err(LauncherError::Manifest(format!(
                    "No se pudo descargar el manifest de {} y no hay copia local. Si acabas de agregarlo, súbelo a GitHub o incluye resources/manifest-{}.json en el build. Detalle: {e}",
                    pack.id, pack.id
                )))
            }
        }
    }
}

/// Devuelve el manifest de un pack usando caché → local → remoto/bundled.
/// Evita el "No manifest loaded" en la primera instalación: `fullSetup`
/// llama a `install_minecraft` antes del primer `check_for_updates`, cuando
/// la caché aún está vacía (normal en un pack recién elegido como HYNILLA).
async fn ensure_manifest_cached(
    state: &State<'_, AppState>,
    app: &AppHandle,
    pack_id: &str,
) -> Result<PackManifest, LauncherError> {
    if let Some(m) = state.cached_manifests.lock().unwrap().get(pack_id).cloned() {
        return Ok(m);
    }
    let dirs = pack_paths(pack_id);
    let local_path = dirs.local_manifest_file();
    if local_path.exists() {
        if let Ok(m) = read_manifest_file(&local_path) {
            state.cached_manifests.lock().unwrap().insert(pack_id.to_string(), m.clone());
            return Ok(m);
        }
    }
    let index = load_packs_index(state, app).await?;
    let pack = packs::find_pack(&index, pack_id).cloned().ok_or_else(|| {
        LauncherError::Manifest(format!("Modpack desconocido: {pack_id}"))
    })?;
    let manifest = fetch_remote_manifest(&state.http_client, app, &pack, &local_path).await?;
    state.cached_manifests.lock().unwrap().insert(pack_id.to_string(), manifest.clone());
    Ok(manifest)
}

#[tauri::command]
async fn check_for_updates(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: Option<String>,
) -> Result<Option<serde_json::Value>, LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let index = load_packs_index(&state, &app).await?;
    let pack = packs::find_pack(&index, &id).cloned().ok_or_else(|| {
        LauncherError::Manifest(format!("Modpack desconocido: {id}"))
    })?;
    let dirs = pack_paths(&id);
    let local_path = dirs.local_manifest_file();

    // Prefer remote pack list; fall back to bundled / local manifest (never invent an empty pack).
    let remote: PackManifest =
        fetch_remote_manifest(&state.http_client, &app, &pack, &local_path).await?;

    // Load local manifest
    let local: Option<PackManifest> = if local_path.exists() {
        read_manifest_file(&local_path).ok()
    } else {
        None
    };

    // Compute diff (fast-path skips hashing when only pack metadata changed)
    let update_diff = diff::compute_diff(&remote, local.as_ref(), &dirs).await;

    if update_diff.is_empty() {
        // Nada que descargar: refrescar local-manifest (incluye updates solo de packVersion)
        let json = serde_json::to_string_pretty(&remote)?;
        if let Some(parent) = local_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&local_path, json)?;

        log::info!(
            "Update check done: kind={:?}, pack {} v{}",
            update_diff.update_kind,
            id,
            remote.pack_version
        );

        state.cached_manifests.lock().unwrap().insert(id.clone(), remote);
        state.cached_diffs.lock().unwrap().remove(&id);
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

    state.cached_manifests.lock().unwrap().insert(id.clone(), remote);
    state.cached_diffs.lock().unwrap().insert(id, update_diff);

    Ok(Some(result))
}

#[tauri::command]
async fn execute_update(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let dirs = pack_paths(&id);
    let manifest = state
        .cached_manifests
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| LauncherError::Manifest("No manifest cached".to_string()))?;

    let update_diff = state
        .cached_diffs
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| LauncherError::Manifest("No diff cached".to_string()))?;

    // Execute downloads
    downloader::execute_diff(&state.http_client, &update_diff, &manifest, &app, &dirs).await?;

    // Save manifest as local
    let local_path = dirs.local_manifest_file();
    let json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&local_path, json)?;

    state.cached_diffs.lock().unwrap().remove(&id);

    Ok(())
}

/// Delete and re-download all pack mods (force reinstall).
#[tauri::command]
async fn reinstall_mods(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: Option<String>,
) -> Result<serde_json::Value, LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let index = load_packs_index(&state, &app).await?;
    let pack = packs::find_pack(&index, &id).cloned().ok_or_else(|| {
        LauncherError::Manifest(format!("Modpack desconocido: {id}"))
    })?;
    let dirs = pack_paths(&id);
    // Prefer cached remote/local pack list
    let mut manifest = state.cached_manifests.lock().unwrap().get(&id).cloned();
    if manifest.is_none() {
        let path = dirs.local_manifest_file();
        if path.exists() {
            manifest = Some(read_manifest_file(&path)?);
        }
    }
    // Last resort: bundled / remote
    let manifest = if let Some(m) = manifest {
        m
    } else {
        fetch_remote_manifest(&state.http_client, &app, &pack, &dirs.local_manifest_file()).await?
    };

    if manifest.mods.is_empty() {
        return Err(LauncherError::Manifest(
            "No hay mods en el manifest para reinstalar".to_string(),
        ));
    }

    let update_diff = diff::force_reinstall_mods_diff(&manifest, &dirs);
    let count = update_diff.mods_to_download.len();
    let total = update_diff.total_download_size;

    log::info!("Force reinstalling {count} mods (~{total} bytes) for pack {id}");

    state.cached_manifests.lock().unwrap().insert(id.clone(), manifest.clone());
    state.cached_diffs.lock().unwrap().insert(id.clone(), update_diff.clone());

    downloader::execute_diff(&state.http_client, &update_diff, &manifest, &app, &dirs).await?;

    let local_path = dirs.local_manifest_file();
    if let Some(parent) = local_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&local_path, json)?;
    state.cached_diffs.lock().unwrap().remove(&id);

    Ok(serde_json::json!({
        "reinstalled": count,
        "totalDownloadSize": total,
    }))
}

#[tauri::command]
fn get_local_manifest(
    state: State<'_, AppState>,
    pack_id: Option<String>,
) -> Result<Option<serde_json::Value>, LauncherError> {
    // Sin pack elegido no hay manifest que mostrar (nada por default).
    let Some(id) = pack_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(packs::load_active_pack_id)
    else {
        return Ok(None);
    };
    // Try cache first
    if let Some(manifest) = state.cached_manifests.lock().unwrap().get(&id) {
        return Ok(Some(serde_json::to_value(manifest).unwrap()));
    }

    // Try disk
    let path = pack_paths(&id).local_manifest_file();
    if path.exists() {
        let data = std::fs::read_to_string(&path)?;
        let manifest: PackManifest = serde_json::from_str(&data)?;
        let value = serde_json::to_value(&manifest).unwrap();
        state.cached_manifests.lock().unwrap().insert(id, manifest);
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
fn is_minecraft_installed(state: State<'_, AppState>, pack_id: Option<String>) -> bool {
    let Ok(id) = resolve_pack_id(pack_id) else {
        return false;
    };
    let dirs = pack_paths(&id);
    let mc_version = state
        .cached_manifests
        .lock()
        .unwrap()
        .get(&id)
        .map(|m| m.minecraft.clone())
        .or_else(|| {
            read_manifest_file(&dirs.local_manifest_file())
                .ok()
                .map(|m| m.minecraft)
        });
    let Some(mc_version) = mc_version else {
        return false;
    };
    let vanilla_ok = version_manifest::is_installed(&mc_version, &dirs);
    if !vanilla_ok {
        return false;
    }

    let manifest = state.cached_manifests.lock().unwrap();
    match manifest.get(&id) {
        Some(m) => {
            let fabric_dir = dirs
                .versions_dir()
                .join(format!("fabric-loader-{}-{}", m.fabric_loader, m.minecraft));
            fabric_dir.exists()
        }
        None => {
            if let Ok(entries) = std::fs::read_dir(dirs.versions_dir()) {
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
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let dirs = pack_paths(&id);
    let manifest = ensure_manifest_cached(&state, &app, &id).await?;
    let mc_version = manifest.minecraft.clone();

    // Install vanilla Minecraft (dentro de la instancia del pack)
    let _version_json =
        version_manifest::install(&state.http_client, &mc_version, &app, &dirs).await?;

    // Get Fabric loader version from cached manifest or use latest
    let loader_version = if manifest.fabric_loader.is_empty() {
        fabric::get_latest_loader_version(&state.http_client, &mc_version).await?
    } else {
        manifest.fabric_loader.clone()
    };

    // Install Fabric
    let _fabric_profile =
        fabric::install(&state.http_client, &mc_version, &loader_version, &app, &dirs).await?;

    // Generate servers.dat
    let _ = launcher::generate_servers_dat(
        dirs.instance_dir(),
        &manifest.server.name,
        &manifest.server.address,
        manifest.server.port,
    );

    Ok(())
}

#[tauri::command]
async fn launch_game(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let dirs = pack_paths(&id);
    // Get account (las premium se verifican + renuevan antes de lanzar).
    let account = {
        let store = state.account_store.lock().unwrap();
        store
            .active()
            .cloned()
            .ok_or_else(|| LauncherError::Auth("No active account".to_string()))?
    };
    let account = verify_account_session(&state, &account).await?;

    // Get manifest (caché → local → remoto/bundled, nunca "No manifest loaded")
    let manifest = ensure_manifest_cached(&state, &app, &id).await?;

    // Aplica todas las texturas del pack al entrar al juego (no bloquea el launch si falla).
    let _ = downloader::update_options_txt_packs(&manifest, &dirs);

    // Get settings
    let settings = load_settings();

    // We need the version JSON and fabric profile
    let version_json = ensure_version_json(&state, &manifest.minecraft).await?;
    let fabric_profile = ensure_fabric_profile(&state, &manifest).await?;

    // Java del major que pida el pack (21 para HYNILLA); never Java 25+
    let major = required_java_major(&state, &id);
    let java_path = match java_manager::resolve_java_for_major(
        major,
        settings.java_path_override.as_deref(),
    ) {
        Ok(path) => Some(path),
        Err(_) => {
            // Auto-install Temurin del major que pida el pack, then resolve again
            java_manager::install_java(&state.http_client, &app, major).await?;
            Some(java_manager::resolve_java_for_major(
                major,
                settings.java_path_override.as_deref(),
            )?)
        }
    };

    let config = launcher::LaunchConfig {
        mc_version: manifest.minecraft.clone(),
        asset_index: version_json.asset_index.id.clone(),
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
        vanilla_classpath: version_manifest::get_vanilla_classpath(&version_json, &dirs),
        fabric_classpath: fabric::get_fabric_classpath(&fabric_profile, &dirs),
        java_path,
        game_dir: dirs.instance_dir().clone(),
        assets_dir: dirs.assets_dir(),
        natives_dir: dirs.natives_dir(),
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
                "[HyLauncher] Iniciando Fabric {} / MC {} (pack {})",
                manifest.fabric_loader, manifest.minecraft, id
            ),
        );
        push_game_log_locked(
            &mut logs,
            &app,
            format!("[HyLauncher] RAM: {} MB · Usuario: {}", settings.ram_mb, config.account.username),
        );
    }

    attach_game_output_pipes(
        app.clone(),
        Arc::clone(&state.game_logs),
        &mut child,
        dirs.instance_dir().join("logs").join("latest.log"),
    );

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

fn attach_game_output_pipes(
    app: AppHandle,
    logs: Arc<Mutex<Vec<String>>>,
    child: &mut std::process::Child,
    log_path: std::path::PathBuf,
) {
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

/// Major de Java que exige un pack (manifest `java.version` o por MC).
fn required_java_major(state: &State<'_, AppState>, pack_id: &str) -> u32 {
    if let Some(m) = state.cached_manifests.lock().unwrap().get(pack_id) {
        if let Some(java) = m.java.as_ref() {
            if java.version >= 17 {
                return java.version;
            }
        }
        return java_manager::required_java_major_for_mc(&m.minecraft);
    }
    if let Ok(manifest) = read_manifest_file(&pack_paths(pack_id).local_manifest_file()) {
        if let Some(java) = manifest.java.as_ref() {
            if java.version >= 17 {
                return java.version;
            }
        }
        return java_manager::required_java_major_for_mc(&manifest.minecraft);
    }
    17
}

#[tauri::command]
async fn install_java(
    state: State<'_, AppState>,
    app: AppHandle,
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let major = match pack_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(packs::load_active_pack_id)
    {
        Some(id) => required_java_major(&state, &id),
        None => 17,
    };
    java_manager::install_java(&state.http_client, &app, major).await
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
fn open_storage_folder(which: String, pack_id: Option<String>) -> Result<(), String> {
    let path = match which.as_str() {
        "instance" => match pack_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).or_else(packs::load_active_pack_id) {
            Some(id) => pack_paths(&id).instance_dir().clone(),
            None => paths::instances_root(),
        },
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
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn check_for_launcher_update(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<updater::UpdateCheckResult, LauncherError> {
    let current = app.package_info().version.to_string();
    updater::check_for_update(&state.http_client, &current).await
}

#[tauri::command]
async fn install_launcher_update(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, LauncherError> {
    let current = app.package_info().version.to_string();
    let check = updater::check_for_update(&state.http_client, &current).await?;
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
    mc_version: &str,
) -> Result<version_manifest::VersionJson, LauncherError> {
    // Reload from Mojang
    let client = &state.http_client;
    let manifest: version_manifest::VersionManifest =
        http::download_json(client, "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json").await?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == mc_version)
        .ok_or_else(|| LauncherError::Install("MC version not found".to_string()))?;
    let version_json: version_manifest::VersionJson =
        http::download_json(client, &entry.url).await?;
    Ok(version_json)
}

async fn ensure_fabric_profile(
    state: &State<'_, AppState>,
    manifest: &PackManifest,
) -> Result<fabric::FabricProfile, LauncherError> {
    let loader_version = if manifest.fabric_loader.is_empty() {
        "0.16.14".to_string()
    } else {
        manifest.fabric_loader.clone()
    };

    let url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        manifest.minecraft, loader_version
    );
    let profile: fabric::FabricProfile =
        http::download_json(&state.http_client, &url).await?;
    Ok(profile)
}

// ============================================================
// Tauri Commands — Shaders and Resource Packs
// ============================================================

fn optional_dir(
    folder_type: &str,
    pack_id: Option<String>,
) -> Result<std::path::PathBuf, LauncherError> {
    let id = resolve_pack_id(pack_id)?;
    let dirs = pack_paths(&id);
    match folder_type {
        "resourcepack" => Ok(dirs.resourcepacks_dir()),
        "shaderpack" => Ok(dirs.shaderpacks_dir()),
        _ => Err(LauncherError::Other("Invalid folder type".to_string())),
    }
}

#[tauri::command]
async fn check_optional_file(
    folder_type: String,
    filename: String,
    pack_id: Option<String>,
) -> Result<bool, LauncherError> {
    let dir = optional_dir(&folder_type, pack_id)?;
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
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let dir = optional_dir(&folder_type, pack_id)?;
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
async fn delete_optional_file(
    folder_type: String,
    filename: String,
    pack_id: Option<String>,
) -> Result<(), LauncherError> {
    let dir = optional_dir(&folder_type, pack_id)?;
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
            cached_packs: Mutex::new(None),
            cached_manifests: Mutex::new(HashMap::new()),
            cached_diffs: Mutex::new(HashMap::new()),
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
            verify_premium_session,
            login_offline,
            get_accounts,
            get_active_account,
            set_active_account,
            remove_account,
            // Modpack
            get_modpacks,
            get_active_pack,
            set_active_pack,
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
