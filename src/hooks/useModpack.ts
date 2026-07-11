// ============================================================
// HyLauncher — useModpack Hook
// ============================================================

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

export function useModpack() {
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

  const checkForUpdates = useCallback(async () => {
    setState((s) => ({ ...s, isChecking: true, error: null }));
    try {
      const [diff, manifest] = await Promise.all([
        cmd.checkForUpdates(),
        cmd.getLocalManifest(),
      ]);
      setState((s) => ({
        ...s,
        updateDiff: diff,
        manifest,
        isChecking: false,
      }));
      return diff;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isChecking: false,
      }));
      return null;
    }
  }, []);

  const executeUpdate = useCallback(async () => {
    setState((s) => ({ ...s, isUpdating: true, error: null, progress: null }));
    try {
      await cmd.executeUpdate();
      const manifest = await cmd.getLocalManifest();
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
  }, []);

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
    clearError,
  };
}
