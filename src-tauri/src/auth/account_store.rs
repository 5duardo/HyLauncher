// ============================================================
// HyLauncher — Account Store (Persistence)
// ============================================================

use serde::{Deserialize, Serialize};
use crate::utils::{error::Result, paths};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub mode: String, // "premium" or "offline"
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub skin_url: Option<String>,
    pub last_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountStore {
    pub accounts: Vec<StoredAccount>,
    pub active_account_id: Option<String>,
}

impl AccountStore {
    /// Load from disk
    pub fn load() -> Result<Self> {
        let path = paths::accounts_file();
        if !path.exists() {
            return Ok(Self::default());
        }
        let data = std::fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&data)?)
    }

    /// Save to disk
    pub fn save(&self) -> Result<()> {
        let path = paths::accounts_file();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, data)?;
        Ok(())
    }

    /// Add or update an account
    pub fn upsert(&mut self, account: StoredAccount) {
        if let Some(existing) = self.accounts.iter_mut().find(|a| a.id == account.id) {
            *existing = account;
        } else {
            self.accounts.push(account);
        }
    }

    /// Remove an account by ID
    pub fn remove(&mut self, id: &str) {
        self.accounts.retain(|a| a.id != id);
        if self.active_account_id.as_deref() == Some(id) {
            self.active_account_id = self.accounts.first().map(|a| a.id.clone());
        }
    }

    /// Get the active account
    pub fn active(&self) -> Option<&StoredAccount> {
        let id = self.active_account_id.as_ref()?;
        self.accounts.iter().find(|a| &a.id == id)
    }

    /// Set active account by ID
    pub fn set_active(&mut self, id: &str) {
        if self.accounts.iter().any(|a| a.id == id) {
            self.active_account_id = Some(id.to_string());
        }
    }
}

/// Helper: create current timestamp in seconds
pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
