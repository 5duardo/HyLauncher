// ============================================================
// HyLauncher — Storage helpers
// ============================================================

use crate::utils::paths;
use serde::Serialize;
use std::fs;
use std::path::Path;
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
    let instance = dir_size(&paths::instance_dir());
    let cache = dir_size(&paths::cache_dir());
    let java = dir_size(&paths::java_dir());
    let data = dir_size(&paths::launcher_data_dir());
    let logs = dir_size(&paths::instance_dir().join("logs"));

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

pub fn clear_logs() -> Result<u64, String> {
    let logs = paths::instance_dir().join("logs");
    let before = dir_size(&logs);
    if logs.exists() {
        fs::remove_dir_all(&logs).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let crash = paths::instance_dir().join("crash-reports");
    if crash.exists() {
        let _ = fs::remove_dir_all(&crash);
        let _ = fs::create_dir_all(&crash);
    }
    Ok(before)
}
