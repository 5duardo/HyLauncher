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
  FaBoxes,
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
import { useModpacks } from "./hooks/useModpacks";
import { ModpacksPanel } from "./components/ModpacksPanel";
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

// Concurrencia limitada para descargas múltiples (como el backend x8,
// aquí x6 porque cada una es un IPC Tauri).
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift()!;
        await fn(item);
      }
    })
  );
}

export default function App() {
  const { t, locale } = useI18n();
  const auth = useAuth();
  const packs = useModpacks();
  const modpack = useModpack(packs.activePackId);
  const launch = useLaunch();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"play" | "modpacks" | "mods" | "textures" | "shaders">("play");
  const [selectingPackId, setSelectingPackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [installedTextures, setInstalledTextures] = useState<Record<string, boolean>>({});
  const [installedShaders, setInstalledShaders] = useState<Record<string, boolean>>({});
  const [optionalInstalling, setOptionalInstalling] = useState<Record<string, boolean>>({});
  const [verifyError, setVerifyError] = useState<string | null>(null);
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

  // Texturas = opcionales del manifest + las incluidas en el pack (resourcePacks
  // auto-instalados, como las 76 de KEO). Sin esto la pestaña sale vacía en KEO.
  const prettyPackName = (filename: string) =>
    filename.replace(/\.(zip|jar)$/i, "").replace(/[_+]+/g, " ").trim() || filename;
  const resolvePackUrl = (url: string) =>
    url.replace("{baseUrl}", modpack.manifest?.baseUrl ?? "");
  const autoResourcePackEntries = (modpack.manifest?.resourcePacks ?? []).map((rp) => ({
    id: `auto:${rp.filename}`,
    name: prettyPackName(rp.filename),
    description: t("textures.included"),
    filename: rp.filename,
    url: resolvePackUrl(rp.url),
    sha1: rp.sha1,
    size: 0,
  }));
  const allResourcePacks = [
    ...(modpack.manifest?.optionalResourcePacks ?? []),
    ...autoResourcePackEntries,
  ];

  // Pendiente total del pack: mods + configs + texturas + shaders incluidos.
  // Jugar exige tener TODO el contenido, no solo los mods.
  const pendingContentCount =
    (modpack.updateDiff?.modsToDownload.length ?? 0) +
    (modpack.updateDiff?.configsToUpdate.length ?? 0) +
    (modpack.updateDiff?.resourcePacksToUpdate ?? 0) +
    (modpack.updateDiff?.shaderPacksToUpdate ?? 0);
  const hasPendingContent = pendingContentCount > 0;
  const activePackSummary = packs.packs.find((p) => p.id === packs.activePackId) ?? null;
  const packLabel = modpack.manifest
    ? {
        name: modpack.manifest.packName,
        version: modpack.manifest.packVersion,
        mc: modpack.manifest.minecraft,
      }
    : activePackSummary
      ? {
          name: activePackSummary.name,
          version: activePackSummary.packVersion ?? "?",
          mc: activePackSummary.minecraft,
        }
      : null;

  const checkOptionalPacks = async () => {
    if (!modpack.manifest || !packs.activePackId) return;

    const texturesStatus: Record<string, boolean> = {};
    for (const rp of allResourcePacks) {
      texturesStatus[rp.id] = await cmd.checkOptionalFile("resourcepack", rp.filename, packs.activePackId);
    }
    setInstalledTextures(texturesStatus);

    const shadersStatus: Record<string, boolean> = {};
    if (modpack.manifest.optionalShaderPacks) {
      for (const sp of modpack.manifest.optionalShaderPacks) {
        shadersStatus[sp.id] = await cmd.checkOptionalFile("shaderpack", sp.filename, packs.activePackId);
      }
    }
    setInstalledShaders(shadersStatus);
  };

  useEffect(() => {
    checkOptionalPacks();
  }, [modpack.manifest, activeTab]);

  // Descarga TODOS los pendientes de la pestaña (texturas o shaders),
  // en paralelo (6) como el backend. Sigue con los demás si uno falla.
  const handleInstallAllOptional = async (type: "resourcepack" | "shaderpack") => {
    const list =
      type === "resourcepack"
        ? allResourcePacks
        : (modpack.manifest?.optionalShaderPacks ?? []);
    const installed = type === "resourcepack" ? installedTextures : installedShaders;
    const missing = list.filter((x) => !installed[x.id]);
    if (missing.length === 0 || !packs.activePackId) return;

    launch.setLauncherState("downloading");
    try {
      await runPool(missing, 6, async (item) => {
        setOptionalInstalling((prev) => ({ ...prev, [item.id]: true }));
        try {
          await cmd.downloadOptionalFile(resolvePackUrl(item.url), type, item.filename, item.sha1, packs.activePackId ?? undefined);
        } catch (e) {
          console.error(`Optional ${item.filename}:`, e);
        } finally {
          setOptionalInstalling((prev) => ({ ...prev, [item.id]: false }));
        }
      });
      await checkOptionalPacks();
      launch.setLauncherState("ready");
    } catch (e) {
      console.error(e);
      launch.setLauncherState("error");
    }
  };

  // Baja los opcionales que falten en disco (texturas + shaders), sin
  // abortar si uno falla (p. ej. binarios del release aún no subidos).
  const syncMissingOptionals = async () => {
    if (!packs.activePackId) return;
    const jobs: { type: "resourcepack" | "shaderpack"; id: string; filename: string; url: string; sha1: string }[] = [];
    for (const rp of allResourcePacks) {
      if (!(await cmd.checkOptionalFile("resourcepack", rp.filename, packs.activePackId))) {
        jobs.push({ type: "resourcepack", id: rp.id, filename: rp.filename, url: rp.url, sha1: rp.sha1 });
      }
    }
    for (const sp of modpack.manifest?.optionalShaderPacks ?? []) {
      if (!(await cmd.checkOptionalFile("shaderpack", sp.filename, packs.activePackId))) {
        jobs.push({ type: "shaderpack", id: sp.id, filename: sp.filename, url: sp.url, sha1: sp.sha1 });
      }
    }
    if (jobs.length === 0) {
      await checkOptionalPacks();
      return;
    }
    launch.setLauncherState("downloading");
    await runPool(jobs, 6, async (job) => {
      setOptionalInstalling((prev) => ({ ...prev, [job.id]: true }));
      try {
        await cmd.downloadOptionalFile(resolvePackUrl(job.url), job.type, job.filename, job.sha1, packs.activePackId ?? undefined);
      } catch (e) {
        console.error(`Optional ${job.filename}:`, e);
      } finally {
        setOptionalInstalling((prev) => ({ ...prev, [job.id]: false }));
      }
    });
    await checkOptionalPacks();
    launch.setLauncherState("ready");
  };

  // Cuenta lo que sigue faltando en disco: diff requerido + opcionales.
  // OJO: Jugar exige que esto sea 0 (todo: mods, texturas y shaders).
  const countMissingContent = async (): Promise<number> => {
    const packId = packs.activePackId;
    if (!packId) return 0;
    const d = await modpack.checkForUpdates();
    let n =
      (d?.modsToDownload.length ?? 0) +
      (d?.configsToUpdate.length ?? 0) +
      (d?.resourcePacksToUpdate ?? 0) +
      (d?.shaderPacksToUpdate ?? 0);
    const tex = await Promise.all(
      allResourcePacks.map((rp) =>
        cmd.checkOptionalFile("resourcepack", rp.filename, packId).catch(() => false)
      )
    );
    n += tex.filter((ok) => !ok).length;
    const sh = await Promise.all(
      (modpack.manifest?.optionalShaderPacks ?? []).map((sp) =>
        cmd.checkOptionalFile("shaderpack", sp.filename, packId).catch(() => false)
      )
    );
    n += sh.filter((ok) => !ok).length;
    return n;
  };

  const handleToggleOptional = async (id: string, type: "resourcepack" | "shaderpack") => {
    const list = type === "resourcepack"
      ? allResourcePacks
      : modpack.manifest?.optionalShaderPacks;
    
    const item = list?.find(x => x.id === id);
    if (!item) return;

    const isInstalled = type === "resourcepack" ? installedTextures[id] : installedShaders[id];

    setOptionalInstalling(prev => ({ ...prev, [id]: true }));
    launch.setLauncherState("downloading");

    try {
      if (isInstalled) {
        await cmd.deleteOptionalFile(type, item.filename, packs.activePackId ?? undefined);
      } else {
        await cmd.downloadOptionalFile(resolvePackUrl(item.url), type, item.filename, item.sha1, packs.activePackId ?? undefined);
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

  // Setup + update check, siempre ligados al modpack elegido.
  // Sin pack seleccionado no se instala ni se consulta nada.
  useEffect(() => {
    if (packs.isLoading || !packs.activePackId) return;
    if (!auth.isLoading && auth.activeAccount) {
      launch.fullSetup(packs.activePackId).then(() => {
        modpack.checkForUpdates();
      });
    } else if (!auth.isLoading) {
      modpack.checkForUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packs.isLoading, packs.activePackId, auth.isLoading, auth.activeAccount?.id]);

  const handleSelectPack = async (id: string) => {
    setSelectingPackId(id);
    try {
      const pack = await packs.selectPack(id);
      if (pack) {
        setActiveTab("play");
      }
    } finally {
      setSelectingPackId(null);
    }
  };

  useEffect(() => {
    if (
      launch.launcherState === "running" ||
      launch.launcherState === "game_closed"
    ) {
      setActiveTab("play");
    }
  }, [launch.launcherState]);

  const isBusyState = (s: string) =>
    s === "checking" ||
    s === "downloading" ||
    s === "installing" ||
    s === "verifying" ||
    s === "launching" ||
    s === "running";

  // Botón único: deja el pack COMPLETO (Minecraft + mods, texturas y
  // shaders) y lanza. Si no hay nada instalado, aquí se descarga todo.
  const handlePlay = async () => {
    if (!auth.activeAccount) return;
    if (!packs.activePackId) {
      setActiveTab("modpacks");
      return;
    }
    if (isBusyState(launch.launcherState)) return;

    setVerifyError(null);
    try {
      // 1. Minecraft + Fabric + Java del pack.
      await launch.fullSetup(packs.activePackId);
      if (!(await cmd.isMinecraftInstalled(packs.activePackId))) return;

      // 2. Contenido requerido pendiente (mods, configs, packs incluidos).
      const diff = await modpack.checkForUpdates();
      const pending =
        (diff?.modsToDownload.length ?? 0) +
        (diff?.configsToUpdate.length ?? 0) +
        (diff?.resourcePacksToUpdate ?? 0) +
        (diff?.shaderPacksToUpdate ?? 0);
      if (pending > 0) {
        launch.setLauncherState("downloading");
        modpack.clearError();
        await modpack.executeUpdate();
      }

      // 2b. Texturas/shaders opcionales que falten: Jugar = pack completo.
      await syncMissingOptionals();

      // 3. Verificación estricta: si falta ALGO (mods, texturas o shaders),
      // NO se lanza. El banner dice cuántos y dónde completarlos.
      const missing = await countMissingContent();
      if (missing > 0) {
        setVerifyError(t("play.incomplete", { count: missing }));
        launch.setLauncherState("needs_update");
        return;
      }

      // 4. Jugar.
      await launch.launch(packs.activePackId);
    } catch (e) {
      console.error(e);
    }
  };

  const error = auth.error || packs.error || modpack.error || launch.error || verifyError;
  const showProgress =
    launch.launcherState === "downloading" ||
    launch.launcherState === "installing" ||
    launch.launcherState === "verifying";

  const mods = modpack.manifest?.mods ?? [];
  const { icons: modIcons } = useProjectIcons(mods);

  const { icons: textureIcons } = useProjectIcons(allResourcePacks);
  const filteredResourcePacks = allResourcePacks.filter((rp) =>
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
    if (!bytes || bytes <= 0) return "—";
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
    const firstInstall = modpack.updateDiff?.isFullInstall ?? false;
    launch.setLauncherState("downloading");
    modpack.clearError();
    setVerifyError(null);
    try {
      await modpack.executeUpdate();
      if (firstInstall) {
        await syncMissingOptionals();
      }
      const diff = await modpack.checkForUpdates();
      const pending =
        (diff?.modsToDownload.length ?? 0) +
        (diff?.configsToUpdate.length ?? 0) +
        (diff?.resourcePacksToUpdate ?? 0) +
        (diff?.shaderPacksToUpdate ?? 0);
      launch.setLauncherState(pending > 0 ? "needs_update" : "ready");
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
            : activeTab === "modpacks"
            ? t("packs.title")
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
              className={`sidebar-nav-item ${activeTab === 'modpacks' ? 'active' : ''}`}
              onClick={() => setActiveTab('modpacks')}
              title={t("nav.modpacks")}
            >
              <FaBoxes size={20} />
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
            {activeTab === "play" || activeTab === "modpacks" ? (
              activeTab === "modpacks" ? (
                <div className="brand">
                  <div className="brand-text">
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                      {t("packs.listTitle")}
                    </h1>
                    <span className="version" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {t("packs.listSubtitle", { count: packs.packs.length })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="lunar-welcome">
                  <span className="lunar-welcome-text">{t("welcome.back")}</span>
                  <span className="lunar-welcome-user">
                    {auth.activeAccount?.username ?? t("welcome.player")}
                    {auth.activeAccount && <span className="lunar-status-dot" />}
                  </span>
                </div>
              )
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
                    ? t("textures.listSubtitle", { count: allResourcePacks.length })
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
                setVerifyError(null);
              }}
            />
          )}

          {hasPendingContent &&
            !modpack.isUpdating &&
            launch.launcherState !== "downloading" && (
              <StatusBanner
                type="info"
                message={t("banner.update", {
                  count: pendingContentCount,
                })}
              />
            )}

          {!packs.isLoading && !packs.activePackId && activeTab !== "modpacks" && (
            <StatusBanner
              type="info"
              message={t("banner.noPack")}
            />
          )}

          {/* Tab View Switcher */}
          {activeTab === "modpacks" && (
            <ModpacksPanel
              packs={packs.packs}
              activePackId={packs.activePackId}
              isLoading={packs.isLoading}
              selectingId={selectingPackId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleSelectPack}
            />
          )}

          {activeTab === "play" && (
            <PlayDashboard
              manifest={modpack.manifest}
              modsCount={mods.length}
              missingMods={modpack.updateDiff?.modsToDownload.length ?? 0}
              pendingContent={pendingContentCount}
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
              onOpenMods={() => setActiveTab("mods")}
              onOpenTextures={() => setActiveTab("textures")}
              onOpenShaders={() => setActiveTab("shaders")}
              texturesTotal={allResourcePacks.length}
              texturesMissing={allResourcePacks.filter((rp) => !installedTextures[rp.id]).length}
              shadersTotal={optionalShaderPacks.length}
              shadersMissing={optionalShaderPacks.filter((sp) => !installedShaders[sp.id]).length}
            />
          )}

          {(activeTab === "mods" || activeTab === "textures" || activeTab === "shaders") && packLabel && (
            <div className="pack-context-bar">
              <FaCube size={13} />
              <span className="pack-context-name">
                {t("catalog.packContent", {
                  name: packLabel.name,
                  version: packLabel.version,
                  mc: packLabel.mc,
                })}
              </span>
              {hasPendingContent && (
                <span className="pack-context-pending">
                  {t("catalog.pending", { count: pendingContentCount })}
                </span>
              )}
            </div>
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
              onInstallAllTextures={() => handleInstallAllOptional("resourcepack")}
              onInstallAllShaders={() => handleInstallAllOptional("shaderpack")}
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
          onVerifyAccount={auth.verifySession}
          verifyStatus={auth.verifyStatus}
        />
      )}
    </div>
  );
}
