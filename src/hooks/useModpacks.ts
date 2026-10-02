// ============================================================
// HyLauncher — useModpacks Hook (selección de modpack)
// ============================================================
//
// Carga el índice de modpacks (`modpacks.json`) y el pack activo.
// Si el usuario aún no eligió ninguno, `activePack` es null y el
// launcher no descarga nada por defecto: hay que elegir un modpack
// (nunca se instalan todos los mods/recursos en un solo listado).

import { useCallback, useEffect, useState } from "react";
import type { ModpackSummary } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

export function useModpacks() {
  const [packs, setPacks] = useState<ModpackSummary[]>([]);
  const [activePack, setActivePackState] = useState<ModpackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, active] = await Promise.all([
        cmd.getModpacks(),
        cmd.getActivePack(),
      ]);
      setPacks(list);
      setActivePackState(active);
      setError(null);
      return active;
    } catch (e) {
      console.error("Failed to load modpacks:", e);
      setError(String(e));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Elige un modpack. Devuelve el pack activo, o null si el id no existe. */
  const selectPack = useCallback(
    async (packId: string) => {
      try {
        const pack = await cmd.setActivePack(packId);
        setActivePackState(pack);
        setError(null);
        return pack;
      } catch (e) {
        console.error("Failed to select modpack:", e);
        setError(String(e));
        return null;
      }
    },
    []
  );

  return {
    packs,
    activePack,
    activePackId: activePack?.id ?? null,
    isLoading,
    error,
    refresh,
    selectPack,
  };
}