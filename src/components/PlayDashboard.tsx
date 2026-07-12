// ============================================================
// HyLauncher — Play Dashboard
// ============================================================

import {
  FaCheckCircle,
  FaCog,
  FaCube,
  FaExclamationTriangle,
  FaGamepad,
  FaLayerGroup,
  FaMagic,
  FaServer,
} from "react-icons/fa";
import { PlayButton } from "./PlayButton";
import { GameRunningPanel } from "./GameRunningPanel";
import { ProgressBar } from "./ProgressBar";
import type { LauncherState, PackManifest, ProgressEvent } from "../lib/types";

interface PlayDashboardProps {
  manifest: PackManifest | null;
  modsCount: number;
  missingMods: number;
  launcherState: LauncherState;
  username: string;
  showProgress: boolean;
  progress: ProgressEvent | null;
  progressLabel: string;
  progressPercent: number;
  hasAccount: boolean;
  isStoppingGame: boolean;
  onPlay: () => void;
  onStopGame: () => void;
  onOpenSettings: () => void;
  onOpenMods: () => void;
  onOpenTextures?: () => void;
  onOpenShaders?: () => void;
}

export function PlayDashboard({
  manifest,
  modsCount,
  missingMods,
  launcherState,
  username,
  showProgress,
  progress,
  progressLabel,
  progressPercent,
  hasAccount,
  isStoppingGame,
  onPlay,
  onStopGame,
  onOpenSettings,
  onOpenMods,
  onOpenTextures,
  onOpenShaders,
}: PlayDashboardProps) {
  const mc = manifest?.minecraft ?? "1.20.1";
  const fabric = manifest?.fabricLoader ?? "";
  const serverName = manifest?.server.name ?? "HyServer";
  const serverAddress = manifest?.server.address ?? "localhost";
  const serverPort = manifest?.server.port ?? 25565;
  const packName = manifest?.packName ?? "HyPack";
  const packVersion = manifest?.packVersion ?? "1.0";
  const packDesc =
    manifest?.packDescription ??
    "Modpack del servidor con rendimiento, visuales y calidad de vida.";
  const autoConnect = manifest?.server.autoConnect ?? true;
  const installedMods = Math.max(0, modsCount - missingMods);
  const syncOk = missingMods === 0;

  if (launcherState === "running") {
    return (
      <div className="lunar-dashboard">
        <GameRunningPanel
          username={username}
          serverName={serverName}
          onStopGame={onStopGame}
          isStopping={isStoppingGame}
        />
      </div>
    );
  }

  return (
    <div className="lunar-dashboard">
      <section className="hy-hero">
        <div className="hy-hero-copy">
          <div className="hy-hero-brand">
            <img src="/logo.png" alt="" className="hy-hero-logo" />
            <div>
              <p className="hy-hero-kicker">{packName} · v{packVersion}</p>
              <h2 className="hy-hero-title">
                {hasAccount ? `Hola, ${username}` : "HyLauncher"}
              </h2>
            </div>
          </div>

          <p className="hy-hero-desc">{packDesc}</p>

          <div className="hy-hero-pills">
            <span className="hy-pill">MC {mc}</span>
            {fabric && <span className="hy-pill">Fabric {fabric}</span>}
            <span className={`hy-pill ${syncOk ? "hy-pill--ok" : "hy-pill--warn"}`}>
              {syncOk ? (
                <>
                  <FaCheckCircle size={11} /> Mods OK
                </>
              ) : (
                <>
                  <FaExclamationTriangle size={11} /> {missingMods} pendientes
                </>
              )}
            </span>
            {!hasAccount && (
              <span className="hy-pill hy-pill--warn">Sin sesión</span>
            )}
          </div>
        </div>

        <div className="hy-hero-action">
          {showProgress && (
            <div className="lunar-hero-progress">
              <ProgressBar progress={progress} label={progressLabel} percent={progressPercent} />
            </div>
          )}

          <PlayButton
            variant="lunar"
            state={launcherState}
            onClick={onPlay}
            disabled={
              !hasAccount ||
              (launcherState !== "ready" && launcherState !== "needs_update")
            }
            subtitle={
              !hasAccount
                ? "Inicia sesión para jugar"
                : missingMods > 0
                  ? "Instalar mods primero"
                  : `${serverAddress}:${serverPort}`
            }
          />
        </div>

        <button
          type="button"
          className="hy-hero-settings"
          onClick={onOpenSettings}
          title="Ajustes"
        >
          <FaCog size={16} />
        </button>
      </section>

      <div className="hy-server-bar">
        <div className="hy-server-mark">
          <div className="hy-server-icon">
            <FaServer size={16} />
          </div>
          <div>
            <span className="hy-server-name">{serverName}</span>
            <span className="hy-server-addr">
              {serverAddress}:{serverPort}
              {autoConnect ? " · conexión automática al lanzar" : ""}
            </span>
          </div>
        </div>
        {missingMods > 0 ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={onOpenMods}>
            Ir a mods
          </button>
        ) : (
          <span className="hy-server-live">Listo</span>
        )}
      </div>

      <div className="hy-meta">
        <button type="button" className="hy-meta-item" onClick={onOpenMods}>
          <span className="hy-meta-icon">
            <FaCube size={18} />
          </span>
          <span className="hy-meta-label">Mods</span>
          <span className="hy-meta-value">
            {installedMods}/{modsCount}
          </span>
          <span className="hy-meta-hint">
            {missingMods > 0
              ? `${missingMods} por descargar`
              : "Todo sincronizado"}
          </span>
        </button>

        <div className="hy-meta-item">
          <span className="hy-meta-icon">
            <FaGamepad size={18} />
          </span>
          <span className="hy-meta-label">Cliente</span>
          <span className="hy-meta-value">{mc}</span>
          <span className="hy-meta-hint">
            Fabric {fabric || "—"} · Java 17
          </span>
        </div>

        <div className="hy-meta-item">
          <span className="hy-meta-icon">
            <img src="/logo.png" alt="" />
          </span>
          <span className="hy-meta-label">Pack</span>
          <span className="hy-meta-value">{packVersion}</span>
          <span className="hy-meta-hint">{packName}</span>
        </div>
      </div>

      <div className="hy-quick">
        <p className="hy-quick-title">Accesos</p>
        <div className="hy-quick-grid">
          <button type="button" className="hy-quick-btn" onClick={onOpenMods}>
            <FaCube size={16} />
            <span>
              <strong>Mods</strong>
              <em>Ver lista e instalar</em>
            </span>
          </button>
          <button
            type="button"
            className="hy-quick-btn"
            onClick={onOpenTextures}
            disabled={!onOpenTextures}
          >
            <FaLayerGroup size={16} />
            <span>
              <strong>Texturas</strong>
              <em>Packs opcionales</em>
            </span>
          </button>
          <button
            type="button"
            className="hy-quick-btn"
            onClick={onOpenShaders}
            disabled={!onOpenShaders}
          >
            <FaMagic size={16} />
            <span>
              <strong>Shaders</strong>
              <em>Efectos visuales</em>
            </span>
          </button>
          <button type="button" className="hy-quick-btn" onClick={onOpenSettings}>
            <FaCog size={16} />
            <span>
              <strong>Ajustes</strong>
              <em>RAM, Java e idioma</em>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
