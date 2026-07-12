// ============================================================
// HyLauncher — Diff / Incremental Update Logic
// ============================================================

use crate::modpack::manifest::*;
use crate::utils::{http, paths};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum UpdateKind {
    /// Nada que hacer (o solo se refresca metadata del pack)
    None,
    /// Solo cambió el manifest / packVersion — sin descargas
    Manifest,
    /// Hay archivos que bajar o borrar
    Content,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiff {
    pub mods_to_download: Vec<ModEntry>,
    pub mods_to_delete: Vec<String>,
    pub configs_to_update: Vec<ConfigEntry>,
    pub resource_packs_to_update: Vec<ResourcePackEntry>,
    pub shader_packs_to_update: Vec<ShaderPackEntry>,
    pub total_download_size: u64,
    pub is_full_install: bool,
    pub update_kind: UpdateKind,
}

/// Fingerprint of installable content (ignores packVersion / name / description).
fn content_fingerprint(m: &PackManifest) -> String {
    let mut mods: Vec<_> = m
        .mods
        .iter()
        .map(|x| format!("{}|{}|{}|{}", x.id, x.filename, x.sha1, x.size))
        .collect();
    mods.sort();

    let mut configs: Vec<_> = m
        .configs
        .iter()
        .map(|x| format!("{}|{}|{}|{}", x.path, x.url, x.sha1, x.overwrite_policy))
        .collect();
    configs.sort();

    let mut rps: Vec<_> = m
        .resource_packs
        .iter()
        .map(|x| format!("{}|{}|{}", x.filename, x.sha1, x.enabled))
        .collect();
    rps.sort();

    let mut sps: Vec<_> = m
        .shader_packs
        .iter()
        .map(|x| format!("{}|{}|{}", x.filename, x.sha1, x.enabled))
        .collect();
    sps.sort();

    let mut opts: Vec<_> = m
        .optional_resource_packs
        .iter()
        .chain(m.optional_shader_packs.iter())
        .map(|x| format!("{}|{}|{}|{}", x.id, x.filename, x.sha1, x.size))
        .collect();
    opts.sort();

    format!(
        "mc={}|loader={}|mods={}|cfg={}|rp={}|sp={}|opt={}",
        m.minecraft,
        m.fabric_loader,
        mods.join(";"),
        configs.join(";"),
        rps.join(";"),
        sps.join(";"),
        opts.join(";")
    )
}

fn empty_diff(is_full_install: bool, kind: UpdateKind) -> UpdateDiff {
    UpdateDiff {
        mods_to_download: Vec::new(),
        mods_to_delete: Vec::new(),
        configs_to_update: Vec::new(),
        resource_packs_to_update: Vec::new(),
        shader_packs_to_update: Vec::new(),
        total_download_size: 0,
        is_full_install,
        update_kind: kind,
    }
}

/// Compare remote manifest against local state and produce a diff.
///
/// Fast path: if local content fingerprint matches remote, skip hashing every jar —
/// only refresh local-manifest when pack metadata (e.g. packVersion) changed.
pub async fn compute_diff(remote: &PackManifest, local: Option<&PackManifest>) -> UpdateDiff {
    let mods_dir = paths::mods_dir();
    let instance = paths::instance_dir();
    let is_full_install = local.is_none();

    // ---- Fast path: solo metadata del pack ----
    if let Some(local_m) = local {
        if content_fingerprint(local_m) == content_fingerprint(remote) {
            let kind = if local_m.pack_version != remote.pack_version
                || local_m.pack_name != remote.pack_name
                || local_m.pack_description != remote.pack_description
                || local_m.base_url != remote.base_url
            {
                log::info!(
                    "Pack content unchanged ({} mods) — manifest-only update {} → {}",
                    remote.mods.len(),
                    local_m.pack_version,
                    remote.pack_version
                );
                UpdateKind::Manifest
            } else {
                log::info!("Pack fully up to date (v{})", remote.pack_version);
                UpdateKind::None
            };
            return empty_diff(false, kind);
        }
    }

    let local_mods: HashMap<&str, &ModEntry> = local
        .map(|m| m.mods.iter().map(|e| (e.id.as_str(), e)).collect())
        .unwrap_or_default();

    let mut mods_to_download = Vec::new();
    let mut mods_to_delete = Vec::new();
    let mut configs_to_update = Vec::new();
    let mut resource_packs_to_update = Vec::new();
    let mut shader_packs_to_update = Vec::new();
    let mut total_download_size: u64 = 0;

    // ---- Mods (solo hashear si cambió o falta el archivo) ----
    for remote_mod in &remote.mods {
        if remote_mod.side == "server" {
            continue;
        }

        let mod_path = mods_dir.join(&remote_mod.filename);
        let unchanged_in_manifest = local_mods
            .get(remote_mod.id.as_str())
            .map(|prev| prev.filename == remote_mod.filename && prev.sha1 == remote_mod.sha1)
            .unwrap_or(false);

        let needs_download = if unchanged_in_manifest && mod_path.exists() {
            // Confiar en el local-manifest previo: no re-hashear todo el pack
            false
        } else if mod_path.exists() {
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

    // Orphan jars: only when remote filename set differs from disk expectations
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        let remote_filenames: HashSet<&str> =
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

        if should_update_config(&config_path, config).await {
            configs_to_update.push(ConfigEntry {
                url: resolved_url,
                ..config.clone()
            });
        }
    }

    // ---- Resource Packs ----
    let rp_dir = paths::resourcepacks_dir();
    let local_rps: HashMap<&str, &ResourcePackEntry> = local
        .map(|m| {
            m.resource_packs
                .iter()
                .map(|e| (e.filename.as_str(), e))
                .collect()
        })
        .unwrap_or_default();

    for rp in &remote.resource_packs {
        let rp_path = rp_dir.join(&rp.filename);
        let unchanged = local_rps
            .get(rp.filename.as_str())
            .map(|prev| prev.sha1 == rp.sha1)
            .unwrap_or(false);

        let needs_download = if unchanged && rp_path.exists() {
            false
        } else if rp_path.exists() {
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
    let local_sps: HashMap<&str, &ShaderPackEntry> = local
        .map(|m| {
            m.shader_packs
                .iter()
                .map(|e| (e.filename.as_str(), e))
                .collect()
        })
        .unwrap_or_default();

    for sp in &remote.shader_packs {
        let sp_path = sp_dir.join(&sp.filename);
        let unchanged = local_sps
            .get(sp.filename.as_str())
            .map(|prev| prev.sha1 == sp.sha1)
            .unwrap_or(false);

        let needs_download = if unchanged && sp_path.exists() {
            false
        } else if sp_path.exists() {
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

    let mut diff = UpdateDiff {
        mods_to_download,
        mods_to_delete,
        configs_to_update,
        resource_packs_to_update,
        shader_packs_to_update,
        total_download_size,
        is_full_install,
        update_kind: UpdateKind::Content,
    };

    if diff.is_empty() {
        diff.update_kind = if local.is_some() {
            UpdateKind::Manifest
        } else {
            UpdateKind::None
        };
    }

    diff
}

impl UpdateDiff {
    pub fn is_empty(&self) -> bool {
        self.mods_to_download.is_empty()
            && self.mods_to_delete.is_empty()
            && self.configs_to_update.is_empty()
            && self.resource_packs_to_update.is_empty()
            && self.shader_packs_to_update.is_empty()
    }

    pub fn is_manifest_only(&self) -> bool {
        self.is_empty() && self.update_kind == UpdateKind::Manifest
    }
}

/// Force re-download of every client/both-side mod from the manifest.
pub fn force_reinstall_mods_diff(manifest: &PackManifest) -> UpdateDiff {
    let mut mods_to_download = Vec::new();
    let mut total_download_size: u64 = 0;
    let mut mods_to_delete = Vec::new();

    let mods_dir = paths::mods_dir();
    for remote_mod in &manifest.mods {
        if remote_mod.side == "server" {
            continue;
        }
        let path = mods_dir.join(&remote_mod.filename);
        if path.exists() {
            mods_to_delete.push(path.display().to_string());
        }
        total_download_size += remote_mod.size;
        mods_to_download.push(remote_mod.clone());
    }

    UpdateDiff {
        mods_to_download,
        mods_to_delete,
        configs_to_update: Vec::new(),
        resource_packs_to_update: Vec::new(),
        shader_packs_to_update: Vec::new(),
        total_download_size,
        is_full_install: true,
        update_kind: UpdateKind::Content,
    }
}
