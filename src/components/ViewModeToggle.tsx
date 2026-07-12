// ============================================================
// HyLauncher — List / Grid view toggle
// ============================================================

import { FaList, FaTh } from "react-icons/fa";

export type CatalogViewMode = "list" | "grid";

interface ViewModeToggleProps {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  listLabel: string;
  gridLabel: string;
}

export function ViewModeToggle({
  value,
  onChange,
  listLabel,
  gridLabel,
}: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="Vista">
      <button
        type="button"
        className={`view-mode-btn ${value === "list" ? "active" : ""}`}
        onClick={() => onChange("list")}
        title={listLabel}
        aria-pressed={value === "list"}
      >
        <FaList size={13} />
      </button>
      <button
        type="button"
        className={`view-mode-btn ${value === "grid" ? "active" : ""}`}
        onClick={() => onChange("grid")}
        title={gridLabel}
        aria-pressed={value === "grid"}
      >
        <FaTh size={13} />
      </button>
    </div>
  );
}
