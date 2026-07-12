// ============================================================
// HyLauncher — Microsoft OAuth2 Device Code Flow
// ============================================================
//
// Full authentication chain:
// 1. Microsoft Device Code → Access Token
// 2. Xbox Live Authentication
// 3. XSTS Authorization
// 4. Minecraft Services Login

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::utils::error::{LauncherError, Result};

// ---- Constants ----

const PLACEHOLDER_CLIENT_ID: &str = "00000000-0000-0000-0000-000000000000";
/// Client ID de Prism Launcher — ya aprobado para api.minecraftservices.com
const DEFAULT_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";
const TENANT: &str = "consumers";
const SCOPE: &str = "XboxLive.signin XboxLive.offline_access";

fn client_id() -> String {
    if let Ok(id) = std::env::var("MICROSOFT_CLIENT_ID") {
        let id = id.trim();
        if !id.is_empty() && id != PLACEHOLDER_CLIENT_ID {
            return id.to_string();
        }
    }

    if let Some(id) = option_env!("MICROSOFT_CLIENT_ID") {
        let id = id.trim();
        if !id.is_empty() && id != PLACEHOLDER_CLIENT_ID {
            return id.to_string();
        }
    }

    DEFAULT_CLIENT_ID.to_string()
}

// ---- Types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    #[allow(dead_code)]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct TokenErrorResponse {
    error: String,
    #[allow(dead_code)]
    error_description: Option<String>,
}

#[derive(Debug, Serialize)]
struct XblAuthRequest {
    #[serde(rename = "Properties")]
    properties: XblAuthProperties,
    #[serde(rename = "RelyingParty")]
    relying_party: String,
    #[serde(rename = "TokenType")]
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XblAuthProperties {
    #[serde(rename = "AuthMethod")]
    auth_method: String,
    #[serde(rename = "SiteName")]
    site_name: String,
    #[serde(rename = "RpsTicket")]
    rps_ticket: String,
}

#[derive(Debug, Deserialize)]
struct XblResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XblDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XblDisplayClaims {
    xui: Vec<XblXui>,
}

#[derive(Debug, Deserialize)]
struct XblXui {
    uhs: String,
}

#[derive(Debug, Serialize)]
struct XstsAuthRequest {
    #[serde(rename = "Properties")]
    properties: XstsAuthProperties,
    #[serde(rename = "RelyingParty")]
    relying_party: String,
    #[serde(rename = "TokenType")]
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XstsAuthProperties {
    #[serde(rename = "SandboxId")]
    sandbox_id: String,
    #[serde(rename = "UserTokens")]
    user_tokens: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct XstsResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XblDisplayClaims,
}

#[derive(Debug, Serialize)]
struct McAuthRequest {
    #[serde(rename = "identityToken")]
    identity_token: String,
}

#[derive(Debug, Deserialize)]
struct McAuthResponse {
    access_token: String,
    #[allow(dead_code)]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
pub struct McProfile {
    pub id: String,
    pub name: String,
}

/// Result of the full Microsoft authentication chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftAuthResult {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
}

// ---- Implementation ----

/// Step 1: Request a device code from Microsoft
pub async fn request_device_code(client: &Client) -> Result<DeviceCodeResponse> {
    let client_id = client_id();
    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/devicecode",
        TENANT
    );

    let response = client
        .post(&url)
        .form(&[("client_id", client_id.as_str()), ("scope", SCOPE)])
        .send()
        .await?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(LauncherError::Auth(format!(
            "Device code request failed: {}",
            text
        )));
    }

    Ok(response.json().await?)
}

/// Step 2: Poll for the access token (blocks until user authenticates or timeout)
pub async fn poll_for_token(
    client: &Client,
    device_code: &str,
    interval: u64,
    expires_in: u64,
) -> Result<(String, Option<String>)> {
    let client_id = client_id();
    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        TENANT
    );

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(expires_in);

    loop {
        if start.elapsed() > timeout {
            return Err(LauncherError::Auth("Device code expired".to_string()));
        }

        tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

        let response = client
            .post(&url)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id.as_str()),
                ("device_code", device_code),
            ])
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if status.is_success() {
            let token_resp: TokenResponse = serde_json::from_str(&body)?;
            return Ok((token_resp.access_token, token_resp.refresh_token));
        }

        // Check if it's an expected pending error
        if let Ok(err_resp) = serde_json::from_str::<TokenErrorResponse>(&body) {
            match err_resp.error.as_str() {
                "authorization_pending" => continue,
                "slow_down" => {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
                "authorization_declined" => {
                    return Err(LauncherError::Auth("User declined authorization".to_string()));
                }
                "expired_token" => {
                    return Err(LauncherError::Auth("Device code expired".to_string()));
                }
                _ => {
                    return Err(LauncherError::Auth(format!(
                        "Token error: {}",
                        err_resp.error
                    )));
                }
            }
        }
    }
}

