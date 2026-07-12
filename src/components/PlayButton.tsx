// ============================================================
// HyLauncher — PlayButton Component
// ============================================================

import { useI18n } from "../lib/i18n";
import type { LauncherState } from "../lib/types";

interface PlayButtonProps {
  state: LauncherState;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "lunar";
  subtitle?: string;
}

export function PlayButton({
  state,
  onClick,
  disabled,
  variant = "default",
  subtitle,
}: PlayButtonProps) {
  const { t } = useI18n();

  const config: Record<
    LauncherState,
    { label: string; showSpinner: boolean; className: string }
  > = {
    idle: { label: t("btn.launch"), showSpinner: false, className: "" },
    checking: {
      label: t("btn.checking"),
      showSpinner: true,
      className: "play-button--installing",
    },
    needs_install: { label: t("btn.installPlay"), showSpinner: false, className: "" },
    needs_update: {
      label: t("btn.installMods"),
      showSpinner: false,
      className: "play-button--warning",
    },
    downloading: {
      label: t("btn.downloading"),
      showSpinner: true,
      className: "play-button--installing",
    },
    installing: {
      label: t("btn.installing"),
      showSpinner: true,
      className: "play-button--installing",
    },
    verifying: {
      label: t("btn.verifying"),
      showSpinner: true,
      className: "play-button--installing",
    },
    ready: { label: t("btn.launch"), showSpinner: false, className: "" },
    launching: {
      label: t("btn.launching"),
      showSpinner: true,
      className: "play-button--installing",
    },
    running: {
      label: t("btn.playing"),
      showSpinner: false,
      className: "play-button--installing",
    },
    error: { label: t("btn.retry"), showSpinner: false, className: "play-button--error" },
  };

  const button = config[state];
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
        className={`play-button ${isLunar ? "play-button--lunar" : ""} ${button.className}`}
        onClick={onClick}
        disabled={isDisabled}
        id="play-button"
      >
        <span className={`btn-content ${isLunar ? "btn-content--lunar" : ""}`}>
          {button.showSpinner && <span className="spinner" />}
          <span className="btn-label-group">
            <span className="btn-label-main">{button.label}</span>
            {isLunar && subtitle && (
              <span className="btn-label-sub">{subtitle}</span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
