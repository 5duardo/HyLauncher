// ============================================================
// HyLauncher — Mod Icon Component
// ============================================================

import { useState, useEffect } from "react";

interface ModIconProps {
  modId: string;
  iconUrl?: string;
  size?: number;
}

function getInitials(modId: string) {
  return modId
    .split("-")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function ModIcon({ modId, iconUrl, size = 30 }: ModIconProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [iconUrl]);

  const initials = getInitials(modId);
  const showImage = iconUrl && !failed;

  return (
    <div
      className={`mod-row-icon ${showImage ? "mod-row-icon--image" : "mod-row-icon--placeholder"}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img src={iconUrl} alt={modId} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="mod-row-icon-fallback">{initials}</span>
      )}
    </div>
  );
}
