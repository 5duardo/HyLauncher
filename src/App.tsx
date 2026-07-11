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

export default function App() {
  const auth = useAuth();
  const modpack = useModpack();
  const launch = useLaunch();
  const [showSettings, setShowSettings] = useState(false);

  // On mount: check for updates and setup state
  useEffect(() => {
    if (!auth.isLoading && auth.activeAccount) {
      launch.fullSetup();
    }
  }, [auth.isLoading, auth.activeAccount?.id]);

  const handlePlay = async () => {
    if (!auth.activeAccount) return;

    if (
      launch.launcherState === "error" ||
      launch.launcherState === "idle" ||
      launch.launcherState === "needs_install" ||
      launch.launcherState === "needs_update"
    ) {
      await launch.fullSetup();
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

  return (
    <div className="app-container">
      <Background />

      {/* Custom Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">HyLauncher</span>
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

      {/* Main Content */}
      <div className="main-content">
        {/* Header: Brand + Account */}
        <header className="header">
          <div className="brand">
            <div className="brand-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="white" />
              </svg>
            </div>
            <div className="brand-text">
              <h1>HyLauncher</h1>
              <span className="version">
                v1.0.0 · {modpack.manifest?.packName ?? "HyPack"}
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
          !modpack.isUpdating &&
          launch.launcherState !== "downloading" && (
            <StatusBanner
              type="info"
              message={`Actualización disponible: ${modpack.updateDiff.modsToDownload.length} mods por descargar`}
            />
          )}

        {/* Center: Server Info + Play Button */}
        <div className="center-area">
          <div className="server-info">
            <h2>{modpack.manifest?.server.name ?? "HyServer"}</h2>
            <p>
              {modpack.manifest?.packDescription ??
                "Modpack oficial del servidor"}
            </p>
            <div className="server-meta">
              <span className="meta-chip">
                <span className="dot" />
                Minecraft {modpack.manifest?.minecraft ?? "1.20.1"}
              </span>
              <span className="meta-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-cyan)' }}>
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Fabric {modpack.manifest?.fabricLoader ?? ""}
              </span>
              <span className="meta-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-accent-hover)' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                {modpack.manifest?.mods.length ?? 0} mods
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
            disabled={!auth.activeAccount}
          />

          {!auth.activeAccount && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginTop: "-8px",
              }}
            >
              Inicia sesión para jugar
            </p>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="bottom-bar">
          <div className="status-indicator">
            {launch.launcherState === "running" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-accent-hover)' }}>
                  <line x1="6" y1="12" x2="10" y2="12" />
                  <line x1="8" y1="10" x2="8" y2="14" />
                  <line x1="15" y1="13" x2="15.01" y2="13" />
                  <line x1="18" y1="11" x2="18.01" y2="11" />
                  <rect x="2" y="6" width="20" height="12" rx="3" />
                </svg>
                <span>Minecraft está en ejecución</span>
              </>
            ) : launch.launcherState === "ready" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-success)' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Listo para jugar</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--color-text-muted)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>
                  {launch.launcherState === "idle"
                    ? "Esperando..."
                    : launch.launcherState === "checking"
                    ? "Verificando..."
                    : launch.launcherState === "downloading"
                    ? "Descargando..."
                    : launch.launcherState === "installing"
                    ? "Instalando..."
                    : launch.launcherState}
                </span>
              </>
            )}
          </div>

          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Ajustes
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
