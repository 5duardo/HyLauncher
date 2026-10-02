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

/// Local manifest copy (for diff comparison) — per modpack.
pub fn local_manifest_file_for(pack_id: &str) -> PathBuf {
    launcher_data_dir().join(format!("local-manifest-{}.json", sanitize_pack_id(pack_id)))
}

/// Persisted active-modpack selection (`{ packId }`).
pub fn active_pack_file() -> PathBuf {
    launcher_data_dir().join("active-pack.json")
}

/// Root folder holding one isolated instance per modpack.
pub fn instances_root() -> PathBuf {
    launcher_root().join("instances")
}

/// Keep pack ids safe for use as folder/file names.
pub fn sanitize_pack_id(pack_id: &str) -> String {
    let clean: String = pack_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let clean = clean.trim_matches('_').to_string();
    if clean.is_empty() {
        "pack".to_string()
    } else {
        clean
    }
}

/// Per-modpack scoped directories (mods, configs, versions, ...).
/// Cada pack vive aislado en `instances/<packId>/`.
#[derive(Debug, Clone)]
pub struct PackPaths {
    pub pack_id: String,
    pub instance: PathBuf,
}

impl PackPaths {
    pub fn new(pack_id: &str) -> Self {
        let safe = sanitize_pack_id(pack_id);
        Self {
            pack_id: safe.clone(),
            instance: instances_root().join(safe),
        }
    }

    pub fn instance_dir(&self) -> &PathBuf {
        &self.instance
    }

    pub fn mods_dir(&self) -> PathBuf {
        self.instance.join("mods")
    }

    pub fn config_dir(&self) -> PathBuf {
        self.instance.join("config")
    }

    pub fn resourcepacks_dir(&self) -> PathBuf {
        self.instance.join("resourcepacks")
    }

    pub fn shaderpacks_dir(&self) -> PathBuf {
        self.instance.join("shaderpacks")
    }

    pub fn versions_dir(&self) -> PathBuf {
        self.instance.join("versions")
    }

    pub fn libraries_dir(&self) -> PathBuf {
        self.instance.join("libraries")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.instance.join("assets")
    }

    pub fn natives_dir(&self) -> PathBuf {
        self.instance.join("natives")
    }

    pub fn local_manifest_file(&self) -> PathBuf {
        local_manifest_file_for(&self.pack_id)
    }

    /// Create every folder this pack instance needs.
    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            self.instance.clone(),
            self.mods_dir(),
            self.config_dir(),
            self.resourcepacks_dir(),
            self.shaderpacks_dir(),
            self.versions_dir(),
            self.libraries_dir(),
            self.assets_dir(),
            self.natives_dir(),
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}

/// Ensure all required shared directories exist (per-pack instances
/// are created on demand via [`PackPaths::ensure_dirs`]).
pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [launcher_data_dir(), instances_root(), java_dir(), cache_dir()];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
