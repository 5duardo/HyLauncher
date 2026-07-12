// ============================================================
// HyLauncher — Tauri Command Wrappers (Type-safe IPC)
// ============================================================

import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  DeviceCodeResponse,
  LauncherSettings,
  PackManifest,
  ProgressEvent,
  UpdateDiff,
} from "./types";

// ---- Authentication ----

/** Start Microsoft OAuth2 Device Code Flow */
export async function startMicrosoftLogin(): Promise<DeviceCodeResponse> {
  return invoke("start_microsoft_login");
}

/** Poll for Microsoft auth completion */
export async function pollMicrosoftLogin(deviceCode: string): Promise<Account> {
  return invoke("poll_microsoft_login", { deviceCode });
}

/** Cancel an ongoing Microsoft login */
export async function cancelMicrosoftLogin(): Promise<void> {
  return invoke("cancel_microsoft_login");
}

/** Login with offline mode */
export async function loginOffline(username: string): Promise<Account> {
  return invoke("login_offline", { username });
}

/** Get all stored accounts */
export async function getAccounts(): Promise<Account[]> {
  return invoke("get_accounts");
}

/** Set the active account */
export async function setActiveAccount(accountId: string): Promise<void> {
  return invoke("set_active_account", { accountId });
}

/** Remove an account */
export async function removeAccount(accountId: string): Promise<void> {
  return invoke("remove_account", { accountId });
}

/** Get the currently active account */
export async function getActiveAccount(): Promise<Account | null> {
  return invoke("get_active_account");
}

// ---- Modpack / Manifest ----

/** Check for updates by comparing remote vs local manifest */
export async function checkForUpdates(): Promise<UpdateDiff | null> {
  return invoke("check_for_updates");
}

/** Get the current local manifest */
export async function getLocalManifest(): Promise<PackManifest | null> {
  return invoke("get_local_manifest");
}

/** Execute the update/install based on a diff */
export async function executeUpdate(): Promise<void> {
  return invoke("execute_update");
}

/** Fetch Modrinth icon URLs for a list of mods */
export async function getModIcons(
  mods: { id: string; url: string }[]
): Promise<Record<string, string>> {
  return invoke("get_mod_icons", { mods });
}

// ---- Minecraft ----

/** Check if Minecraft + Fabric is fully installed */
export async function isMinecraftInstalled(): Promise<boolean> {
  return invoke("is_minecraft_installed");
}

/** Install Minecraft + Fabric from scratch */
export async function installMinecraft(): Promise<void> {
  return invoke("install_minecraft");
}

/** Launch the game */
export async function launchGame(): Promise<void> {
  return invoke("launch_game");
}

/** Check if the game process is still running */
export async function isGameRunning(): Promise<boolean> {
  return invoke("is_game_running");
}

/** Force-stop the running game process */
export async function stopGame(): Promise<void> {
  return invoke("stop_game");
}

// ---- Java ----

/** Check if a suitable Java runtime is available */
export async function isJavaAvailable(): Promise<boolean> {
  return invoke("is_java_available");
}

/** Download and install Java runtime */
export async function installJava(): Promise<void> {
  return invoke("install_java");
}

// ---- Settings ----

/** Get launcher settings */
export async function getSettings(): Promise<LauncherSettings> {
  return invoke("get_settings");
}

/** Save launcher settings */
export async function saveSettings(settings: LauncherSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

// ---- Window Controls ----

export async function minimizeWindow(): Promise<void> {
  return invoke("minimize_window");
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  return invoke("toggle_maximize_window");
}

export async function restoreWindow(): Promise<void> {
  return invoke("restore_window");
}

export async function closeWindow(): Promise<void> {
  return invoke("close_window");
}

// ---- Progress Event Listener ----

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Listen for progress events from the backend */
export function onProgress(
  callback: (event: ProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<ProgressEvent>("progress", (e) => callback(e.payload));
}

/** Listen for launcher state changes */
export function onStateChange(
  callback: (state: string) => void
): Promise<UnlistenFn> {
  return listen<string>("state_change", (e) => callback(e.payload));
}

/** Listen for error messages */
export function onError(
  callback: (error: string) => void
): Promise<UnlistenFn> {
  return listen<string>("launcher_error", (e) => callback(e.payload));
}

// ---- Optional Components (Shaders & Texture Packs) ----

export async function checkOptionalFile(folderType: string, filename: string): Promise<boolean> {
  return invoke("check_optional_file", { folderType, filename });
}

export async function downloadOptionalFile(
  url: string,
  folderType: string,
  filename: string,
  sha1: string
): Promise<void> {
  return invoke("download_optional_file", { url, folderType, filename, sha1 });
}

export async function deleteOptionalFile(folderType: string, filename: string): Promise<void> {
  return invoke("delete_optional_file", { folderType, filename });
}
