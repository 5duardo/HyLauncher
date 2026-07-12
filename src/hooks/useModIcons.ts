// ============================================================
// HyLauncher — useModIcons Hook
// ============================================================

import { useState, useEffect, useMemo } from "react";
import type { ModEntry } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

export function useModIcons(mods: ModEntry[]) {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const modKey = useMemo(
    () => mods.map((m) => `${m.id}:${m.url}`).join("|"),
    [mods]
  );

  useEffect(() => {
    if (mods.length === 0) return;

    let cancelled = false;
    setIsLoading(true);

    cmd
      .getModIcons(mods.map((m) => ({ id: m.id, url: m.url })))
      .then((result) => {
        if (!cancelled) setIcons(result);
      })
      .catch((err) => {
        console.error("Failed to load mod icons:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modKey]);

  return { icons, isLoading };
}
