// ============================================================
// HyLauncher — Storage helpers
// ============================================================

use crate::utils::paths;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub launcher_root: String,
    pub instance_bytes: u64,
    pub cache_bytes: u64,
    pub java_bytes: u64,
    pub data_bytes: u64,
    pub logs_bytes: u64,
    pub total_bytes: u64,
}

fn dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

pub fn collect_storage_info() -> StorageInfo {
    // Todas las instancias de modpacks (`instances/<packId>/`).
    let instance = dir_size(&paths::instances_root());
    let cache = dir_size(&paths::cache_dir());
    let java = dir_size(&paths::java_dir());
    let data = dir_size(&paths::launcher_data_dir());
    let mut logs = 0u64;
    for inst in instance_targets() {
        logs += dir_size(&inst.join("logs"));
    }

    StorageInfo {
        launcher_root: paths::launcher_root().display().to_string(),
        instance_bytes: instance,
        cache_bytes: cache,
        java_bytes: java,
        data_bytes: data,
        logs_bytes: logs,
        total_bytes: instance + cache + java + data,
    }
}

pub fn clear_cache() -> Result<u64, String> {
    let cache = paths::cache_dir();
    let before = dir_size(&cache);
    if cache.exists() {
        fs::remove_dir_all(&cache).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    Ok(before)
}

/// Todas las carpetas de instancia: `instances/<packId>/`.
fn instance_targets() -> Vec<PathBuf> {
    let mut targets = Vec::new();
    if let Ok(entries) = fs::read_dir(paths::instances_root()) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                targets.push(entry.path());
            }
        }
    }
    targets
}

pub fn clear_logs() -> Result<u64, String> {
    let mut before = 0u64;
    // Limpia logs/crash-reports de todas las instancias de modpacks.
    for inst in instance_targets() {
        for sub in ["logs", "crash-reports"] {
            let dir = inst.join(sub);
            before += dir_size(&dir);
            if dir.exists() {
                let _ = fs::remove_dir_all(&dir);
                let _ = fs::create_dir_all(&dir);
            }
        }
    }
    Ok(before)
}
