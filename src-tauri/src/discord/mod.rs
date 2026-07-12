// ============================================================
// HyLauncher — Discord Rich Presence
// ============================================================

use discord_rich_presence::{
    activity::{Activity, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct DiscordRpc {
    client: Option<DiscordIpcClient>,
    client_id: String,
    start_secs: i64,
}

impl DiscordRpc {
    pub fn new() -> Self {
        Self {
            client: None,
            client_id: String::new(),
            start_secs: now_secs(),
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
        if !enabled || client_id.is_empty() {
            self.clear();
            return Ok(());
        }

        if self.client.is_none() || self.client_id != client_id {
            self.connect(client_id)?;
        }

        let Some(client) = self.client.as_mut() else {
            return Ok(());
        };

        let activity = Activity::new()
            .details(details)
            .state(state)
            .timestamps(Timestamps::new().start(self.start_secs));

        if let Err(err) = client.set_activity(activity) {
            // Discord may have restarted — reconnect once
            log::warn!("Discord RPC set_activity failed, reconnecting: {err}");
            self.connect(client_id)?;
            if let Some(client) = self.client.as_mut() {
                client
                    .set_activity(
                        Activity::new()
                            .details(details)
                            .state(state)
                            .timestamps(Timestamps::new().start(self.start_secs)),
                    )
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    }

    pub fn clear(&mut self) {
        if let Some(mut client) = self.client.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
        self.client_id.clear();
    }

    fn connect(&mut self, client_id: &str) -> Result<(), String> {
        self.clear();
        let mut client = DiscordIpcClient::new(client_id);
        client.connect().map_err(|e| {
            format!(
                "No se pudo conectar con Discord. ¿Está Discord abierto? ({e})"
            )
        })?;
        self.client = Some(client);
        self.client_id = client_id.to_string();
        self.start_secs = now_secs();
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
