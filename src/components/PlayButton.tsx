// ============================================================
// HyLauncher — PlayButton Component
// ============================================================

import type { LauncherState } from "../lib/types";

interface PlayButtonProps {
  state: LauncherState;
  onClick: () => void;
  disabled?: boolean;
}

const BUTTON_CONFIG: Record<
  LauncherState,
  { label: string; showSpinner: boolean; className: string }
> = {
  idle: { label: "Jugar", showSpinner: false, className: "" },
  checking: { label: "Verificando...", showSpinner: true, className: "play-button--installing" },
  needs_install: { label: "Instalar y Jugar", showSpinner: false, className: "" },
  needs_update: { label: "Actualizar y Jugar", showSpinner: false, className: "" },
  downloading: { label: "Descargando...", showSpinner: true, className: "play-button--installing" },
  installing: { label: "Instalando...", showSpinner: true, className: "play-button--installing" },
  verifying: { label: "Verificando...", showSpinner: true, className: "play-button--installing" },
  ready: { label: "Jugar", showSpinner: false, className: "" },
  launching: { label: "Lanzando...", showSpinner: true, className: "play-button--installing" },
  running: { label: "Jugando", showSpinner: false, className: "play-button--installing" },
  error: { label: "Reintentar", showSpinner: false, className: "play-button--error" },
};

export function PlayButton({ state, onClick, disabled }: PlayButtonProps) {
  const config = BUTTON_CONFIG[state];
  const isDisabled =
    disabled ||
    state === "downloading" ||
    state === "installing" ||
    state === "verifying" ||
    state === "launching" ||
    state === "running" ||
    state === "checking";

  return (
    <div className="play-button-wrapper">
      <div className="play-glow" />
      <button
        className={`play-button ${config.className}`}
        onClick={onClick}
        disabled={isDisabled}
        id="play-button"
      >
        <span className="btn-content">
          {config.showSpinner && <span className="spinner" />}
          {config.label}
        </span>
      </button>
    </div>
  );
}
