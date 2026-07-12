// ============================================================
// HyLauncher — Game Running Panel
// ============================================================

import {
  FaDesktop,
  FaExternalLinkAlt,
  FaServer,
  FaStop,
  FaUser,
} from "react-icons/fa";
import { useI18n } from "../lib/i18n";
import * as cmd from "../lib/tauri-commands";

interface GameRunningPanelProps {
  username: string;
  serverName: string;
  onStopGame: () => void;
  isStopping?: boolean;
}

export function GameRunningPanel({
  username,
  serverName,
  onStopGame,
  isStopping = false,
}: GameRunningPanelProps) {
  const { t } = useI18n();

  return (
    <div className="hy-running">
      <header className="hy-running-header">
        <div className="hy-running-live">
          <span className="hy-running-dot" />
          {t("running.live")}
        </div>
        <div>
          <h2 className="hy-running-title">{t("running.title")}</h2>
          <p className="hy-running-lead">{t("running.lead")}</p>
        </div>
      </header>

      <div className="hy-running-grid">
        <section className="hy-running-card">
          <p className="hy-running-card-label">{t("running.session")}</p>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaUser size={14} />
            </span>
            <div>
              <strong>{username}</strong>
              <em>{t("running.activePlayer")}</em>
            </div>
          </div>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaServer size={14} />
            </span>
            <div>
              <strong>{serverName}</strong>
              <em>{t("running.packServer")}</em>
            </div>
          </div>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaDesktop size={14} />
            </span>
            <div>
              <strong>{t("running.gameWindow")}</strong>
              <em>{t("running.gameBg")}</em>
            </div>
          </div>
        </section>

        <section className="hy-running-card hy-running-card--actions">
          <p className="hy-running-card-label">{t("running.controls")}</p>

          <button
            type="button"
            className="btn btn--danger btn--bar"
            onClick={onStopGame}
            disabled={isStopping}
          >
            {isStopping ? (
              <>
                <span className="spinner" />
                {t("running.stopping")}
              </>
            ) : (
              <>
                <FaStop size={14} />
                {t("running.stop")}
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--bar"
            onClick={() => cmd.restoreWindow()}
            disabled={isStopping}
          >
            <FaExternalLinkAlt size={13} />
            {t("running.openLauncher")}
          </button>

          <p className="hy-running-note">{t("running.note")}</p>
        </section>
      </div>
    </div>
  );
}
