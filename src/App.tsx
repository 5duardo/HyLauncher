// ============================================================
// HyLauncher — Main App Component
// ============================================================

import { useState, useEffect } from "react";
import {
  FaMinus,
  FaSquare,
  FaWindowRestore,
  FaTimes,
  FaGamepad,
  FaCube,
  FaLayerGroup,
  FaMagic,
  FaCog,
  FaSearch,
  FaDownload,
  FaCheck,
} from "react-icons/fa";
import { Background } from "./components/Background";
import { PlayDashboard } from "./components/PlayDashboard";
import { ModIcon } from "./components/ModIcon";
import { ProgressBar } from "./components/ProgressBar";
import { AccountSelector } from "./components/AccountSelector";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBanner } from "./components/StatusBanner";
import { useAuth } from "./hooks/useAuth";
import { useModpack } from "./hooks/useModpack";
import { useLaunch } from "./hooks/useLaunch";
import { useModIcons } from "./hooks/useModIcons";
import * as cmd from "./lib/tauri-commands";

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
  const [isMaximized, setIsMaximized] = useState(false);

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

  useEffect(() => {
    if (launch.launcherState === "running") {
      setActiveTab("play");
    }
  }, [launch.launcherState]);

  const handlePlay = async () => {
    if (!auth.activeAccount) return;

    const missingMods = modpack.updateDiff?.modsToDownload.length ?? 0;
    if (missingMods > 0 || launch.launcherState === "needs_update") {
      setActiveTab("mods");
      return;
    }

    if (
      launch.launcherState === "error" ||
      launch.launcherState === "idle" ||
      launch.launcherState === "needs_install"
    ) {
      await launch.fullSetup();
      const diff = await modpack.checkForUpdates();
      if ((diff?.modsToDownload.length ?? 0) > 0) {
        setActiveTab("mods");
        return;
      }
      await launch.launch();
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
  const { icons: modIcons } = useModIcons(mods);
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
    modpack.clearError();
    try {
      await modpack.executeUpdate();
      const diff = await modpack.checkForUpdates();
      launch.setLauncherState(
        (diff?.modsToDownload.length ?? 0) > 0 ? "needs_update" : "ready"
      );
    } catch (e) {
      console.error(e);
      launch.setLauncherState("needs_update");
    }
  };

  return (
    <div className="app-container">
      <Background />

      {/* Custom Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">
          <img src="/logo.png" alt="" className="titlebar-logo" aria-hidden="true" />
          {launch.launcherState === "running"
            ? "HyLauncher — Jugando"
            : activeTab === "play"
            ? "HyLauncher — Jugar"
            : `HyLauncher — Mods (${mods.length})`}
        </span>
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            onClick={() => cmd.minimizeWindow()}
            title="Minimizar"
          >
            <FaMinus size={10} />
          </button>
          <button
            className="titlebar-btn"
            onClick={async () => {
              const maximized = await cmd.toggleMaximizeWindow();
              setIsMaximized(maximized);
            }}
            title={isMaximized ? "Restaurar" : "Maximizar"}
          >
            {isMaximized ? <FaWindowRestore size={10} /> : <FaSquare size={10} />}
          </button>
          <button
            className="titlebar-btn close"
            onClick={() => cmd.closeWindow()}
            title="Cerrar"
          >
            <FaTimes size={11} />
          </button>
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar sidebar--lunar">
          <div className="sidebar-brand sidebar-brand--icon">
            <img src="/logo.png" alt="HyLauncher" className="brand-logo-img" title="HyLauncher" />
          </div>

          <nav className="sidebar-nav sidebar-nav--icon">
            <button
              className={`sidebar-nav-item ${activeTab === 'play' ? 'active' : ''}`}
              onClick={() => setActiveTab('play')}
              title="Jugar"
            >
              <FaGamepad size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'mods' ? 'active' : ''}`}
              onClick={() => setActiveTab('mods')}
              title="Mods"
            >
              <FaCube size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'textures' ? 'active' : ''}`}
              onClick={() => setActiveTab('textures')}
              title="Texturas"
            >
              <FaLayerGroup size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'shaders' ? 'active' : ''}`}
              onClick={() => setActiveTab('shaders')}
              title="Shaders"
            >
              <FaMagic size={20} />
            </button>
          </nav>

          <div className="sidebar-footer">
            <button
              className="sidebar-footer-item"
              onClick={() => setShowSettings(true)}
              title="Ajustes"
            >
              <FaCog size={20} />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Header: Brand + Account */}
          <header className="header">
            {activeTab === "play" ? (
              <div className="lunar-welcome">
                <span className="lunar-welcome-text">Bienvenido de vuelta,</span>
                <span className="lunar-welcome-user">
                  {auth.activeAccount?.username ?? "Jugador"}
                  {auth.activeAccount && <span className="lunar-status-dot" />}
                </span>
              </div>
            ) : (
            <div className="brand">
              <div className="brand-text">
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                  {activeTab === "mods" 
                    ? "Listado de Mods" 
                    : activeTab === "textures" 
                    ? "Packs de Texturas" 
                    : "Packs de Shaders"}
                </h1>
                <span className="version" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {activeTab === "mods"
                    ? `Sincronizados con el servidor (${mods.length} en total)`
                    : activeTab === "textures"
                    ? `Opciones de apariencia (${optionalResourcePacks.length} disponibles)`
                    : `Efectos visuales avanzados (${optionalShaderPacks.length} disponibles)`
                  }
                </span>
              </div>
            </div>
            )}

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
            <PlayDashboard
              manifest={modpack.manifest}
              modsCount={mods.length}
              missingMods={modpack.updateDiff?.modsToDownload.length ?? 0}
              launcherState={launch.launcherState}
              username={auth.activeAccount?.username ?? "Jugador"}
              showProgress={showProgress}
              progress={modpack.progress}
              progressLabel={modpack.progressLabel}
              progressPercent={modpack.progressPercent}
              hasAccount={!!auth.activeAccount}
              isStoppingGame={launch.isStoppingGame}
              onPlay={handlePlay}
              onStopGame={launch.stopGame}
              onOpenSettings={() => setShowSettings(true)}
              onOpenMods={() => setActiveTab("mods")}
              onOpenTextures={() => setActiveTab("textures")}
              onOpenShaders={() => setActiveTab("shaders")}
            />
          )}

          {activeTab === "mods" && (
            <div className="mods-tab-content">
              {/* Search and Action Bar */}
              <div className="mods-action-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <div className="mods-search-container" style={{ flex: 1 }}>
                  <FaSearch size={14} className="mods-search-icon" />
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
                    className="btn btn--primary btn--bar"
                    onClick={handleInstallMods}
                    disabled={modpack.isUpdating}
                  >
                    {modpack.isUpdating ? (
                      <>
                        <span className="spinner" />
                        <span>Instalando... ({modpack.progressPercent}%)</span>
                      </>
                    ) : (
                      <>
                        <FaDownload size={14} />
                        <span>Instalar Mods ({modpack.updateDiff.modsToDownload.length})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="btn btn--status btn--bar">
                    <FaCheck size={14} />
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
                                <ModIcon modId={mod.id} iconUrl={modIcons[mod.id]} />
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
                  <FaSearch size={32} />
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
                  <FaSearch size={14} className="mods-search-icon" />
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
                                    <FaLayerGroup size={16} />
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
                                  className={`btn btn--sm ${isInstalled ? "btn--danger" : "btn--primary"}`}
                                  onClick={() => handleToggleOptional(rp.id, "resourcepack")}
                                  disabled={isInstalling}
                                >
                                  {isInstalling ? (
                                    <>
                                      <span className="spinner" />
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
                  <FaSearch size={32} />
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
                  <FaSearch size={14} className="mods-search-icon" />
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
                                    <FaMagic size={16} />
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
                                  className={`btn btn--sm ${isInstalled ? "btn--danger" : "btn--primary"}`}
                                  onClick={() => handleToggleOptional(sp.id, "shaderpack")}
                                  disabled={isInstalling}
                                >
                                  {isInstalling ? (
                                    <>
                                      <span className="spinner" />
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
                  <FaSearch size={32} />
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
