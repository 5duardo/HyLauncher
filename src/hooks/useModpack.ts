// ============================================================
// HyLauncher — useModpack Hook
// ============================================================
//
// Todo el estado del modpack está ligado a un pack concreto: si no
// hay pack seleccionado (`activePackId === null`) no se consulta ni
// se descarga nada.

import { useState, useEffect, useCallback } from "react";
import type { ProgressEvent, UpdateDiff, PackManifest } from "../lib/types";
import { STAGE_LABELS } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

interface ModpackState {
  manifest: PackManifest | null;
  updateDiff: UpdateDiff | null;
  isChecking: boolean;
  isUpdating: boolean;
  progress: ProgressEvent | null;
  progressLabel: string;
  error: string | null;
}

export function useModpack(activePackId: string | null) {
  const [state, setState] = useState<ModpackState>({
    manifest: null,
    updateDiff: null,
    isChecking: false,
    isUpdating: false,
    progress: null,
    progressLabel: "",
    error: null,
  });

  // Listen to progress events
  useEffect(() => {
    const unlisten = cmd.onProgress((event) => {
      setState((s) => ({
        ...s,
        progress: event,
        progressLabel: STAGE_LABELS[event.stage] ?? event.stage,
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Al cambiar de modpack, olvida el estado del pack anterior.
  useEffect(() => {
    setState((s) => ({
      ...s,
      manifest: null,
      updateDiff: null,
      error: null,
      progress: null,
    }));
  }, [activePackId]);

  const checkForUpdates = useCallback(async () => {
    if (!activePackId) return null;

    setState((s) => ({ ...s, isChecking: true, error: null }));

    // 1. Try to load local manifest first so we have it immediately
    let manifest = null;
    try {
      manifest = await cmd.getLocalManifest(activePackId);
    } catch (e) {
      console.error("Failed to load local manifest:", e);
    }

    // 2. Check for updates from the remote server
    let diff = null;
    let updateError = null;
    try {
      diff = await cmd.checkForUpdates(activePackId);
      // Fetch manifest again from the backend's memory cache that checkForUpdates populated
      manifest = await cmd.getLocalManifest(activePackId);
    } catch (e) {
      console.error("Failed to check for updates:", e);
      updateError = String(e);
    }

    // 3. Update state with whatever was resolved
    setState((s) => ({
      ...s,
      updateDiff: diff,
      manifest: manifest || s.manifest,
      isChecking: false,
      error: updateError,
    }));

    return diff;
  }, [activePackId]);

  const executeUpdate = useCallback(async () => {
    if (!activePackId) return;
    setState((s) => ({ ...s, isUpdating: true, error: null, progress: null }));
    try {
      await cmd.executeUpdate(activePackId);
      const manifest = await cmd.getLocalManifest(activePackId);
      setState((s) => ({
        ...s,
        manifest,
        updateDiff: null,
        isUpdating: false,
        progress: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isUpdating: false,
      }));
    }
  }, [activePackId]);

  const reinstallMods = useCallback(async () => {
    if (!activePackId) return;
    setState((s) => ({ ...s, isUpdating: true, error: null, progress: null }));
    try {
      await cmd.reinstallMods(activePackId);
      const manifest = await cmd.getLocalManifest(activePackId);
      const diff = await cmd.checkForUpdates(activePackId);
      setState((s) => ({
        ...s,
        manifest,
        updateDiff: diff,
        isUpdating: false,
        progress: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isUpdating: false,
      }));
      throw err;
    }
  }, [activePackId]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const progressPercent =
    state.progress && state.progress.total > 0
      ? Math.round((state.progress.current / state.progress.total) * 100)
      : 0;

  return {
    ...state,
    progressPercent,
    checkForUpdates,
    executeUpdate,
    reinstallMods,
    clearError,
  };
}