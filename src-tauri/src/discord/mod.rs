// ============================================================
// HyLauncher — Discord Rich Presence
// ============================================================

use discord_rich_presence::{
    activity::{Activity, ActivityType, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Application ID de HyLauncher (Discord Developer Portal).
pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1525679139309355159";

pub fn resolve_client_id() -> String {
    std::env::var("DISCORD_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_DISCORD_CLIENT_ID.to_string())
}

pub struct DiscordRpc {
    client: Option<DiscordIpcClient>,
    client_id: String,
    start_secs: i64,
    pub last_error: Option<String>,
    pub connected: bool,
}

impl DiscordRpc {
    pub fn new() -> Self {
        Self {
            client: None,
            client_id: String::new(),
            start_secs: now_secs(),
            last_error: None,
            connected: false,
        }
    }

    pub fn update(
        &mut self,
        enabled: bool,
        client_id: &str,
        details: &str,
        state: &str,
    ) -> Result<(), String> {
        let client_id = client_id.trim();
        if !enabled {
            self.clear();
            self.last_error = None;
            return Ok(());
        }
        if client_id.is_empty() {
            let msg = "Discord Client ID vacío".to_string();
            self.last_error = Some(msg.clone());
            return Err(msg);
        }

        if self.client.is_none() || self.client_id != client_id {
            self.connect_with_retry(client_id, 6)?;
        }

        match self.set_activity(details, state) {
            Ok(()) => {
                self.connected = true;
                self.last_error = None;
                eprintln!("[Discord RPC] OK — {details} / {state}");
                Ok(())
            }
            Err(err) => {
                eprintln!("[Discord RPC] set_activity falló, reconectando: {err}");
                self.connect_with_retry(client_id, 4)?;
                self.set_activity(details, state).map(|()| {
                    self.connected = true;
                    self.last_error = None;
                    eprintln!("[Discord RPC] OK tras reconectar — {details} / {state}");
                }).map_err(|e| {
                    self.connected = false;
                    self.last_error = Some(e.clone());
                    e
                })
            }
        }
    }

    pub fn clear(&mut self) {
        if let Some(mut client) = self.client.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
        self.client_id.clear();
        self.connected = false;
    }

    fn set_activity(&mut self, details: &str, state: &str) -> Result<(), String> {
        let Some(client) = self.client.as_mut() else {
            return Err("Discord RPC no conectado".to_string());
        };

        client
            .set_activity(
                Activity::new()
                    .details(details)
                    .state(state)
                    .activity_type(ActivityType::Playing)
                    .timestamps(Timestamps::new().start(self.start_secs)),
            )
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    fn connect_with_retry(&mut self, client_id: &str, attempts: u32) -> Result<(), String> {
        let mut last_err = String::from("Discord no disponible");
        for i in 0..attempts {
            if i > 0 {
                thread::sleep(Duration::from_millis(400 * u64::from(i)));
            }
            match self.connect_once(client_id) {
                Ok(()) => {
                    eprintln!("[Discord RPC] Conectado (intento {})", i + 1);
                    return Ok(());
                }
                Err(e) => {
                    last_err = e;
                    eprintln!("[Discord RPC] Conexión fallida {}: {last_err}", i + 1);
                }
            }
        }
        self.connected = false;
        self.last_error = Some(last_err.clone());
        Err(last_err)
    }

    fn connect_once(&mut self, client_id: &str) -> Result<(), String> {
        self.clear();
        let mut client = DiscordIpcClient::new(client_id);
        client.connect().map_err(|e| {
            format!("¿Discord de escritorio abierto? ({e})")
        })?;
        thread::sleep(Duration::from_millis(250));
        self.client = Some(client);
        self.client_id = client_id.to_string();
        self.start_secs = now_secs();
        self.connected = true;
        Ok(())
    }
}

impl Default for DiscordRpc {
    fn default() -> Self {
        Self::new()
    }
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
