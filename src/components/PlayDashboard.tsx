// ============================================================
// HyLauncher — Play Dashboard
// ============================================================

import {
  FaCheckCircle,
  FaCube,
  FaExclamationTriangle,
  FaGamepad,
  FaLayerGroup,
  FaMagic,
} from "react-icons/fa";
import { PlayButton } from "./PlayButton";
import { GameRunningPanel } from "./GameRunningPanel";
import { ProgressBar } from "./ProgressBar";
import { useI18n } from "../lib/i18n";
import type { LauncherState, PackManifest, ProgressEvent } from "../lib/types";

interface PlayDashboardProps {
  manifest: PackManifest | null;
  modsCount: number;
  missingMods: number;
  /** Mods + configs + texturas + shaders incluidos pendientes (todo el pack) */
  pendingContent: number;
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
  onLeaveGameConsole: () => void;
  onOpenMods: () => void;
  onOpenTextures: () => void;
  onOpenShaders: () => void;
  texturesTotal: number;
  texturesMissing: number;
  shadersTotal: number;
  shadersMissing: number;
}

export function PlayDashboard({
  manifest,
  modsCount,
  missingMods,
  pendingContent,
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
  onLeaveGameConsole,
  onOpenMods,
  onOpenTextures,
  onOpenShaders,
  texturesTotal,
  texturesMissing,
  shadersTotal,
  shadersMissing,
}: PlayDashboardProps) {
  const { t } = useI18n();
  const mc = manifest?.minecraft ?? "1.21.11";
  const fabric = manifest?.fabricLoader ?? "";
  const serverAddress = manifest?.server.address ?? "localhost";
  const serverPort = manifest?.server.port ?? 25565;
  const packName = manifest?.packName ?? "HYNILLA";
  const packVersion = manifest?.packVersion ?? "1.0";
  const packDesc =
    manifest?.packDescription ??
    "Modpack con rendimiento, visuales y calidad de vida.";
  const installedMods = Math.max(0, modsCount - missingMods);
  const installedTextures = Math.max(0, texturesTotal - texturesMissing);
  const installedShaders = Math.max(0, shadersTotal - shadersMissing);
  const javaMajor = manifest?.java?.version ?? 17;
  const syncOk = pendingContent === 0;

  if (launcherState === "running" || launcherState === "game_closed") {
    return (
      <div className="lunar-dashboard">
        <GameRunningPanel
          username={username}
          processAlive={launcherState === "running"}
          onStopGame={onStopGame}
          onBack={onLeaveGameConsole}
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
              <p className="hy-hero-kicker">
                {packName} · v{packVersion}
              </p>
              <h2 className="hy-hero-title">
                {hasAccount ? t("play.hello", { name: username }) : "HyLauncher"}
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
                  <FaCheckCircle size={11} /> {t("play.modsOk")}
                </>
              ) : (
                <>
                  <FaExclamationTriangle size={11} />{" "}
                  {t("play.pending", { count: pendingContent })}
                </>
              )}
            </span>
            {!hasAccount && (
              <span className="hy-pill hy-pill--warn">{t("play.noSession")}</span>
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
                ? t("play.loginToPlay")
                : pendingContent > 0
                  ? t("play.installModsFirst")
                  : `${serverAddress}:${serverPort}`
            }
          />
        </div>

      </section>

      <div className="hy-meta">
        <button type="button" className="hy-meta-item" onClick={onOpenMods}>
          <span className="hy-meta-icon">
            <FaCube size={18} />
          </span>
          <span className="hy-meta-label">{t("nav.mods")}</span>
          <span className="hy-meta-value">
            {installedMods}/{modsCount}
          </span>
          <span className="hy-meta-hint">
            {missingMods > 0
              ? t("play.toDownload", { count: missingMods })
              : t("play.synced")}
          </span>
        </button>

        <button type="button" className="hy-meta-item" onClick={onOpenTextures}>
          <span className="hy-meta-icon">
            <FaLayerGroup size={18} />
          </span>
          <span className="hy-meta-label">{t("nav.textures")}</span>
          <span className="hy-meta-value">
            {installedTextures}/{texturesTotal}
          </span>
          <span className="hy-meta-hint">
            {texturesMissing > 0
              ? t("play.toDownload", { count: texturesMissing })
              : t("play.synced")}
          </span>
        </button>

        <button type="button" className="hy-meta-item" onClick={onOpenShaders}>
          <span className="hy-meta-icon">
            <FaMagic size={18} />
          </span>
          <span className="hy-meta-label">{t("nav.shaders")}</span>
          <span className="hy-meta-value">
            {installedShaders}/{shadersTotal}
          </span>
          <span className="hy-meta-hint">
            {shadersMissing > 0
              ? t("play.toDownload", { count: shadersMissing })
              : t("play.synced")}
          </span>
        </button>

        <div className="hy-meta-item">
          <span className="hy-meta-icon">
            <FaGamepad size={18} />
          </span>
          <span className="hy-meta-label">{t("play.client")}</span>
          <span className="hy-meta-value">{mc}</span>
          <span className="hy-meta-hint">
            Fabric {fabric || "—"} · Java {javaMajor}
          </span>
        </div>

        <div className="hy-meta-item">
          <span className="hy-meta-icon">
            <img src="/logo.png" alt="" />
          </span>
          <span className="hy-meta-label">{t("play.pack")}</span>
          <span className="hy-meta-value">{packVersion}</span>
          <span className="hy-meta-hint">{packName}</span>
        </div>
      </div>
    </div>
  );
}
