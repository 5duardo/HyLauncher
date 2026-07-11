// ============================================================
// HyLauncher — Path Resolution Utilities
// ============================================================

use std::path::PathBuf;

/// Get the launcher root directory: %APPDATA%/HyLauncher
pub fn launcher_root() -> PathBuf {
    let appdata = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    appdata.join("HyLauncher")
}

/// Internal launcher data directory
pub fn launcher_data_dir() -> PathBuf {
    launcher_root().join("launcher-data")
}

/// Minecraft instance directory (game dir)
pub fn instance_dir() -> PathBuf {
    launcher_root().join("instance")
}

/// Java runtime directory
pub fn java_dir() -> PathBuf {
    launcher_root().join("java")
}

/// Download cache directory
pub fn cache_dir() -> PathBuf {
    launcher_root().join("cache")
}

/// Accounts file path
pub fn accounts_file() -> PathBuf {
    launcher_data_dir().join("accounts.json")
}

/// Settings file path
pub fn settings_file() -> PathBuf {
    launcher_data_dir().join("settings.json")
}

/// Local manifest copy (for diff comparison)
pub fn local_manifest_file() -> PathBuf {
    launcher_data_dir().join("local-manifest.json")
}

/// Mods directory inside the instance
pub fn mods_dir() -> PathBuf {
    instance_dir().join("mods")
}

/// Config directory inside the instance
pub fn config_dir() -> PathBuf {
    instance_dir().join("config")
}

/// Resource packs directory
pub fn resourcepacks_dir() -> PathBuf {
    instance_dir().join("resourcepacks")
}

/// Shader packs directory
pub fn shaderpacks_dir() -> PathBuf {
    instance_dir().join("shaderpacks")
}

/// Versions directory
pub fn versions_dir() -> PathBuf {
    instance_dir().join("versions")
}

/// Libraries directory
pub fn libraries_dir() -> PathBuf {
    instance_dir().join("libraries")
}

/// Assets directory
pub fn assets_dir() -> PathBuf {
    instance_dir().join("assets")
}

/// Natives directory
pub fn natives_dir() -> PathBuf {
    instance_dir().join("natives")
}

/// Java executable path
pub fn java_executable() -> PathBuf {
    java_dir().join("jre-17").join("bin").join("javaw.exe")
}

/// Ensure all required directories exist
pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [
        launcher_data_dir(),
        instance_dir(),
        java_dir(),
        cache_dir(),
        mods_dir(),
        config_dir(),
        resourcepacks_dir(),
        shaderpacks_dir(),
        versions_dir(),
        libraries_dir(),
        assets_dir(),
        natives_dir(),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
