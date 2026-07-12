// ============================================================
// HyLauncher — Play Dashboard
// ============================================================

import {
  FaCheckCircle,
  FaCog,
  FaCube,
  FaExclamationTriangle,
  FaGamepad,
  FaServer,
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
  onOpenSettings: () => void;
  onOpenMods: () => void;
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
  onLeaveGameConsole,
  onOpenSettings,
  onOpenMods,
}: PlayDashboardProps) {
  const { t } = useI18n();
  const mc = manifest?.minecraft ?? "1.20.1";
  const fabric = manifest?.fabricLoader ?? "";
  const serverName = manifest?.server.name ?? "Minecraft";
  const serverAddress = manifest?.server.address ?? "localhost";
  const serverPort = manifest?.server.port ?? 25565;
  const packName = manifest?.packName ?? "HyPack";
  const packVersion = manifest?.packVersion ?? "1.0";
  const packDesc =
    manifest?.packDescription ??
    "Modpack con rendimiento, visuales y calidad de vida.";
  const autoConnect = manifest?.server.autoConnect ?? false;
  const installedMods = Math.max(0, modsCount - missingMods);
  const syncOk = missingMods === 0;

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
                  {t("play.pending", { count: missingMods })}
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
                : missingMods > 0
                  ? t("play.installModsFirst")
                  : `${serverAddress}:${serverPort}`
            }
          />
        </div>

        <button
          type="button"
          className="hy-hero-settings"
          onClick={onOpenSettings}
          title={t("nav.settings")}
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
              {autoConnect ? t("play.autoConnect") : ""}
            </span>
          </div>
        </div>
        {missingMods > 0 ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={onOpenMods}>
            {t("play.goToMods")}
          </button>
        ) : (
          <span className="hy-server-live">{t("play.ready")}</span>
        )}
      </div>

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

        <div className="hy-meta-item">
          <span className="hy-meta-icon">
            <FaGamepad size={18} />
          </span>
          <span className="hy-meta-label">{t("play.client")}</span>
          <span className="hy-meta-value">{mc}</span>
          <span className="hy-meta-hint">
            Fabric {fabric || "—"} · Java 17
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
