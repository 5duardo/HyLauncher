// ============================================================
// HyLauncher — Parallel Downloader with Progress
// ============================================================

use crate::modpack::diff::UpdateDiff;
use crate::utils::{error::Result, http, paths};
use reqwest::Client;
use tauri::Emitter;

/// Execute all downloads from an UpdateDiff
pub async fn execute_diff(
    client: &Client,
    diff: &UpdateDiff,
    manifest: &super::manifest::PackManifest,
    app_handle: &tauri::AppHandle,
) -> Result<()> {
    let mods_dir = paths::mods_dir();
    let instance = paths::instance_dir();
    let rp_dir = paths::resourcepacks_dir();
    let sp_dir = paths::shaderpacks_dir();

    // Ensure directories exist
    std::fs::create_dir_all(&mods_dir)?;
    std::fs::create_dir_all(&instance)?;
    std::fs::create_dir_all(&rp_dir)?;
    std::fs::create_dir_all(&sp_dir)?;

    let total_items = diff.mods_to_download.len()
        + diff.configs_to_update.len()
        + diff.resource_packs_to_update.len()
        + diff.shader_packs_to_update.len();
    let mut completed = 0;

    // ---- Delete orphaned mods ----
    for mod_path in &diff.mods_to_delete {
        log::info!("Deleting orphaned mod: {}", mod_path);
        let _ = std::fs::remove_file(mod_path);
    }

    // ---- Download mods ----
    for (i, mod_entry) in diff.mods_to_download.iter().enumerate() {
        let dest = mods_dir.join(&mod_entry.filename);
        let url = manifest.resolve_url(&mod_entry.url);

        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "downloading_mods",
            "current": i,
            "total": diff.mods_to_download.len(),
            "detail": mod_entry.filename.clone()
        }));

        let expected_sha1 = if mod_entry.sha1 == "REPLACE_WITH_ACTUAL_SHA1" {
            None
        } else {
            Some(mod_entry.sha1.as_str())
        };

        http::download_file_with_retry(
            client,
            &url,
            &dest,
            expected_sha1,
            3,
        )
        .await?;

        completed += 1;
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
            if config.path == "options.txt" {
                let _ = std::fs::write(&dest, "version:3469\nlang:es_es\n");
            } else if config.path == "servers.dat" {
                let _ = std::fs::write(&dest, vec![]);
            } else {
                let _ = std::fs::write(&dest, vec![]);
            }
            Ok(0)
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

    // ---- Download resource packs ----
    for rp in &diff.resource_packs_to_update {
        let dest = rp_dir.join(&rp.filename);

        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "deploying_configs",
            "current": completed,
            "total": total_items,
            "detail": rp.filename.clone()
        }));

        let expected_sha1 = if rp.sha1 == "REPLACE_WITH_ACTUAL_SHA1" {
            None
        } else {
            Some(rp.sha1.as_str())
        };

        let download_result = http::download_file_with_retry(
            client,
            &rp.url,
            &dest,
            expected_sha1,
            3,
        )
        .await;

        if let Err(e) = download_result {
            log::warn!("Failed to download resource pack {}: {}. Continuing anyway.", rp.filename, e);
        }

        completed += 1;
    }

    // ---- Download shader packs ----
    for sp in &diff.shader_packs_to_update {
        let dest = sp_dir.join(&sp.filename);

        let _ = app_handle.emit("progress", serde_json::json!({
            "stage": "deploying_configs",
            "current": completed,
            "total": total_items,
            "detail": sp.filename.clone()
        }));

        let expected_sha1 = if sp.sha1 == "REPLACE_WITH_ACTUAL_SHA1" {
            None
        } else {
            Some(sp.sha1.as_str())
        };

        let download_result = http::download_file_with_retry(
            client,
            &sp.url,
            &dest,
            expected_sha1,
            3,
        )
        .await;

        if let Err(e) = download_result {
            log::warn!("Failed to download shader pack {}: {}. Continuing anyway.", sp.filename, e);
        }

        completed += 1;
    }

    // ---- Update options.txt with active resource packs ----
    update_options_txt_packs(manifest)?;

    let _ = app_handle.emit("progress", serde_json::json!({
        "stage": "verifying",
        "current": total_items,
        "total": total_items,
        "detail": "Actualización completada ✓"
    }));

    Ok(())
}

/// Update the resourcePacks line in options.txt to include enabled packs
fn update_options_txt_packs(manifest: &super::manifest::PackManifest) -> Result<()> {
    let options_path = paths::instance_dir().join("options.txt");
    if !options_path.exists() {
        return Ok(());
    }

    let enabled_rps: Vec<String> = manifest
        .resource_packs
        .iter()
        .filter(|rp| rp.enabled)
        .map(|rp| format!("\"file/{}\"", rp.filename))
        .collect();

    if enabled_rps.is_empty() {
        return Ok(());
    }

    let content = std::fs::read_to_string(&options_path)?;
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    // Build the resourcePacks value: ["vanilla","file/PackName.zip"]
    let packs_value = format!(
        "resourcePacks:[\"vanilla\",{}]",
        enabled_rps.join(",")
    );

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
