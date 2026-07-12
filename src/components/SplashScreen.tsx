// ============================================================
// HyLauncher — Compact splash + auto-updater
// ============================================================

import { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useI18n } from "../lib/i18n";
import * as cmd from "../lib/tauri-commands";

type SplashStage = "starting" | "checking" | "downloading" | "installing" | "ready" | "error";

interface SplashScreenProps {
  onComplete: () => void;
}

const MIN_SPLASH_MS = 1600;
const UPDATE_CHECK_MS = 9000;

/** Only guard the installer against StrictMode double-fire */
let installInFlight = false;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { t } = useI18n();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishedRef = useRef(false);

  const [stage, setStage] = useState<SplashStage>("starting");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [progress, setProgress] = useState(8);
  const [indeterminate, setIndeterminate] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const [version, setVersion] = useState("");

  const finishToApp = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      await cmd.setWindowMain();
    } catch (err) {
      console.warn("expand window:", err);
    }
    onCompleteRef.current();
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const started = Date.now();

      try {
        await cmd.setWindowSplash().catch(() => undefined);
        if (cancelled) return;

        const appVersion = await cmd.getAppVersion().catch(() => "1.0.0");
        if (cancelled) return;
        setVersion(appVersion);

        setStage("starting");
        setStatus(t("splash.starting"));
        setProgress(14);
        setIndeterminate(true);
        await sleep(220);
        if (cancelled) return;

        setStage("checking");
        setStatus(t("splash.checking"));
        setProgress(32);

        const settings = await cmd.getSettings().catch(() => null);
        if (cancelled) return;

        if (settings?.checkUpdatesOnStart === false) {
          setStage("ready");
          setStatus(t("splash.ready"));
          setProgress(100);
          setIndeterminate(false);
        } else {
          let check;
          try {
            check = await withTimeout(
              cmd.checkForLauncherUpdate(),
              UPDATE_CHECK_MS,
              "update-check"
            );
          } catch {
            if (cancelled) return;
            setStage("ready");
            setStatus(t("splash.ready"));
            setProgress(100);
            setIndeterminate(false);
            const elapsed = Date.now() - started;
            if (elapsed < MIN_SPLASH_MS) await sleep(MIN_SPLASH_MS - elapsed);
            if (!cancelled) await finishToApp();
            return;
          }
          if (cancelled) return;

          if (check.updateAvailable && check.downloadUrl) {
            setStage("downloading");
            setStatus(t("splash.downloading", { version: check.latestVersion }));
            setDetail(check.releaseName || null);
            setProgress(55);
            setIndeterminate(true);

            if (!installInFlight) {
              installInFlight = true;
              try {
                await cmd.installLauncherUpdate();
              } catch (err) {
                installInFlight = false;
                throw err;
              }
            }

            if (cancelled) return;
            setStage("installing");
            setStatus(t("splash.restarting"));
            setProgress(100);
            setIndeterminate(false);
            await sleep(3500);
            if (!cancelled) {
              setCanSkip(true);
              setStatus(t("splash.installOpened"));
            }
            return;
          }

          setStage("ready");
          setStatus(
            t("splash.upToDate", {
              version: check.currentVersion || appVersion,
            })
          );
          setProgress(100);
          setIndeterminate(false);
        }

        const elapsed = Date.now() - started;
        if (elapsed < MIN_SPLASH_MS) await sleep(MIN_SPLASH_MS - elapsed);
        if (!cancelled) await finishToApp();
      } catch (err) {
        if (cancelled) return;
        setStage("error");
        setStatus(t("splash.error"));
        setDetail(String(err));
        setProgress(100);
        setIndeterminate(false);
        setCanSkip(true);
        await sleep(1200);
        if (!cancelled) await finishToApp();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="splash-screen splash-screen--compact">
      <div className="splash-drag" data-tauri-drag-region />
      <button
        type="button"
        className="splash-close"
        title={t("title.close")}
        onClick={() => void cmd.closeWindow()}
      >
        <FaTimes size={11} />
      </button>

      <div className="splash-center">
        <img src="/logo.png" alt="" className="splash-logo" />
        <div className="splash-brand-block">
          <h1 className="splash-brand">HyLauncher</h1>
          {version ? <span className="splash-version">{version}</span> : null}
        </div>
      </div>

      <div className="splash-footer">
        <div className="splash-status-row">
          <span className="splash-status">{status || t("splash.starting")}</span>
          {detail && stage === "error" ? (
            <span className="splash-detail">{detail}</span>
          ) : null}
        </div>
        <div
          className={`splash-progress ${indeterminate ? "splash-progress--indeterminate" : ""}`}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
        >
          <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        {(canSkip || stage === "error") && (
          <button type="button" className="splash-skip" onClick={() => void finishToApp()}>
            {t("splash.continue")}
          </button>
        )}
      </div>
    </div>
  );
}
