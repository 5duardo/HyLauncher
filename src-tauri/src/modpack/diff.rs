// ============================================================
// HyLauncher — Diff / Incremental Update Logic
// ============================================================

use crate::modpack::manifest::*;
use crate::utils::{http, paths};
use serde::{Deserialize, Serialize};
use std::path::Path;

fn is_placeholder_sha1(sha1: &str) -> bool {
    sha1.is_empty() || sha1 == "REPLACE_WITH_ACTUAL_SHA1"
}

async fn should_update_config(config_path: &Path, config: &ConfigEntry) -> bool {
    match config.overwrite_policy.as_str() {
        "never" | "preserve" => false,
        "once" => !config_path.exists(),
        "always" => {
            if !config_path.exists() {
                return true;
            }
            // Sin SHA1 real del servidor: no pisar ajustes locales del jugador
            if is_placeholder_sha1(&config.sha1) {
                return false;
            }
            match http::compute_file_sha1(config_path).await {
                Ok(hash) => hash != config.sha1,
                Err(_) => false,
            }
        }
        _ => !config_path.exists(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDiff {
    pub mods_to_download: Vec<ModEntry>,
    pub mods_to_delete: Vec<String>,
    pub configs_to_update: Vec<ConfigEntry>,
    pub resource_packs_to_update: Vec<ResourcePackEntry>,
    pub shader_packs_to_update: Vec<ShaderPackEntry>,
    pub total_download_size: u64,
    pub is_full_install: bool,
}

/// Compare remote manifest against local state and produce a diff
pub async fn compute_diff(
    remote: &PackManifest,
    local: Option<&PackManifest>,
) -> UpdateDiff {
    let mods_dir = paths::mods_dir();
    let instance = paths::instance_dir();

    let is_full_install = local.is_none();
    let mut mods_to_download = Vec::new();
    let mut mods_to_delete = Vec::new();
    let mut configs_to_update = Vec::new();
    let mut resource_packs_to_update = Vec::new();
    let mut shader_packs_to_update = Vec::new();
    let mut total_download_size: u64 = 0;

    // ---- Mods ----
    for remote_mod in &remote.mods {
        // Only download client-side and both-side mods
        if remote_mod.side == "server" {
            continue;
        }

        let mod_path = mods_dir.join(&remote_mod.filename);
        let needs_download = if mod_path.exists() {
            // Check SHA1
            match http::compute_file_sha1(&mod_path).await {
                Ok(hash) => hash != remote_mod.sha1,
                Err(_) => true,
            }
        } else {
            true
        };

        if needs_download {
            total_download_size += remote_mod.size;
            mods_to_download.push(remote_mod.clone());
        }
    }

    // Find orphaned mods (exist locally but not in remote manifest)
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        let remote_filenames: std::collections::HashSet<&str> =
            remote.mods.iter().map(|m| m.filename.as_str()).collect();

        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.ends_with(".jar") && !remote_filenames.contains(name_str.as_ref()) {
                mods_to_delete.push(entry.path().display().to_string());
            }
        }
    }

    // ---- Configs ----
    for config in &remote.configs {
        let config_path = instance.join(&config.path);
        let resolved_url = remote.resolve_url(&config.url);

        let should_update = should_update_config(&config_path, config).await;

        if should_update {
            configs_to_update.push(ConfigEntry {
                url: resolved_url,
                ..config.clone()
            });
        }
    }

    // ---- Resource Packs ----
    let rp_dir = paths::resourcepacks_dir();
    for rp in &remote.resource_packs {
        let rp_path = rp_dir.join(&rp.filename);
        let needs_download = if rp_path.exists() {
            match http::compute_file_sha1(&rp_path).await {
                Ok(hash) => hash != rp.sha1,
                Err(_) => true,
            }
        } else {
            true
        };

        if needs_download {
            resource_packs_to_update.push(ResourcePackEntry {
                url: remote.resolve_url(&rp.url),
                ..rp.clone()
            });
        }
    }

    // ---- Shader Packs ----
    let sp_dir = paths::shaderpacks_dir();
    for sp in &remote.shader_packs {
        let sp_path = sp_dir.join(&sp.filename);
        let needs_download = if sp_path.exists() {
            match http::compute_file_sha1(&sp_path).await {
                Ok(hash) => hash != sp.sha1,
                Err(_) => true,
            }
        } else {
            true
        };

        if needs_download {
            shader_packs_to_update.push(ShaderPackEntry {
                url: remote.resolve_url(&sp.url),
                ..sp.clone()
            });
        }
    }

    UpdateDiff {
        mods_to_download,
        mods_to_delete,
        configs_to_update,
        resource_packs_to_update,
        shader_packs_to_update,
        total_download_size,
        is_full_install,
    }
}

/// Check if a diff is empty (nothing to do)
impl UpdateDiff {
    pub fn is_empty(&self) -> bool {
        self.mods_to_download.is_empty()
            && self.mods_to_delete.is_empty()
            && self.configs_to_update.is_empty()
            && self.resource_packs_to_update.is_empty()
            && self.shader_packs_to_update.is_empty()
    }
}
