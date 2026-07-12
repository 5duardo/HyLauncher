// ============================================================
// HyLauncher — Modrinth icon lookup
// ============================================================

use crate::utils::{error::Result, http};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct ModrinthProject {
    id: String,
    icon_url: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModIconRequest {
    pub id: String,
    pub url: String,
}

/// Extract Modrinth project ID from a CDN URL like:
/// https://cdn.modrinth.com/data/P7dR8mSH/versions/...
pub fn extract_project_id(url: &str) -> Option<String> {
    const MARKER: &str = "cdn.modrinth.com/data/";
    let start = url.find(MARKER)? + MARKER.len();
    let rest = &url[start..];
    let end = rest.find('/')?;
    Some(rest[..end].to_string())
}

/// Batch-fetch icon URLs from Modrinth for a list of mods.
pub async fn fetch_mod_icons(
    client: &Client,
    mods: &[ModIconRequest],
) -> Result<HashMap<String, String>> {
    let mut project_to_mod: HashMap<String, String> = HashMap::new();

    for m in mods {
        if let Some(project_id) = extract_project_id(&m.url) {
            project_to_mod.insert(project_id, m.id.clone());
        }
    }

    if project_to_mod.is_empty() {
        return Ok(HashMap::new());
    }

    let mut icons: HashMap<String, String> = HashMap::new();
    let project_ids: Vec<String> = project_to_mod.keys().cloned().collect();

    for chunk in project_ids.chunks(50) {
        let ids_json = serde_json::to_string(chunk)?;
        let encoded_ids: String = ids_json
            .chars()
            .map(|c| match c {
                '[' => "%5B".to_string(),
                ']' => "%5D".to_string(),
                '"' => "%22".to_string(),
                c => c.to_string(),
            })
            .collect();
        let url = format!("https://api.modrinth.com/v2/projects?ids={encoded_ids}");

        let projects: Vec<ModrinthProject> = http::download_json(client, &url).await?;

        for project in projects {
            if let Some(icon_url) = project.icon_url {
                if let Some(mod_id) = project_to_mod.get(&project.id) {
                    icons.insert(mod_id.clone(), icon_url);
                }
            }
        }
    }

    Ok(icons)
}
