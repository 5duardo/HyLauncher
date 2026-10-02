// ============================================================
// HyLauncher — Modpack Registry (packs index + active pack)
// ============================================================
//
// El launcher no asume un único pack. La lista de
// modpacks disponibles vive en `modpacks.json` (remoto + bundled
// fallback) y el usuario elige cuál usar. Cada pack tiene su
// propia instancia aislada: `instances/<packId>/`.

use crate::utils::paths;
use serde::{Deserialize, Serialize};

/// Entrada del índice de modpacks (`modpacks.json`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackSummary {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub minecraft: String,
    #[serde(rename = "fabricLoader", default)]
    pub fabric_loader: Option<String>,
    #[serde(rename = "iconUrl", default)]
    pub icon_url: Option<String>,
    #[serde(rename = "manifestUrl")]
    pub manifest_url: String,
    #[serde(rename = "packVersion", default)]
    pub pack_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacksIndex {
    pub packs: Vec<ModpackSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActivePackFile {
    #[serde(rename = "packId")]
    pub pack_id: String,
}

/// Lee el pack activo persistido (si el usuario ya eligió uno).
pub fn load_active_pack_id() -> Option<String> {
    let path = paths::active_pack_file();
    let data = std::fs::read_to_string(&path).ok()?;
    let parsed: ActivePackFile = serde_json::from_str(&data).ok()?;
    let id = parsed.pack_id.trim().to_string();
    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

/// Persiste el pack activo elegido por el usuario.
pub fn save_active_pack_id(pack_id: &str) -> std::io::Result<()> {
    let path = paths::active_pack_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(&ActivePackFile {
        pack_id: pack_id.to_string(),
    })
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    std::fs::write(&path, data)
}

/// Busca un pack por id dentro del índice.
pub fn find_pack<'a>(packs: &'a [ModpackSummary], pack_id: &str) -> Option<&'a ModpackSummary> {
    packs.iter().find(|p| p.id == pack_id)
}
