// ============================================================
// HyLauncher — PlayButton Component
// ============================================================

import type { LauncherState } from "../lib/types";

interface PlayButtonProps {
  state: LauncherState;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "lunar";
  subtitle?: string;
}

const BUTTON_CONFIG: Record<
  LauncherState,
  { label: string; showSpinner: boolean; className: string }
> = {
  idle: { label: "LANZAR JUEGO", showSpinner: false, className: "" },
  checking: { label: "VERIFICANDO...", showSpinner: true, className: "play-button--installing" },
  needs_install: { label: "INSTALAR Y JUGAR", showSpinner: false, className: "" },
  needs_update: { label: "INSTALAR MODS", showSpinner: false, className: "play-button--warning" },
  downloading: { label: "DESCARGANDO...", showSpinner: true, className: "play-button--installing" },
  installing: { label: "INSTALANDO...", showSpinner: true, className: "play-button--installing" },
  verifying: { label: "VERIFICANDO...", showSpinner: true, className: "play-button--installing" },
  ready: { label: "LANZAR JUEGO", showSpinner: false, className: "" },
  launching: { label: "LANZANDO...", showSpinner: true, className: "play-button--installing" },
  running: { label: "JUGANDO", showSpinner: false, className: "play-button--installing" },
  error: { label: "REINTENTAR", showSpinner: false, className: "play-button--error" },
};

export function PlayButton({
  state,
  onClick,
  disabled,
  variant = "default",
  subtitle,
}: PlayButtonProps) {
  const config = BUTTON_CONFIG[state];
  const isDisabled =
    disabled ||
    state === "downloading" ||
    state === "installing" ||
    state === "verifying" ||
    state === "launching" ||
    state === "running" ||
    state === "checking";

  const isLunar = variant === "lunar";

  return (
    <div className={`play-button-wrapper ${isLunar ? "play-button-wrapper--lunar" : ""}`}>
      {isLunar && <div className="play-glow play-glow--lunar" />}
      {!isLunar && <div className="play-glow" />}
      <button
        className={`play-button ${isLunar ? "play-button--lunar" : ""} ${config.className}`}
        onClick={onClick}
        disabled={isDisabled}
        id="play-button"
      >
        <span className={`btn-content ${isLunar ? "btn-content--lunar" : ""}`}>
          {config.showSpinner && <span className="spinner" />}
          <span className="btn-label-group">
            <span className="btn-label-main">{config.label}</span>
            {isLunar && subtitle && (
              <span className="btn-label-sub">{subtitle}</span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
