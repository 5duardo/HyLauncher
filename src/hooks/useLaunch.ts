// ============================================================
// HyLauncher — useLaunch Hook
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import type { LauncherState } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

export function useLaunch() {
  const [launcherState, setLauncherState] = useState<LauncherState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isStoppingGame, setIsStoppingGame] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for state changes from backend
  useEffect(() => {
    const unlisten = cmd.onStateChange((newState) => {
      setLauncherState(newState as LauncherState);
    });

    const unlistenErr = cmd.onError((err) => {
      setError(err);
      setLauncherState("error");
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenErr.then((fn) => fn());
    };
  }, []);

  // Poll for game running status
  useEffect(() => {
    if (launcherState === "running") {
      pollRef.current = setInterval(async () => {
        const running = await cmd.isGameRunning();
        if (!running) {
          setLauncherState("ready");
          await cmd.restoreWindow();
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [launcherState]);

  const launch = useCallback(async () => {
    setError(null);
    setLauncherState("launching");
    try {
      await cmd.launchGame();
      setLauncherState("running");
    } catch (err) {
      setError(String(err));
      setLauncherState("error");
    }
  }, []);

  const stopGame = useCallback(async () => {
    setIsStoppingGame(true);
    setError(null);
    try {
      await cmd.stopGame();
      setLauncherState("ready");
      await cmd.restoreWindow();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsStoppingGame(false);
    }
  }, []);

  const fullSetup = useCallback(async () => {
    setError(null);

    try {
      // 1. Check Java
      setLauncherState("checking");
      const javaOk = await cmd.isJavaAvailable();
      if (!javaOk) {
        setLauncherState("installing");
        await cmd.installJava();
      }

      // 2. Check Minecraft
      const mcOk = await cmd.isMinecraftInstalled();
      if (!mcOk) {
        setLauncherState("installing");
        await cmd.installMinecraft();
      }

      // 3. Check modpack updates
      setLauncherState("checking");
      const diff = await cmd.checkForUpdates();
      if (diff && diff.modsToDownload.length > 0) {
        setLauncherState("needs_update");
      } else {
        setLauncherState("ready");
      }
    } catch (err) {
      setError(String(err));
      setLauncherState("error");
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setLauncherState("ready");
  }, []);

  return {
    launcherState,
    error,
    isStoppingGame,
    launch,
    stopGame,
    fullSetup,
    clearError,
    setLauncherState,
  };
}
