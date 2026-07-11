// ============================================================
// HyLauncher — Remote Manifest Types
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackManifest {
    #[serde(rename = "packVersion")]
    pub pack_version: String,
    #[serde(rename = "packName")]
    pub pack_name: String,
    #[serde(rename = "packDescription")]
    pub pack_description: String,
    pub minecraft: String,
    #[serde(rename = "fabricLoader")]
    pub fabric_loader: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub mods: Vec<ModEntry>,
    pub configs: Vec<ConfigEntry>,
    #[serde(rename = "resourcePacks", default)]
    pub resource_packs: Vec<ResourcePackEntry>,
    #[serde(rename = "shaderPacks", default)]
    pub shader_packs: Vec<ShaderPackEntry>,
    #[serde(rename = "protectedPaths", default)]
    pub protected_paths: Vec<String>,
    pub server: ServerConfig,
    pub java: Option<JavaConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    pub id: String,
    pub filename: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
    pub required: bool,
    pub side: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigEntry {
    pub path: String,
    pub url: String,
    pub sha1: String,
    #[serde(rename = "overwritePolicy")]
    pub overwrite_policy: String, // "always", "once", "never"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcePackEntry {
    pub filename: String,
    pub url: String,
    pub sha1: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShaderPackEntry {
    pub filename: String,
    pub url: String,
    pub sha1: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub name: String,
    pub address: String,
    pub port: u16,
    #[serde(rename = "autoConnect")]
    pub auto_connect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaConfig {
    pub version: u32,
    #[serde(rename = "downloadUrl")]
    pub download_url: Option<String>,
    pub sha1: Option<String>,
}

impl PackManifest {
    /// Resolve a URL that might use {baseUrl} placeholder
    pub fn resolve_url(&self, url: &str) -> String {
        url.replace("{baseUrl}", &self.base_url)
    }
}
