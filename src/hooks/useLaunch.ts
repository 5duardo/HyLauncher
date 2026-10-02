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
      setLauncherState((prev) => {
        // Stay on the console page when the process ends (don't jump back to Play)
        if (
          newState === "ready" &&
          (prev === "running" || prev === "game_closed")
        ) {
          return prev === "running" ? "game_closed" : prev;
        }
        return newState as LauncherState;
      });
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

  // Poll while game is running — on exit, stay on console page
  useEffect(() => {
    if (launcherState === "running") {
      pollRef.current = setInterval(async () => {
        const running = await cmd.isGameRunning();
        if (!running) {
          setLauncherState("game_closed");
          await cmd.restoreWindow();
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 1000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [launcherState]);

  const launch = useCallback(async (packId?: string | null) => {
    setError(null);
    if (!packId) {
      setError("No hay ningún modpack seleccionado. Elige uno en la pestaña Modpacks.");
      setLauncherState("error");
      return;
    }
    setLauncherState("launching");
    try {
      await cmd.launchGame(packId);
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
      // Keep console visible after manual stop
      setLauncherState("game_closed");
      await cmd.restoreWindow();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsStoppingGame(false);
    }
  }, []);

  const leaveGameConsole = useCallback(() => {
    setLauncherState("ready");
  }, []);

  const fullSetup = useCallback(async (packId?: string | null) => {
    setError(null);

    try {
      // 1. Check Java (global, no depende del pack)
      setLauncherState("checking");
      const javaOk = await cmd.isJavaAvailable();
      if (!javaOk) {
        setLauncherState("installing");
        await cmd.installJava(packId ?? undefined);
      }

      // Sin pack seleccionado no hay nada que instalar.
      if (!packId) {
        setLauncherState("idle");
        return;
      }

      // 2. Check Minecraft (instancia del pack)
      const mcOk = await cmd.isMinecraftInstalled(packId);
      if (!mcOk) {
        setLauncherState("installing");
        await cmd.installMinecraft(packId);
      }

      // 3. Check modpack updates
      setLauncherState("checking");
      const diff = await cmd.checkForUpdates(packId);
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
    leaveGameConsole,
    fullSetup,
    clearError,
    setLauncherState,
  };
}
