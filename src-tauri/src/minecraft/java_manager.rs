// ============================================================
// HyLauncher — Java Runtime Manager (Temurin 17 for MC 1.20.1)
// ============================================================

use crate::utils::{
    error::{LauncherError, Result},
    paths,
};
use reqwest::Client;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use zip::ZipArchive;

const ADOPTIUM_JRE17_URL: &str =
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse";

/// True when a compatible Java 17–21 runtime can be resolved.
pub fn is_java_available() -> bool {
    resolve_java_executable(None).is_ok()
}

/// Prefer override → managed Temurin → system Java 17–21.
pub fn resolve_java_executable(override_path: Option<&str>) -> Result<String> {
    if let Some(path) = override_path.map(str::trim).filter(|s| !s.is_empty()) {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
        return Err(LauncherError::Install(format!(
            "Java override no existe: {path}"
        )));
    }

    if let Some(managed) = find_managed_javaw() {
        if java_major_version(&managed).is_some_and(is_compatible_major) {
            return Ok(managed.display().to_string());
        }
    }

    for candidate in discover_java_candidates() {
        if java_major_version(&candidate).is_some_and(is_compatible_major) {
            return Ok(candidate.display().to_string());
        }
    }

    Err(LauncherError::Install(
        "No se encontró Java 17. HyLauncher lo descargará automáticamente.".to_string(),
    ))
}

/// Download Eclipse Temurin 17 JRE into %APPDATA%/HyLauncher/java
pub async fn install_java(client: &Client, app: &AppHandle) -> Result<()> {
    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "downloading_java",
            "label": "Descargando Java 17 (Temurin)...",
            "percent": 5.0,
        }),
    );

    let java_root = paths::java_dir();
    std::fs::create_dir_all(&java_root)?;
    let zip_path = paths::cache_dir().join("temurin-17-jre.zip");
    if let Some(parent) = zip_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Follow Adoptium redirect to the actual package
    let response = client
        .get(ADOPTIUM_JRE17_URL)
        .header("User-Agent", "HyLauncher")
        .send()
        .await?
        .error_for_status()?;

    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "downloading_java",
            "label": "Descargando Java 17...",
            "percent": 35.0,
        }),
    );

    let bytes = response.bytes().await?;
    std::fs::write(&zip_path, &bytes)?;

    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "downloading_java",
            "label": "Extrayendo Java 17...",
            "percent": 70.0,
        }),
    );

    // Clean previous managed runtime (keep folder)
    if java_root.exists() {
        for entry in std::fs::read_dir(&java_root)?.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let _ = std::fs::remove_dir_all(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }

    extract_zip(&zip_path, &java_root)?;

    let javaw = find_managed_javaw().ok_or_else(|| {
        LauncherError::Install(
            "Java 17 se descargó pero no se encontró javaw.exe".to_string(),
        )
    })?;

    let major = java_major_version(&javaw).unwrap_or(0);
    if !is_compatible_major(major) {
        return Err(LauncherError::Install(format!(
            "Java instalado reporta versión {major}, se necesita 17–21"
        )));
    }

    let _ = app.emit(
        "progress",
        serde_json::json!({
            "stage": "downloading_java",
            "label": format!("Java {major} listo"),
            "percent": 100.0,
        }),
    );

    log::info!("Managed Java ready: {}", javaw.display());
    let _ = std::fs::remove_file(&zip_path);
    Ok(())
}

fn is_compatible_major(major: u32) -> bool {
    (17..=21).contains(&major)
}

fn find_managed_javaw() -> Option<PathBuf> {
    let root = paths::java_dir();
    if !root.exists() {
        return None;
    }
    WalkDir::new(&root)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.path().to_path_buf())
        .find(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.eq_ignore_ascii_case("javaw.exe"))
        })
}

fn discover_java_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let program_files_x86 =
        std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();

    let roots = [
        PathBuf::from(&program_files).join("Eclipse Adoptium"),
        PathBuf::from(&program_files).join("Java"),
        PathBuf::from(&program_files).join("Microsoft"),
        PathBuf::from(&program_files).join("Zulu"),
        PathBuf::from(&program_files).join("Amazon Corretto"),
        PathBuf::from(&program_files).join("BellSoft"),
        PathBuf::from(&program_files_x86).join("Eclipse Adoptium"),
        PathBuf::from(&local).join(r"Programs\Eclipse Adoptium"),
    ];

    for root in roots {
        if !root.exists() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                // Prefer folders that look like 17.x
                let looks_17 = name.contains("17") || name.contains("jdk-17") || name.contains("jre-17");
                let javaw = entry.path().join("bin").join("javaw.exe");
                if javaw.exists() {
                    if looks_17 {
                        out.insert(0, javaw);
                    } else {
                        out.push(javaw);
                    }
                }
            }
        }
    }

    out
}

fn java_major_version(javaw: &Path) -> Option<u32> {
    // Prefer java.exe next to javaw for clearer -version output
    let java = javaw
        .parent()
        .map(|p| p.join("java.exe"))
        .filter(|p| p.exists())
        .unwrap_or_else(|| javaw.to_path_buf());

    let output = Command::new(&java)
        .arg("-version")
        .output()
        .ok()?;

    // java -version prints to stderr
    let text = {
        let err = String::from_utf8_lossy(&output.stderr);
        if err.trim().is_empty() {
            String::from_utf8_lossy(&output.stdout).into_owned()
        } else {
            err.into_owned()
        }
    };

    parse_java_major(&text)
}

fn parse_java_major(version_text: &str) -> Option<u32> {
    // Examples:
    // java version "17.0.13" 2024-10-15 LTS
    // openjdk version "21.0.5" 2024-10-15
    // java version "1.8.0_481"
    for line in version_text.lines() {
        if let Some(start) = line.find('"') {
            let rest = &line[start + 1..];
            if let Some(end) = rest.find('"') {
                let ver = &rest[..end];
                if ver.starts_with("1.") {
                    // 1.8.0_xxx → 8
                    let minor = ver.split('.').nth(1)?.parse().ok()?;
                    return Some(minor);
                }
                let major = ver.split(|c| c == '.' || c == '+' || c == '-').next()?;
                return major.parse().ok();
            }
        }
    }
    None
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<()> {
    let file = File::open(zip_path)?;
    let mut archive = ZipArchive::new(BufReader::new(file))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry
            .enclosed_name()
            .ok_or_else(|| LauncherError::Install("ZIP entry inválida".to_string()))?
            .to_path_buf();
        let out_path = dest.join(name);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut outfile = File::create(&out_path)?;
            std::io::copy(&mut entry, &mut outfile)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modern_and_legacy() {
        assert_eq!(
            parse_java_major(r#"java version "17.0.13" 2024-10-15 LTS"#),
            Some(17)
        );
        assert_eq!(
            parse_java_major(r#"openjdk version "21.0.5" 2024-10-15"#),
            Some(21)
        );
        assert_eq!(
            parse_java_major(r#"java version "1.8.0_481""#),
            Some(8)
        );
        assert_eq!(
            parse_java_major(r#"java version "25.0.2" 2026-01-20 LTS"#),
            Some(25)
        );
    }
}
