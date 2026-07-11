// ============================================================
// HyLauncher — Main App Component
// ============================================================

import { useState, useEffect } from "react";
import { Background } from "./components/Background";
import { PlayButton } from "./components/PlayButton";
import { ProgressBar } from "./components/ProgressBar";
import { AccountSelector } from "./components/AccountSelector";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBanner } from "./components/StatusBanner";
import { useAuth } from "./hooks/useAuth";
import { useModpack } from "./hooks/useModpack";
import { useLaunch } from "./hooks/useLaunch";
import * as cmd from "./lib/tauri-commands";
import type { LauncherState } from "./lib/types";

const STATE_LABELS: Record<
  LauncherState,
  { label: string; icon: React.ReactNode }
> = {
  idle: {
    label: "Esperando...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-text-muted)' }}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  checking: {
    label: "Buscando actualizaciones...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-cyan)' }} className="spinner-icon">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
      </svg>
    ),
  },
  needs_install: {
    label: "Requiere instalación de archivos",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-warning)' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    ),
  },
  needs_update: {
    label: "Actualización disponible en pestaña de Mods",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-warning)' }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  downloading: {
    label: "Descargando mods y recursos...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-cyan)' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    ),
  },
  installing: {
    label: "Instalando archivos del juego...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-cyan)' }}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  verifying: {
    label: "Verificando archivos locales...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-cyan)' }}>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  ready: {
    label: "Listo para jugar",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-success)' }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  launching: {
    label: "Iniciando Minecraft...",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-accent-hover)' }}>
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  running: {
    label: "Minecraft está en ejecución",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-accent-hover)' }}>
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="15" y1="13" x2="15.01" y2="13" />
        <line x1="18" y1="11" x2="18.01" y2="11" />
        <rect x="2" y="6" width="20" height="12" rx="3" />
      </svg>
    ),
  },
  error: {
    label: "Error al verificar o lanzar",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-error)' }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
};

