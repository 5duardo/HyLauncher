// ============================================================
// HyLauncher — Game Running / Crash Console Panel
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCopy, FaStop, FaTrash } from "react-icons/fa";
import { useI18n } from "../lib/i18n";
import * as cmd from "../lib/tauri-commands";

interface GameRunningPanelProps {
  username: string;
  processAlive: boolean;
  onStopGame: () => void;
  onBack: () => void;
  isStopping?: boolean;
}

const MAX_LINES = 800;

function looksLikeCrash(lines: string[]): boolean {
  const sample = lines.slice(-80).join("\n");
  return /crash|exception|fatal|error:|failed to|has crashed|#@!@#/i.test(sample);
}

export function GameRunningPanel({
  username,
  processAlive,
  onStopGame,
  onBack,
  isStopping = false,
}: GameRunningPanelProps) {
  const { t } = useI18n();
  const [lines, setLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const consoleRef = useRef<HTMLPreElement>(null);

  const crashed = useMemo(
    () => !processAlive && looksLikeCrash(lines),
    [processAlive, lines]
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const existing = await cmd.getGameConsoleLogs();
        if (!cancelled && existing.length) {
          setLines(existing.slice(-MAX_LINES));
        }
      } catch {
        /* ignore */
      }

      try {
        unlisten = await cmd.onGameLog((line) => {
          setLines((prev) => {
            const next = [...prev, line];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        });
      } catch (err) {
        console.warn(err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll || !consoleRef.current) return;
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [lines, autoScroll]);

  const copyConsole = async () => {
    const text = lines.join("\n");
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for restricted clipboard
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const statusLabel = processAlive
    ? t("running.live")
    : crashed
      ? t("running.crashed")
      : t("running.exited");

  return (
    <div className="hy-running hy-running--console">
      <header className="hy-running-toolbar">
        <div className="hy-running-toolbar-left">
          <div
            className={`hy-running-live ${
              processAlive
                ? ""
                : crashed
                  ? "hy-running-live--crash"
                  : "hy-running-live--exit"
            }`}
          >
            <span className="hy-running-dot" />
            {statusLabel}
          </div>
          <div>
            <h2 className="hy-running-title">
              {processAlive
                ? t("running.title")
                : crashed
                  ? t("running.crashTitle")
                  : t("running.exitTitle")}
            </h2>
            <p className="hy-running-lead">
              {processAlive
                ? t("running.leadConsole", { name: username })
                : crashed
                  ? t("running.crashLead")
                  : t("running.exitLead")}
            </p>
          </div>
        </div>

        <div className="hy-running-toolbar-actions">
          {processAlive ? (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={onStopGame}
              disabled={isStopping}
            >
              {isStopping ? (
                <>
                  <span className="spinner" />
                  {t("running.stopping")}
                </>
              ) : (
                <>
                  <FaStop size={12} />
                  {t("running.stop")}
                </>
              )}
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={onBack}>
              <FaArrowLeft size={12} />
              {t("running.back")}
            </button>
          )}
        </div>
      </header>

      <section className="hy-console">
        <div className="hy-console-head">
          <strong>{t("running.console")}</strong>
          <div className="hy-console-actions">
            <label className="hy-console-autoscroll">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              {t("running.consoleAuto")}
            </label>
            <button
              type="button"
              className="hy-console-clear"
              onClick={() => void copyConsole()}
              title={t("running.consoleCopy")}
              disabled={lines.length === 0}
            >
              <FaCopy size={11} />
              <span>{copied ? t("running.consoleCopied") : t("running.consoleCopy")}</span>
            </button>
            <button
              type="button"
              className="hy-console-clear"
              onClick={() => setLines([])}
              title={t("running.consoleClear")}
            >
              <FaTrash size={11} />
            </button>
          </div>
        </div>
        <pre ref={consoleRef} className="hy-console-body" tabIndex={0}>
          {lines.length === 0 ? (
            <span className="hy-console-empty">{t("running.consoleEmpty")}</span>
          ) : (
            lines.map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 24)}`}
                className={
                  /error|exception|fatal|crash/i.test(line)
                    ? "hy-console-line hy-console-line--err"
                    : /warn/i.test(line)
                      ? "hy-console-line hy-console-line--warn"
                      : "hy-console-line"
                }
              >
                {line}
              </div>
            ))
          )}
        </pre>
      </section>
    </div>
  );
}
