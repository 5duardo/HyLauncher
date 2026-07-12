// ============================================================
// HyLauncher — Discord Rich Presence hook
// ============================================================

import { useEffect, useRef } from "react";
import type { LauncherState } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

interface UseDiscordPresenceOptions {
  launcherState: LauncherState;
  username?: string | null;
  serverName?: string;
  language: string;
}

export function useDiscordPresence({
  launcherState,
  username,
  serverName = "HyServer",
  language,
}: UseDiscordPresenceOptions) {
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const settings = await cmd.getSettings();
        if (cancelled) return;

        if (settings.discordRpcEnabled === false) {
          await cmd.clearDiscordPresence();
          startedRef.current = false;
          return;
        }

        const es = language !== "en";
        const playing = launcherState === "running";

        const details = playing
          ? es
            ? "Jugando Minecraft"
            : "Playing Minecraft"
          : es
            ? "Usando HyLauncher"
            : "Using HyLauncher";

        const presenceState = playing
          ? serverName
          : username
            ? es
              ? `Como ${username}`
              : `As ${username}`
            : es
              ? "En el menú"
              : "In the menu";

        await cmd.updateDiscordPresence(details, presenceState);
        startedRef.current = true;
      } catch (err) {
        // Discord may be closed — ignore quietly
        console.warn("Discord RPC:", err);
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [launcherState, username, serverName, language]);

  useEffect(() => {
    return () => {
      if (startedRef.current) {
        void cmd.clearDiscordPresence().catch(() => {});
      }
    };
  }, []);
}