export default function App() {
  const auth = useAuth();
  const modpack = useModpack();
  const launch = useLaunch();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"play" | "mods" | "textures" | "shaders">("play");
  const [searchQuery, setSearchQuery] = useState("");
  const [installedTextures, setInstalledTextures] = useState<Record<string, boolean>>({});
  const [installedShaders, setInstalledShaders] = useState<Record<string, boolean>>({});
  const [optionalInstalling, setOptionalInstalling] = useState<Record<string, boolean>>({});

  const checkOptionalPacks = async () => {
    if (!modpack.manifest) return;
    
    const texturesStatus: Record<string, boolean> = {};
    if (modpack.manifest.optionalResourcePacks) {
      for (const rp of modpack.manifest.optionalResourcePacks) {
        texturesStatus[rp.id] = await cmd.checkOptionalFile("resourcepack", rp.filename);
      }
    }
    setInstalledTextures(texturesStatus);

    const shadersStatus: Record<string, boolean> = {};
    if (modpack.manifest.optionalShaderPacks) {
      for (const sp of modpack.manifest.optionalShaderPacks) {
        shadersStatus[sp.id] = await cmd.checkOptionalFile("shaderpack", sp.filename);
      }
    }
    setInstalledShaders(shadersStatus);
  };

  useEffect(() => {
    checkOptionalPacks();
  }, [modpack.manifest, activeTab]);

  const handleToggleOptional = async (id: string, type: "resourcepack" | "shaderpack") => {
    const list = type === "resourcepack" 
      ? modpack.manifest?.optionalResourcePacks 
      : modpack.manifest?.optionalShaderPacks;
    
    const item = list?.find(x => x.id === id);
    if (!item) return;

    const isInstalled = type === "resourcepack" ? installedTextures[id] : installedShaders[id];

    setOptionalInstalling(prev => ({ ...prev, [id]: true }));
    launch.setLauncherState("downloading");

    try {
      if (isInstalled) {
        await cmd.deleteOptionalFile(type, item.filename);
      } else {
        await cmd.downloadOptionalFile(item.url, type, item.filename, item.sha1);
      }
      await checkOptionalPacks();
      launch.setLauncherState("ready");
    } catch (e) {
      console.error(e);
      launch.setLauncherState("error");
    } finally {
      setOptionalInstalling(prev => ({ ...prev, [id]: false }));
    }
  };

  // On mount: check for updates and setup state
  useEffect(() => {
    if (!auth.isLoading && auth.activeAccount) {
      launch.fullSetup().then(() => {
        modpack.checkForUpdates();
      });
    }
  }, [auth.isLoading, auth.activeAccount?.id]);

  // Load manifest and check updates on launcher startup
  useEffect(() => {
    modpack.checkForUpdates();
  }, []);

  const handlePlay = async () => {
    if (!auth.activeAccount) return;

    if (
      launch.launcherState === "error" ||
      launch.launcherState === "idle" ||
      launch.launcherState === "needs_install" ||
      launch.launcherState === "needs_update"
    ) {
      await launch.fullSetup();
      await modpack.checkForUpdates();
      if ((launch.launcherState as string) === "ready") {
        await launch.launch();
      }
    } else if (launch.launcherState === "ready") {
      await launch.launch();
    }
  };

  const error = auth.error || modpack.error || launch.error;
  const showProgress =
    launch.launcherState === "downloading" ||
    launch.launcherState === "installing" ||
    launch.launcherState === "verifying";

  const mods = modpack.manifest?.mods ?? [];
  const filteredMods = mods.filter((mod) =>
    mod.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mod.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const optionalResourcePacks = modpack.manifest?.optionalResourcePacks ?? [];
  const filteredResourcePacks = optionalResourcePacks.filter((rp) =>
    rp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rp.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const optionalShaderPacks = modpack.manifest?.optionalShaderPacks ?? [];
  const filteredShaderPacks = optionalShaderPacks.filter((sp) =>
    sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sp.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const isModInstalled = (modId: string) => {
    if (!modpack.updateDiff) return true;
    return !modpack.updateDiff.modsToDownload.some((m) => m.id === modId);
  };

  const handleInstallMods = async () => {
    launch.setLauncherState("downloading");
    try {
      await modpack.executeUpdate();
      launch.setLauncherState("ready");
    } catch (e) {
      console.error(e);
      launch.setLauncherState("error");
    }
  };

  return (
    <div className="app-container">
      <Background />

      {/* Custom Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">
          {activeTab === "play" ? "HyLauncher — Jugar" : `HyLauncher — Mods (${mods.length})`}
        </span>
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            onClick={() => cmd.minimizeWindow()}
            title="Minimizar"
          >
            ─
          </button>
          <button
            className="titlebar-btn close"
            onClick={() => cmd.closeWindow()}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Brand/Logo */}
          <div className="sidebar-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-cyan)', filter: 'drop-shadow(0 0 4px var(--color-cyan-glow))' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="var(--color-cyan)" />
            </svg>
            <div className="brand-info">
              <span className="brand-name">HyLauncher</span>
              <span className="brand-sub">v1.0.0</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeTab === 'play' ? 'active' : ''}`}
              onClick={() => setActiveTab('play')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <line x1="6" y1="12" x2="10" y2="12" />
                <line x1="8" y1="10" x2="8" y2="14" />
              </svg>
              Jugar
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'mods' ? 'active' : ''}`}
              onClick={() => setActiveTab('mods')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              Mods
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'textures' ? 'active' : ''}`}
              onClick={() => setActiveTab('textures')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Texturas
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'shaders' ? 'active' : ''}`}
              onClick={() => setActiveTab('shaders')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Shaders
            </button>
          </nav>

          {/* Bottom Settings Button in Sidebar */}
          <div className="sidebar-footer">
            <button
              className="sidebar-footer-item"
              onClick={() => setShowSettings(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Ajustes
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Header: Brand + Account */}
          <header className="header">
            <div className="brand">
              <div className="brand-text">
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                  {activeTab === "play" 
                    ? (modpack.manifest?.packName ?? "HyPack") 
                    : activeTab === "mods" 
                    ? "Listado de Mods" 
                    : activeTab === "textures" 
                    ? "Packs de Texturas" 
                    : "Packs de Shaders"}
                </h1>
                <span className="version" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {activeTab === "play" 
                    ? `Minecraft ${modpack.manifest?.minecraft ?? "1.20.1"} · Fabric ${modpack.manifest?.fabricLoader ?? ""}`
                    : activeTab === "mods"
                    ? `Sincronizados con el servidor (${mods.length} en total)`
                    : activeTab === "textures"
                    ? `Opciones de apariencia (${optionalResourcePacks.length} disponibles)`
                    : `Efectos visuales avanzados (${optionalShaderPacks.length} disponibles)`
                  }
                </span>
              </div>
            </div>

            <AccountSelector
              activeAccount={auth.activeAccount}
              onLoginOffline={auth.loginOffline}
              onLoginMicrosoft={auth.startMicrosoftLogin}
              onCancelMicrosoft={auth.cancelMicrosoftLogin}
              deviceCode={auth.deviceCode}
              isPolling={auth.isPolling}
              isLoading={auth.isLoading}
              onLogout={auth.logout}
            />
          </header>

          {/* Status Banner */}
          {error && (
            <StatusBanner
              type="error"
              message={error}
              onDismiss={() => {
                auth.clearError();
                modpack.clearError();
                launch.clearError();
              }}
            />
          )}

          {modpack.updateDiff &&
            modpack.updateDiff.modsToDownload.length > 0 &&
            !modpack.isUpdating &&
            launch.launcherState !== "downloading" && (
              <StatusBanner
                type="info"
                message={`Actualización disponible: ${modpack.updateDiff.modsToDownload.length} mods por descargar`}
              />
            )}

          {/* Tab View Switcher */}
          {activeTab === "play" && (
            <div className="center-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '24px' }}>
              <div className="server-info" style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>
                  {modpack.manifest?.server.name ?? "HyServer"}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 16px' }}>
                  {modpack.manifest?.packDescription ?? "Modpack oficial del servidor"}
                </p>
                <div className="server-meta" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <span className="meta-chip">
                    <span className="dot" />
                    Minecraft {modpack.manifest?.minecraft ?? "1.20.1"}
                  </span>
                  <span className="meta-chip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, color: 'var(--color-cyan)' }}>
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    Fabric {modpack.manifest?.fabricLoader ?? ""}
                  </span>
                  <span className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('mods')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, color: 'var(--color-accent-hover)' }}>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    {mods.length} mods
                  </span>
                </div>
              </div>

              {showProgress && (
                <ProgressBar
                  progress={modpack.progress}
                  label={modpack.progressLabel}
                  percent={modpack.progressPercent}
                />
              )}

              <PlayButton
                state={launch.launcherState}
                onClick={handlePlay}
                disabled={!auth.activeAccount || launch.launcherState !== "ready"}
              />

              {!auth.activeAccount && (
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "-8px" }}>
                  Inicia sesión para jugar
                </p>
              )}

              {/* Bottom status bar indicator */}
              <div className="bottom-bar" style={{ width: '100%', maxWidth: '480px', marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                <div className="status-indicator">
                  {STATE_LABELS[launch.launcherState]?.icon}
                  <span>{STATE_LABELS[launch.launcherState]?.label ?? launch.launcherState}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "mods" && (
            <div className="mods-tab-content">
              {/* Search and Action Bar */}
              <div className="mods-action-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <div className="mods-search-container" style={{ flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mods-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar mods..."
                    className="mods-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Install / Sync button */}
                {modpack.updateDiff && modpack.updateDiff.modsToDownload.length > 0 ? (
                  <button
                    className="btn btn--primary"
                    style={{
                      padding: '10px 20px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                      boxShadow: '0 0 12px rgba(124, 58, 237, 0.3)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={handleInstallMods}
                    disabled={modpack.isUpdating}
                  >
                    {modpack.isUpdating ? (
                      <>
                        <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                        <span>Instalando... ({modpack.progressPercent}%)</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Instalar Mods ({modpack.updateDiff.modsToDownload.length})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: 'var(--color-success)',
                      flexShrink: 0
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Mods al día</span>
                  </div>
                )}
              </div>

              {/* Progress bar inline during mods download */}
              {modpack.isUpdating && modpack.progress && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <ProgressBar
                    progress={modpack.progress}
                    label={modpack.progressLabel}
                    percent={modpack.progressPercent}
                  />
                </div>
              )}

              {/* List of mods */}
              {filteredMods.length > 0 ? (
                <div className="mods-list-container">
                  <div className="mods-list-scroll">
                    <table className="mods-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '38%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Mod</th>
                          <th>Archivo</th>
                          <th>Tamaño</th>
                          <th>Tipo</th>
                          <th>Lado</th>
                          <th style={{ textAlign: 'right' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMods.map((mod) => (
                          <tr key={mod.id}>
                            <td>
                              <div className="mod-row-info">
                                <div className="mod-row-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                  </svg>
                                </div>
                                <div className="mod-row-name-container">
                                  <span className="mod-row-name" title={mod.id}>
                                    {mod.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                  </span>
                                  <span className="mod-row-id">{mod.id}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="mod-row-filename" title={mod.filename}>{mod.filename}</span>
                            </td>
                            <td>
                              <span className="mod-size">{formatSize(mod.size)}</span>
                            </td>
                            <td>
                              <span className={`mod-badge ${mod.required ? 'mod-badge--required' : 'mod-badge--optional'}`}>
                                {mod.required ? "Requerido" : "Opcional"}
                              </span>
                            </td>
                            <td>
                              <span className="mod-badge mod-badge--side">{mod.side}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isModInstalled(mod.id) ? (
                                <span style={{ color: 'var(--color-success)', fontSize: '15px', fontWeight: 'bold' }}>✓</span>
                              ) : (
                                <span style={{ color: 'var(--color-error)', fontSize: '15px', fontWeight: 'bold' }}>✕</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-muted)', gap: '8px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>No se encontraron mods que coincidan con la búsqueda</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "textures" && (
            <div className="mods-tab-content">
              {/* Search Bar */}
              <div className="mods-action-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <div className="mods-search-container" style={{ flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mods-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar texturas..."
                    className="mods-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* List of Resource Packs */}
              {filteredResourcePacks.length > 0 ? (
                <div className="mods-list-container">
                  <div className="mods-list-scroll">
                    <table className="mods-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '17%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Textura</th>
                          <th>Archivo</th>
                          <th>Tamaño</th>
                          <th style={{ textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResourcePacks.map((rp) => {
                          const isInstalled = installedTextures[rp.id];
                          const isInstalling = optionalInstalling[rp.id];
                          return (
                            <tr key={rp.id}>
                              <td>
                                <div className="mod-row-info">
                                  <div className="mod-row-icon" style={{ color: 'var(--color-cyan)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                      <path d="M2 17l10 5 10-5" />
                                      <path d="M2 12l10 5 10-5" />
                                    </svg>
                                  </div>
                                  <div className="mod-row-name-container">
                                    <span className="mod-row-name" style={{ color: 'white', fontWeight: 600 }}>{rp.name}</span>
                                    <span className="mod-row-id" style={{ fontSize: '11px', whiteSpace: 'normal', color: 'var(--color-text-secondary)', lineHeight: '1.3', marginTop: '2px' }}>{rp.description}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="mod-row-filename" title={rp.filename}>{rp.filename}</span>
                              </td>
                              <td>
                                <span className="mod-size">{formatSize(rp.size)}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className={`btn ${isInstalled ? 'btn--secondary' : 'btn--primary'}`}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: isInstalled ? 'rgba(239, 68, 68, 0.1)' : 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                                    border: isInstalled ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                                    color: isInstalled ? '#ef4444' : 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => handleToggleOptional(rp.id, "resourcepack")}
                                  disabled={isInstalling}
                                >
                                  {isInstalling ? (
                                    <>
                                      <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                                      <span>Instalando...</span>
                                    </>
                                  ) : isInstalled ? (
                                    <span>Desinstalar</span>
                                  ) : (
                                    <span>Instalar</span>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-muted)', gap: '8px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>No se encontraron texturas</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "shaders" && (
            <div className="mods-tab-content">
              {/* Search Bar */}
              <div className="mods-action-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <div className="mods-search-container" style={{ flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mods-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar shaders..."
                    className="mods-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* List of Shader Packs */}
              {filteredShaderPacks.length > 0 ? (
                <div className="mods-list-container">
                  <div className="mods-list-scroll">
                    <table className="mods-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '17%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Shader</th>
                          <th>Archivo</th>
                          <th>Tamaño</th>
                          <th style={{ textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShaderPacks.map((sp) => {
                          const isInstalled = installedShaders[sp.id];
                          const isInstalling = optionalInstalling[sp.id];
                          return (
                            <tr key={sp.id}>
                              <td>
                                <div className="mod-row-info">
                                  <div className="mod-row-icon" style={{ color: 'var(--color-cyan)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                  </div>
                                  <div className="mod-row-name-container">
                                    <span className="mod-row-name" style={{ color: 'white', fontWeight: 600 }}>{sp.name}</span>
                                    <span className="mod-row-id" style={{ fontSize: '11px', whiteSpace: 'normal', color: 'var(--color-text-secondary)', lineHeight: '1.3', marginTop: '2px' }}>{sp.description}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="mod-row-filename" title={sp.filename}>{sp.filename}</span>
                              </td>
                              <td>
                                <span className="mod-size">{formatSize(sp.size)}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className={`btn ${isInstalled ? 'btn--secondary' : 'btn--primary'}`}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: isInstalled ? 'rgba(239, 68, 68, 0.1)' : 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                                    border: isInstalled ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                                    color: isInstalled ? '#ef4444' : 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => handleToggleOptional(sp.id, "shaderpack")}
                                  disabled={isInstalling}
                                >
                                  {isInstalling ? (
                                    <>
                                      <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                                      <span>Instalando...</span>
                                    </>
                                  ) : isInstalled ? (
                                    <span>Desinstalar</span>
                                  ) : (
                                    <span>Instalar</span>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-muted)', gap: '8px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>No se encontraron shaders</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
