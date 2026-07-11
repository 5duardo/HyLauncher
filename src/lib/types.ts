// ============================================================
// HyLauncher — Shared TypeScript Types
// ============================================================

/** Authentication mode */
export type AuthMode = "premium" | "offline";

/** Account stored in the launcher */
export interface Account {
  id: string;
  username: string;
  uuid: string;
  mode: AuthMode;
  /** Only for premium accounts */
  accessToken?: string;
  refreshToken?: string;
  /** Skin head URL (crafatar) for premium */
  skinUrl?: string;
  /** Last used timestamp */
  lastUsed: number;
}

/** Launcher state machine */
export type LauncherState =
  | "idle"
  | "checking"
  | "needs_install"
  | "needs_update"
  | "downloading"
  | "installing"
  | "verifying"
  | "ready"
  | "launching"
  | "running"
  | "error";

/** Progress event from backend */
export interface ProgressEvent {
  stage: ProgressStage;
  current: number;
  total: number;
  /** e.g. filename being downloaded */
  detail?: string;
  /** bytes per second */
  speed?: number;
}

export type ProgressStage =
  | "downloading_java"
  | "downloading_minecraft"
  | "downloading_assets"
  | "downloading_libraries"
  | "installing_fabric"
  | "downloading_mods"
  | "deploying_configs"
  | "verifying";

/** Stage display labels */
export const STAGE_LABELS: Record<ProgressStage, string> = {
  downloading_java: "Descargando Java Runtime...",
  downloading_minecraft: "Descargando Minecraft...",
  downloading_assets: "Descargando assets...",
  downloading_libraries: "Descargando bibliotecas...",
  installing_fabric: "Instalando Fabric Loader...",
  downloading_mods: "Descargando mods...",
  deploying_configs: "Aplicando configuración...",
  verifying: "Verificando integridad...",
};

/** Remote manifest types */
export interface PackManifest {
  packVersion: string;
  packName: string;
  packDescription: string;
  minecraft: string;
  fabricLoader: string;
  baseUrl: string;
  mods: ModEntry[];
  configs: ConfigEntry[];
  resourcePacks: ResourcePackEntry[];
  shaderPacks: ShaderPackEntry[];
  protectedPaths: string[];
  server: ServerConfig;
  java: JavaConfig;
}

export interface ModEntry {
  id: string;
  filename: string;
  url: string;
  sha1: string;
  size: number;
  required: boolean;
  side: "client" | "server" | "both";
}

export type OverwritePolicy = "always" | "once" | "never";

export interface ConfigEntry {
  path: string;
  url: string;
  sha1: string;
  overwritePolicy: OverwritePolicy;
}

export interface ResourcePackEntry {
  filename: string;
  url: string;
  sha1: string;
  enabled: boolean;
}

export interface ShaderPackEntry {
  filename: string;
  url: string;
  sha1: string;
  enabled: boolean;
}

export interface ServerConfig {
  name: string;
  address: string;
  port: number;
  autoConnect: boolean;
}

export interface JavaConfig {
  version: number;
  downloadUrl: string;
  sha1?: string;
}

/** Microsoft auth device code response */
export interface DeviceCodeResponse {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

/** Launcher settings */
export interface LauncherSettings {
  ramMb: number;
  javaPathOverride?: string;
  instancePath?: string;
  theme: "dark";
  language: string;
}

/** Update diff result */
export interface UpdateDiff {
  modsToDownload: ModEntry[];
  modsToDelete: string[];
  configsToUpdate: ConfigEntry[];
  resourcePacksToUpdate: ResourcePackEntry[];
  shaderPacksToUpdate: ShaderPackEntry[];
  totalDownloadSize: number;
  isFullInstall: boolean;
}
