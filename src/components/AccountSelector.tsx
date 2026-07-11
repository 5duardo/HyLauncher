// ============================================================
// HyLauncher — AccountSelector Component
// ============================================================

import { useState } from "react";
import type { Account } from "../lib/types";
import { MicrosoftLogin } from "./MicrosoftLogin";
import { OfflineLogin } from "./OfflineLogin";
import type { DeviceCodeResponse } from "../lib/types";

interface AccountSelectorProps {
  activeAccount: Account | null;
  onLoginOffline: (username: string) => Promise<Account | null>;
  onLoginMicrosoft: () => void;
  onCancelMicrosoft: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
}

export function AccountSelector({
  activeAccount,
  onLoginOffline,
  onLoginMicrosoft,
  onCancelMicrosoft,
  deviceCode,
  isPolling,
  isLoading,
}: AccountSelectorProps) {
  const [showModal, setShowModal] = useState(false);

  if (activeAccount) {
    const initial = activeAccount.username.charAt(0).toUpperCase();
    const skinUrl =
      activeAccount.mode === "premium"
        ? `https://crafatar.com/avatars/${activeAccount.uuid}?size=36&overlay`
        : null;

    return (
      <div
        className="account-card"
        onClick={() => setShowModal(true)}
        id="account-selector"
      >
        <div className="account-avatar">
          {skinUrl ? (
            <img
              src={skinUrl}
              alt={activeAccount.username}
              loading="lazy"
            />
          ) : (
            initial
          )}
        </div>
        <div className="account-info">
          <span className="account-name">{activeAccount.username}</span>
          <span className="account-type">
            <span
              className={`badge ${
                activeAccount.mode === "premium"
                  ? "badge--premium"
                  : "badge--offline"
              }`}
            >
              {activeAccount.mode === "premium" ? "Premium" : "Offline"}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="account-card"
        onClick={() => setShowModal(true)}
        id="login-button"
      >
        <div className="account-avatar">?</div>
        <div className="account-info">
          <span className="account-name">Iniciar sesión</span>
          <span className="account-type">Haz clic para entrar</span>
        </div>
      </button>

      {showModal && (
        <LoginModal
          onClose={() => {
            setShowModal(false);
            onCancelMicrosoft();
          }}
          onLoginOffline={async (u) => {
            const acc = await onLoginOffline(u);
            if (acc) setShowModal(false);
          }}
          onLoginMicrosoft={onLoginMicrosoft}
          onCancelMicrosoft={onCancelMicrosoft}
          deviceCode={deviceCode}
          isPolling={isPolling}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

// ---- Login Modal ----

interface LoginModalProps {
  onClose: () => void;
  onLoginOffline: (username: string) => void;
  onLoginMicrosoft: () => void;
  onCancelMicrosoft: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
}

function LoginModal({
  onClose,
  onLoginOffline,
  onLoginMicrosoft,
  onCancelMicrosoft,
  deviceCode,
  isPolling,
  isLoading,
}: LoginModalProps) {
  const [mode, setMode] = useState<"premium" | "offline">("offline");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Iniciar Sesión</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="auth-toggle">
            <button
              className={`auth-toggle-btn ${mode === "offline" ? "active" : ""}`}
              onClick={() => setMode("offline")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" />
              </svg>
              Offline
            </button>
            <button
              className={`auth-toggle-btn ${mode === "premium" ? "active" : ""}`}
              onClick={() => setMode("premium")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Premium
            </button>
          </div>

          {mode === "offline" ? (
            <OfflineLogin onSubmit={onLoginOffline} isLoading={isLoading} />
          ) : (
            <MicrosoftLogin
              onStart={onLoginMicrosoft}
              onCancel={onCancelMicrosoft}
              deviceCode={deviceCode}
              isPolling={isPolling}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
