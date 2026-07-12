// ============================================================
// HyLauncher — Project icons (mods / packs from Modrinth)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import * as cmd from "../lib/tauri-commands";

export function useProjectIcons(items: { id: string; url: string }[]) {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const key = useMemo(
    () => items.map((m) => `${m.id}:${m.url}`).join("|"),
    [items]
  );

  useEffect(() => {
    if (items.length === 0) {
      setIcons({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    cmd
      .getModIcons(items.map((m) => ({ id: m.id, url: m.url })))
      .then((result) => {
        if (!cancelled) setIcons(result);
      })
      .catch((err) => {
        console.error("Failed to load icons:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { icons, isLoading };
}
