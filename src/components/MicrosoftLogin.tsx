// ============================================================
// HyLauncher — MicrosoftLogin Component
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { FaKey } from "react-icons/fa";
import { open } from "@tauri-apps/plugin-shell";
import type { DeviceCodeResponse } from "../lib/types";
import { useI18n } from "../lib/i18n";

interface MicrosoftLoginProps {
  onStart: () => void;
  onCancel: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

async function openVerificationUrl(url: string): Promise<void> {
  try {
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function MicrosoftLogin({
  onStart,
  onCancel,
  deviceCode,
  isPolling,
  isLoading,
}: MicrosoftLoginProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const autoStartedRef = useRef<string | null>(null);

  const handleCopyCode = useCallback(async (code: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  useEffect(() => {
    if (!deviceCode || !isPolling) {
      autoStartedRef.current = null;
      return;
    }

    if (autoStartedRef.current === deviceCode.userCode) return;
    autoStartedRef.current = deviceCode.userCode;

    void handleCopyCode(deviceCode.userCode);
    void openVerificationUrl(deviceCode.verificationUri);
  }, [deviceCode, isPolling, handleCopyCode]);

  if (deviceCode && isPolling) {
    return (
      <div style={{ marginTop: "20px" }}>
        <div className="device-code-display">
          <button
            type="button"
            className={`code code--clickable ${copied ? "code--copied" : ""}`}
            onClick={() => handleCopyCode(deviceCode.userCode)}
            title={t("ms.copyTitle")}
          >
            {deviceCode.userCode}
          </button>
          {copied && (
            <span className="code-copy-hint">{t("ms.copiedClipboard")}</span>
          )}
          <p className="instruction">
            {t("ms.instruction").split("{link}")[0]}
            <button
              type="button"
              className="link"
              onClick={() => openVerificationUrl(deviceCode.verificationUri)}
            >
              {deviceCode.verificationUri}
            </button>
            {t("ms.instruction").split("{link}")[1] ?? ""}
          </p>
        </div>

        <div className="polling-indicator">
          <span>{t("ms.waitingAuth")}</span>
          <span className="dots">
            <span />
            <span />
            <span />
          </span>
        </div>

        <button
          className="btn btn--secondary btn--full"
          onClick={onCancel}
          style={{ marginTop: "16px" }}
        >
          {t("ms.cancel")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          marginBottom: "16px",
          lineHeight: 1.6,
        }}
      >
        {t("ms.blurb")}
      </p>
      <button
        className="btn btn--primary btn--full"
        onClick={onStart}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner" /> {t("ms.connecting")}
          </>
        ) : (
          <>
            <FaKey size={14} style={{ marginRight: 6 }} />
            {t("ms.start")}
          </>
        )}
      </button>
    </div>
  );
}
