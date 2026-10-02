// ============================================================
// HyLauncher — Parallel Downloader with Progress
// ============================================================

use crate::modpack::diff::UpdateDiff;
use crate::minecraft::launcher;
use crate::utils::{error::Result, http, paths};
use futures::stream::{self, StreamExt};
use reqwest::Client;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tauri::Emitter;

/// Descargas simultáneas (los 140+ archivos del pack no van de uno en uno).
const PARALLEL_DOWNLOADS: usize = 8;

/// Un archivo a descargar.
struct FileJob {
    url: String,
    dest: std::path::PathBuf,
    sha1: Option<String>,
    label: String,
}

fn sha1_opt(raw: &str) -> Option<String> {
    if raw == "REPLACE_WITH_ACTUAL_SHA1" || raw.is_empty() {
        None
    } else {
        Some(raw.to_string())
    }
}

/// Descarga en paralelo con progreso. No aborta: devuelve los fallos para que
/// el llamador decida (mods = error fatal, packs = aviso y se sigue).
async fn download_many(
    client: &Client,
    jobs: Vec<FileJob>,
    app_handle: &tauri::AppHandle,
    stage: &str,
    base: usize,
    total: usize,
) -> Vec<(String, crate::utils::error::LauncherError)> {
    let done = Arc::new(AtomicUsize::new(0));
    let failures = Arc::new(std::sync::Mutex::new(Vec::new()));
    let client = client.clone();

    stream::iter(jobs)
        .for_each_concurrent(PARALLEL_DOWNLOADS, |job| {
            let client = client.clone();
            let handle = app_handle.clone();
            let done = Arc::clone(&done);
            let failures = Arc::clone(&failures);
            let stage = stage.to_string();
            async move {
                let res = http::download_file_with_retry(
                    &client,
                    &job.url,
                    &job.dest,
                    job.sha1.as_deref(),
                    5,
                )
                .await;
                let n = base + done.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = handle.emit(
                    "progress",
                    serde_json::json!({
                        "stage": stage,
                        "current": n,
                        "total": total,
                        "detail": job.label.clone()
                    }),
                );
                if let Err(e) = res {
                    failures.lock().unwrap().push((job.label, e));
                }
            }
        })
        .await;

    Arc::try_unwrap(failures)
        .map(|m| m.into_inner().unwrap())
        .unwrap_or_default()
}

