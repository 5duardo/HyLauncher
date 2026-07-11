// ============================================================
// HyLauncher — Game Launcher (Java Command Builder + Process)
// ============================================================

use crate::auth::account_store::StoredAccount;
use crate::utils::{error::Result, paths};
use std::path::PathBuf;
use std::process::Command;

/// Configuration for launching the game
pub struct LaunchConfig {
    pub mc_version: String,
    pub fabric_version: String,
    pub ram_mb: u32,
    pub server_address: Option<String>,
    pub server_port: Option<u16>,
    pub account: StoredAccount,
    pub fabric_main_class: String,
    pub vanilla_classpath: Vec<PathBuf>,
    pub fabric_classpath: Vec<PathBuf>,
    pub java_path: Option<String>,
}

/// Build and launch the Minecraft process
pub fn launch(config: &LaunchConfig) -> Result<std::process::Child> {
    let instance = paths::instance_dir();
    let assets = paths::assets_dir();
    let natives = paths::natives_dir();

    // Build full classpath
    let mut classpath_entries: Vec<String> = Vec::new();

    // Fabric libraries first
    for path in &config.fabric_classpath {
        if path.exists() {
            classpath_entries.push(path.display().to_string());
        }
    }

    // Vanilla libraries + client JAR
    for path in &config.vanilla_classpath {
        if path.exists() {
            classpath_entries.push(path.display().to_string());
        }
    }

    let classpath = classpath_entries.join(";"); // Windows separator

    println!("Launch Classpath Diagnostics:");
    println!("  Total entries resolved: {}", classpath_entries.len());
    for path in &config.fabric_classpath {
        println!("  - Fabric: {} (exists: {})", path.display(), path.exists());
    }
    for path in &config.vanilla_classpath {
        println!("  - Vanilla: {} (exists: {})", path.display(), path.exists());
    }

    // Game arguments
    let mut game_args = vec![
        "--username".to_string(),
        config.account.username.clone(),
        "--version".to_string(),
        format!("fabric-loader-{}-{}", config.fabric_version, config.mc_version),
        "--gameDir".to_string(),
        instance.display().to_string(),
        "--assetsDir".to_string(),
        assets.display().to_string(),
        "--assetIndex".to_string(),
        "5".to_string(), // MC 1.20.1 uses asset index "5"
        "--uuid".to_string(),
        config.account.uuid.replace("-", ""),
        "--accessToken".to_string(),
        config.account.access_token.clone().unwrap_or_else(|| "0".to_string()),
        "--userType".to_string(),
        if config.account.mode == "premium" {
            "msa".to_string()
        } else {
            "legacy".to_string()
        },
        "--versionType".to_string(),
        "release".to_string(),
    ];

    // Auto-connect to server (quickPlayMultiplayer for 1.20+)
    if let Some(ref address) = config.server_address {
        let port = config.server_port.unwrap_or(25565);
        game_args.push("--quickPlayMultiplayer".to_string());
        game_args.push(format!("{}:{}", address, port));
    }

    // Build the command
    let java_executable = match &config.java_path {
        Some(path) => path.clone(),
        None => "javaw".to_string(),
    };
    let mut cmd = Command::new(&java_executable);

    // JVM args (without the -cp one, we handle it separately)
    let jvm_args: Vec<String> = vec![
        format!("-Xmx{}M", config.ram_mb),
        format!("-Xms{}M", std::cmp::min(config.ram_mb, 512)),
        "-XX:+UseG1GC".to_string(),
        "-XX:+ParallelRefProcEnabled".to_string(),
        "-XX:MaxGCPauseMillis=200".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+DisableExplicitGC".to_string(),
        "-XX:G1NewSizePercent=30".to_string(),
        "-XX:G1MaxNewSizePercent=40".to_string(),
        "-XX:G1HeapRegionSize=8M".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:G1HeapWastePercent=5".to_string(),
        "-XX:G1MixedGCCountTarget=4".to_string(),
        "-XX:InitiatingHeapOccupancyPercent=15".to_string(),
        "-XX:G1MixedGCLiveThresholdPercent=90".to_string(),
        "-XX:G1RSetUpdatingPauseTimePercent=5".to_string(),
        "-XX:SurvivorRatio=32".to_string(),
        "-XX:+PerfDisableSharedMem".to_string(),
        "-XX:MaxTenuringThreshold=1".to_string(),
        format!("-Djava.library.path={}", natives.display()),
        "-Dminecraft.launcher.brand=HyLauncher".to_string(),
        "-Dminecraft.launcher.version=1.0.0".to_string(),
    ];

    for arg in &jvm_args {
        cmd.arg(arg);
    }

    cmd.arg("-cp");
    cmd.arg(&classpath);
    cmd.arg(&config.fabric_main_class);

    for arg in &game_args {
        cmd.arg(arg);
    }

    // Set working directory to instance
    cmd.current_dir(&instance);

    println!("Launching Minecraft with command:");
    println!("  Java: {}", java_executable);
    println!("  Main class: {}", config.fabric_main_class);
    println!("  RAM: {} MB", config.ram_mb);
    println!("  User: {} ({})", config.account.username, config.account.mode);
    if let Some(ref addr) = config.server_address {
        println!("  Auto-connect: {}:{}", addr, config.server_port.unwrap_or(25565));
    }

    let child = cmd.spawn().map_err(|e| {
        crate::utils::error::LauncherError::Install(format!("Failed to launch Minecraft: {}", e))
    })?;

    Ok(child)
}

/// Generate servers.dat NBT file for the server list (fallback for pre-1.20)
pub fn generate_servers_dat(server_name: &str, server_address: &str, port: u16) -> Result<()> {
    let servers_path = paths::instance_dir().join("servers.dat");

    // Use fastnbt to create the NBT structure
    // servers.dat format: compound { servers: list of compound { name, ip, icon? } }

    // Simple NBT writer for servers.dat
    // Format: TAG_Compound("") { TAG_List("servers") { TAG_Compound { name, ip } } }
    let mut buf = Vec::new();

    // Root compound tag
    buf.push(0x0A); // TAG_Compound
    write_nbt_string(&mut buf, ""); // Empty name for root

    // "servers" list
    buf.push(0x09); // TAG_List
    write_nbt_string(&mut buf, "servers");
    buf.push(0x0A); // List type: TAG_Compound
    buf.extend_from_slice(&1i32.to_be_bytes()); // List length: 1

    // Server entry compound
    // name
    buf.push(0x08); // TAG_String
    write_nbt_string(&mut buf, "name");
    write_nbt_string(&mut buf, server_name);

    // ip
    buf.push(0x08); // TAG_String
    write_nbt_string(&mut buf, "ip");
    let addr = if port != 25565 {
        format!("{}:{}", server_address, port)
    } else {
        server_address.to_string()
    };
    write_nbt_string(&mut buf, &addr);

    // End of server entry compound
    buf.push(0x00); // TAG_End

    // End of root compound
    buf.push(0x00); // TAG_End

    std::fs::write(&servers_path, &buf)?;
    log::info!("Generated servers.dat with server: {} ({})", server_name, addr);

    Ok(())
}

fn write_nbt_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    buf.extend_from_slice(&(bytes.len() as u16).to_be_bytes());
    buf.extend_from_slice(bytes);
}
