// ============================================================
// HyLauncher — ProgressBar Component
// ============================================================

import type { ProgressEvent } from "../lib/types";

interface ProgressBarProps {
  progress: ProgressEvent | null;
  label: string;
  percent: number;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "";
  if (bytesPerSec > 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSec > 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${bytesPerSec} B/s`;
}

export function ProgressBar({ progress, label, percent }: ProgressBarProps) {
  if (!progress) return null;

  const speedStr = formatSpeed(progress.speed);
  const detail = progress.detail
    ? progress.detail.length > 40
      ? `...${progress.detail.slice(-37)}`
      : progress.detail
    : "";

  return (
    <div className="progress-section">
      <div className="progress-label">
        <span className="stage">{label}</span>
        <span className="percent">{percent}%</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>
      <div className="progress-detail">
        {detail}
        {speedStr && ` · ${speedStr}`}
        {progress.total > 0 &&
          ` · ${progress.current}/${progress.total}`}
      </div>
    </div>
  );
}