/// Execute all downloads from an UpdateDiff
pub async fn execute_diff(
    client: &Client,
    diff: &UpdateDiff,
    manifest: &super::manifest::PackManifest,
    app_handle: &tauri::AppHandle,
    pack: &paths::PackPaths,
) -> Result<()> {
    let mods_dir = pack.mods_dir();
    let instance = pack.instance_dir().clone();
    let rp_dir = pack.resourcepacks_dir();
    let sp_dir = pack.shaderpacks_dir();

    // Ensure directories exist
    std::fs::create_dir_all(&mods_dir)?;
    std::fs::create_dir_all(&instance)?;
    std::fs::create_dir_all(&rp_dir)?;
    std::fs::create_dir_all(&sp_dir)?;

    let total_items = diff.mods_to_download.len()
        + diff.configs_to_update.len()
        + diff.resource_packs_to_update.len()
        + diff.shader_packs_to_update.len();
    let mut completed = diff.mods_to_download.len();

    // ---- Delete orphaned mods ----
    for mod_path in &diff.mods_to_delete {
        log::info!("Deleting orphaned mod: {}", mod_path);
        let _ = std::fs::remove_file(mod_path);
    }

    // ---- Download mods (en paralelo; los 429 de Modrinth se absorben con retry) ----
    let mod_jobs: Vec<FileJob> = diff
        .mods_to_download
        .iter()
        .map(|m| FileJob {
            url: manifest.resolve_url(&m.url),
            dest: mods_dir.join(&m.filename),
            sha1: sha1_opt(&m.sha1),
            label: m.filename.clone(),
        })
        .collect();
    let mod_failures = download_many(
        client,
        mod_jobs,
        app_handle,
        "downloading_mods",
        0,
        diff.mods_to_download.len(),
    )
    .await;
    if let Some((label, e)) = mod_failures.into_iter().next() {
        log::error!("Failed to download mod {label}: {e}");
        return Err(e);
    }

    // ---- Deploy configs ----
    for config in &diff.configs_to_update {
        let dest = instance.join(&config.path);

        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "deploying_configs",
            "current": completed,
            "total": total_items,
            "detail": config.path.clone()
        }));

        let url = config.url.replace("{baseUrl}", &manifest.base_url);

        let download_result = if url.contains("YOUR_USER") {
            if dest.exists() {
                log::info!("Keeping existing config (user settings): {}", config.path);
                Ok(0)
            } else if config.path == "options.txt" {
                let _ = std::fs::write(&dest, "version:3465\nlang:es_es\n");
                Ok(0)
            } else if config.path == "servers.dat" {
                let _ = launcher::generate_servers_dat(
                    &instance,
                    &manifest.server.name,
                    &manifest.server.address,
                    manifest.server.port,
                );
                Ok(0)
            } else {
                let _ = std::fs::write(&dest, vec![]);
                Ok(0)
            }
        } else {
            let expected_sha1 = if config.sha1 == "REPLACE_WITH_ACTUAL_SHA1" {
                None
            } else {
                Some(config.sha1.as_str())
            };
            http::download_file_with_retry(
                client,
                &url,
                &dest,
                expected_sha1,
                3,
            )
            .await
        };

        if let Err(e) = download_result {
            log::warn!("Failed to download config {}: {}. Continuing anyway.", config.path, e);
            if !dest.exists() {
                let _ = std::fs::write(&dest, vec![]);
            }
        }

        completed += 1;
    }

    // ---- Download resource packs (en paralelo; fallos = aviso, se sigue) ----
    // completed ya trae mods + configs a este punto.
    let rp_base = completed;
    let rp_jobs: Vec<FileJob> = diff
        .resource_packs_to_update
        .iter()
        .map(|rp| FileJob {
            url: rp.url.clone(),
            dest: rp_dir.join(&rp.filename),
            sha1: sha1_opt(&rp.sha1),
            label: rp.filename.clone(),
        })
        .collect();
    for (label, e) in download_many(
        client,
        rp_jobs,
        app_handle,
        "deploying_configs",
        rp_base,
        total_items,
    )
    .await
    {
        log::warn!("Failed to download resource pack {label}: {e}. Continuing anyway.");
    }
    completed += diff.resource_packs_to_update.len();

    // ---- Download shader packs (en paralelo; fallos = aviso, se sigue) ----
    let sp_jobs: Vec<FileJob> = diff
        .shader_packs_to_update
        .iter()
        .map(|sp| FileJob {
            url: sp.url.clone(),
            dest: sp_dir.join(&sp.filename),
            sha1: sha1_opt(&sp.sha1),
            label: sp.filename.clone(),
        })
        .collect();
    for (label, e) in download_many(
        client,
        sp_jobs,
        app_handle,
        "deploying_configs",
        completed,
        total_items,
    )
    .await
    {
        log::warn!("Failed to download shader pack {label}: {e}. Continuing anyway.");
    }

    // ---- Update options.txt resource packs only when packs changed ----
    if !diff.resource_packs_to_update.is_empty() {
        update_options_txt_packs(manifest, pack)?;
    }

    let _ = app_handle.emit("progress", serde_json::json!({
        "stage": "verifying",
        "current": total_items,
        "total": total_items,
        "detail": "Actualización completada ✓"
    }));

    Ok(())
}

/// Update the resourcePacks line in options.txt to include enabled packs.
/// Se llama en cada lanzamiento para que al entrar al juego apliquen TODAS
/// las texturas del pack automáticamente, aunque el jugador las haya quitado.
pub fn update_options_txt_packs(
    manifest: &super::manifest::PackManifest,
    pack: &paths::PackPaths,
) -> Result<()> {
    let options_path = pack.instance_dir().join("options.txt");

    let enabled_rps: Vec<String> = manifest
        .resource_packs
        .iter()
        .filter(|rp| rp.enabled)
        .map(|rp| format!("\"file/{}\"", rp.filename))
        .collect();

    if enabled_rps.is_empty() {
        return Ok(());
    }

    // Build the resourcePacks value: ["vanilla","file/PackName.zip"]
    let packs_value = format!(
        "resourcePacks:[\"vanilla\",{}]",
        enabled_rps.join(",")
    );

    // En instalación fresca aún no existe: crearlo ya con los packs del
    // manifest para que queden activos desde el primer arranque del juego.
    if !options_path.exists() {
        if let Some(parent) = options_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&options_path, format!("version:3465\nlang:es_es\n{packs_value}\n"))?;
        return Ok(());
    }

    let content = std::fs::read_to_string(&options_path)?;
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    // Find and replace or append the resourcePacks line
    let mut found = false;
    for line in &mut lines {
        if line.starts_with("resourcePacks:") {
            *line = packs_value.clone();
            found = true;
            break;
        }
    }

    if !found {
        lines.push(packs_value);
    }

    std::fs::write(&options_path, lines.join("\n"))?;
    Ok(())
}