/// Step 3: Authenticate with Xbox Live
pub async fn xbox_live_auth(client: &Client, access_token: &str) -> Result<(String, String)> {
    let request = XblAuthRequest {
        properties: XblAuthProperties {
            auth_method: "RPS".to_string(),
            site_name: "user.auth.xboxlive.com".to_string(),
            rps_ticket: format!("d={}", access_token),
        },
        relying_party: "http://auth.xboxlive.com".to_string(),
        token_type: "JWT".to_string(),
    };

    let response = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(LauncherError::Auth(format!("Xbox Live auth failed: {}", text)));
    }

    let xbl: XblResponse = response.json().await?;
    let uhs = xbl
        .display_claims
        .xui
        .first()
        .ok_or_else(|| LauncherError::Auth("No user hash in XBL response".to_string()))?
        .uhs
        .clone();

    Ok((xbl.token, uhs))
}

/// Step 4: Get XSTS token
pub async fn xsts_auth(client: &Client, xbl_token: &str) -> Result<(String, String)> {
    let request = XstsAuthRequest {
        properties: XstsAuthProperties {
            sandbox_id: "RETAIL".to_string(),
            user_tokens: vec![xbl_token.to_string()],
        },
        relying_party: "rp://api.minecraftservices.com/".to_string(),
        token_type: "JWT".to_string(),
    };

    let response = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(LauncherError::Auth(format!("XSTS auth failed: {}", text)));
    }

    let xsts: XstsResponse = response.json().await?;
    let uhs = xsts
        .display_claims
        .xui
        .first()
        .ok_or_else(|| LauncherError::Auth("No user hash in XSTS response".to_string()))?
        .uhs
        .clone();

    Ok((xsts.token, uhs))
}

fn map_minecraft_api_error(body: &str) -> String {
    if body.contains("Invalid app registration") {
        return "Tu app de Azure aún no está aprobada para la API de Minecraft. \
                Completa el formulario en https://aka.ms/mce-reviewappid con tu Client ID \
                y espera la respuesta de Microsoft (puede tardar semanas). \
                Mientras tanto, el login Premium no funcionará."
            .to_string();
    }

    format!("Error de autenticación con Minecraft: {}", body)
}

/// Step 5: Login to Minecraft Services
pub async fn minecraft_auth(
    client: &Client,
    xsts_token: &str,
    user_hash: &str,
) -> Result<String> {
    let request = McAuthRequest {
        identity_token: format!("XBL3.0 x={};{}", user_hash, xsts_token),
    };

    let response = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(LauncherError::Auth(map_minecraft_api_error(&text)));
    }

    let mc: McAuthResponse = response.json().await?;
    Ok(mc.access_token)
}

/// Step 6: Get Minecraft profile (username + UUID)
pub async fn get_minecraft_profile(
    client: &Client,
    mc_access_token: &str,
) -> Result<McProfile> {
    let response = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {}", mc_access_token))
        .send()
        .await?;

    let status = response.status();
    if status.as_u16() == 404 {
        return Err(LauncherError::Auth(
            "Esta cuenta de Microsoft no tiene Minecraft Java comprado.".to_string(),
        ));
    }

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(LauncherError::Auth(format!(
            "Failed to get Minecraft profile: {}",
            text
        )));
    }

    let profile: McProfile = response.json().await?;
    Ok(profile)
}

/// Complete authentication flow (all steps combined)
pub async fn full_microsoft_auth(
    client: &Client,
    device_code: &str,
    interval: u64,
    expires_in: u64,
) -> Result<MicrosoftAuthResult> {
    // Poll for Microsoft token
    let (access_token, refresh_token) =
        poll_for_token(client, device_code, interval, expires_in).await?;

    // Xbox Live
    let (xbl_token, _uhs) = xbox_live_auth(client, &access_token).await?;

    // XSTS
    let (xsts_token, user_hash) = xsts_auth(client, &xbl_token).await?;

    // Minecraft
    let mc_token = minecraft_auth(client, &xsts_token, &user_hash).await?;

    // Profile
    let profile = get_minecraft_profile(client, &mc_token).await?;

    // Format UUID with dashes
    let uuid = if profile.id.contains('-') {
        profile.id
    } else {
        format!(
            "{}-{}-{}-{}-{}",
            &profile.id[..8],
            &profile.id[8..12],
            &profile.id[12..16],
            &profile.id[16..20],
            &profile.id[20..]
        )
    };

    Ok(MicrosoftAuthResult {
        username: profile.name,
        uuid,
        access_token: mc_token,
        refresh_token,
    })
}
