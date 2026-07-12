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
} from "react-icons/fa";
import { Background } from "./components/Background";
import { PlayDashboard } from "./components/PlayDashboard";
import { type CatalogViewMode } from "./components/ViewModeToggle";
import { CatalogTabs } from "./components/CatalogTabs";
import { AccountSelector } from "./components/AccountSelector";
import { SettingsPanel } from "./components/SettingsPanel";
import { SplashScreen } from "./components/SplashScreen";
import { StatusBanner } from "./components/StatusBanner";
import { useAuth } from "./hooks/useAuth";
import { useModpack } from "./hooks/useModpack";
import { useLaunch } from "./hooks/useLaunch";
import { useProjectIcons } from "./hooks/useProjectIcons";
import { useI18n } from "./lib/i18n";
import { useDiscordPresence } from "./hooks/useDiscordPresence";
import * as cmd from "./lib/tauri-commands";

const VIEW_STORAGE_KEY = "hylauncher.catalogView";

function loadViewMode(): CatalogViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "grid" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

export default function App() {
  const { t, locale } = useI18n();
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
  const [catalogView, setCatalogView] = useState<CatalogViewMode>(loadViewMode);
  const [splashDone, setSplashDone] = useState(false);

  const setViewMode = (mode: CatalogViewMode) => {
    setCatalogView(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  useDiscordPresence({
    launcherState: launch.launcherState,
    username: auth.activeAccount?.username,
    serverName: modpack.manifest?.server.name ?? "Minecraft",
    language: locale,
  });

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
    if (
      launch.launcherState === "running" ||
      launch.launcherState === "game_closed"
    ) {
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
  const { icons: modIcons } = useProjectIcons(mods);

  const optionalResourcePacks = modpack.manifest?.optionalResourcePacks ?? [];
  const { icons: textureIcons } = useProjectIcons(optionalResourcePacks);
  const filteredResourcePacks = optionalResourcePacks.filter((rp) =>
    rp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rp.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const optionalShaderPacks = modpack.manifest?.optionalShaderPacks ?? [];
  const { icons: shaderIcons } = useProjectIcons(optionalShaderPacks);
  const filteredShaderPacks = optionalShaderPacks.filter((sp) =>
    sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sp.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMods = mods.filter((mod) =>
    mod.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mod.filename.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleReinstallMods = async () => {
    if (!window.confirm(t("mods.reinstallConfirm"))) return;
    launch.setLauncherState("downloading");
    modpack.clearError();
    try {
      await modpack.reinstallMods();
      launch.setLauncherState("ready");
    } catch (e) {
      console.error(e);
      launch.setLauncherState("needs_update");
    }
  };

  return !splashDone ? (
    <SplashScreen onComplete={() => setSplashDone(true)} />
  ) : (
    <div className="app-container">
      <Background />

      {/* Custom Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">
          <img src="/logo.png" alt="" className="titlebar-logo" aria-hidden="true" />
          {launch.launcherState === "running"
            ? t("title.playing")
            : launch.launcherState === "game_closed"
            ? t("running.console")
            : activeTab === "play"
            ? t("title.play")
            : t("title.mods", { count: mods.length })}
        </span>
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            onClick={() => cmd.minimizeWindow()}
            title={t("title.minimize")}
          >
            <FaMinus size={10} />
          </button>
          <button
            className="titlebar-btn"
            onClick={async () => {
              const maximized = await cmd.toggleMaximizeWindow();
              setIsMaximized(maximized);
            }}
            title={isMaximized ? t("title.restore") : t("title.maximize")}
          >
            {isMaximized ? <FaWindowRestore size={10} /> : <FaSquare size={10} />}
          </button>
          <button
            className="titlebar-btn close"
            onClick={() => cmd.closeWindow()}
            title={t("title.close")}
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
              title={t("nav.play")}
            >
              <FaGamepad size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'mods' ? 'active' : ''}`}
              onClick={() => setActiveTab('mods')}
              title={t("nav.mods")}
            >
              <FaCube size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'textures' ? 'active' : ''}`}
              onClick={() => setActiveTab('textures')}
              title={t("nav.textures")}
            >
              <FaLayerGroup size={20} />
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'shaders' ? 'active' : ''}`}
              onClick={() => setActiveTab('shaders')}
              title={t("nav.shaders")}
            >
              <FaMagic size={20} />
            </button>
          </nav>

          <div className="sidebar-footer">
            <button
              className="sidebar-footer-item"
              onClick={() => setShowSettings(true)}
              title={t("nav.settings")}
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
                <span className="lunar-welcome-text">{t("welcome.back")}</span>
                <span className="lunar-welcome-user">
                  {auth.activeAccount?.username ?? t("welcome.player")}
                  {auth.activeAccount && <span className="lunar-status-dot" />}
                </span>
              </div>
            ) : (
            <div className="brand">
              <div className="brand-text">
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                  {activeTab === "mods" 
                    ? t("mods.listTitle")
                    : activeTab === "textures" 
                    ? t("textures.listTitle")
                    : t("shaders.listTitle")}
                </h1>
                <span className="version" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {activeTab === "mods"
                    ? t("mods.listSubtitle", { count: mods.length })
                    : activeTab === "textures"
                    ? t("textures.listSubtitle", { count: optionalResourcePacks.length })
                    : t("shaders.listSubtitle", { count: optionalShaderPacks.length })
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
                message={t("banner.update", {
                  count: modpack.updateDiff.modsToDownload.length,
                })}
              />
            )}

          {/* Tab View Switcher */}
          {activeTab === "play" && (
            <PlayDashboard
              manifest={modpack.manifest}
              modsCount={mods.length}
              missingMods={modpack.updateDiff?.modsToDownload.length ?? 0}
              launcherState={launch.launcherState}
              username={auth.activeAccount?.username ?? t("welcome.player")}
              showProgress={showProgress}
              progress={modpack.progress}
              progressLabel={modpack.progressLabel}
              progressPercent={modpack.progressPercent}
              hasAccount={!!auth.activeAccount}
              isStoppingGame={launch.isStoppingGame}
              onPlay={handlePlay}
              onStopGame={launch.stopGame}
              onLeaveGameConsole={launch.leaveGameConsole}
              onOpenSettings={() => setShowSettings(true)}
              onOpenMods={() => setActiveTab("mods")}
            />
          )}

          {(activeTab === "mods" || activeTab === "textures" || activeTab === "shaders") && (
            <CatalogTabs
              activeTab={activeTab}
              catalogView={catalogView}
              onViewChange={setViewMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              t={t}
              formatSize={formatSize}
              filteredMods={filteredMods}
              modIcons={modIcons}
              isModInstalled={isModInstalled}
              updateDiff={modpack.updateDiff}
              isUpdating={modpack.isUpdating}
              progress={modpack.progress}
              progressLabel={modpack.progressLabel}
              progressPercent={modpack.progressPercent}
              onInstallMods={handleInstallMods}
              onReinstallMods={handleReinstallMods}
              filteredResourcePacks={filteredResourcePacks}
              textureIcons={textureIcons}
              installedTextures={installedTextures}
              filteredShaderPacks={filteredShaderPacks}
              shaderIcons={shaderIcons}
              installedShaders={installedShaders}
              optionalInstalling={optionalInstalling}
              onToggleOptional={handleToggleOptional}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          activeAccount={auth.activeAccount}
          accounts={auth.accounts}
          onLogout={auth.logout}
          onSelectAccount={auth.selectAccount}
          onRemoveAccount={auth.removeAccount}
        />
      )}
    </div>
  );
}
