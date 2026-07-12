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
  return (
    <div className="hy-running">
      <header className="hy-running-header">
        <div className="hy-running-live">
          <span className="hy-running-dot" />
          En juego
        </div>
        <div>
          <h2 className="hy-running-title">Minecraft está abierto</h2>
          <p className="hy-running-lead">
            El launcher quedó minimizado. Puedes volver aquí cuando quieras o
            cerrar el proceso de Minecraft.
          </p>
        </div>
      </header>

      <div className="hy-running-grid">
        <section className="hy-running-card">
          <p className="hy-running-card-label">Sesión</p>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaUser size={14} />
            </span>
            <div>
              <strong>{username}</strong>
              <em>Jugador activo</em>
            </div>
          </div>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaServer size={14} />
            </span>
            <div>
              <strong>{serverName}</strong>
              <em>Servidor del pack</em>
            </div>
          </div>
          <div className="hy-running-row">
            <span className="hy-running-row-icon">
              <FaDesktop size={14} />
            </span>
            <div>
              <strong>Ventana de juego</strong>
              <em>Proceso de Minecraft en segundo plano</em>
            </div>
          </div>
        </section>

        <section className="hy-running-card hy-running-card--actions">
          <p className="hy-running-card-label">Controles</p>

          <button
            type="button"
            className="btn btn--danger btn--bar"
            onClick={onStopGame}
            disabled={isStopping}
          >
            {isStopping ? (
              <>
                <span className="spinner" />
                Cerrando...
              </>
            ) : (
              <>
                <FaStop size={14} />
                Cerrar juego
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
            Abrir launcher
          </button>

          <p className="hy-running-note">
            Cerrar juego finaliza el proceso de Minecraft. Abrir launcher solo
            restaura esta ventana.
          </p>
        </section>
      </div>
    </div>
  );
}
