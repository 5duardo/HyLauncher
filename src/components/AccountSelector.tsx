// ============================================================
// HyLauncher — AccountSelector Component
// ============================================================

import { useState } from "react";
import { FaBolt, FaKey, FaSignOutAlt, FaTimes } from "react-icons/fa";
import type { Account } from "../lib/types";
import { MicrosoftLogin } from "./MicrosoftLogin";
import { OfflineLogin } from "./OfflineLogin";
import { AccountAvatar } from "./AccountAvatar";
import type { DeviceCodeResponse } from "../lib/types";
import { useI18n } from "../lib/i18n";

interface AccountSelectorProps {
  activeAccount: Account | null;
  onLoginOffline: (username: string) => Promise<Account | null>;
  onLoginMicrosoft: () => void;
  onCancelMicrosoft: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
  onLogout: () => void;
}

export function AccountSelector({
  activeAccount,
  onLoginOffline,
  onLoginMicrosoft,
  onCancelMicrosoft,
  deviceCode,
  isPolling,
  isLoading,
  onLogout,
}: AccountSelectorProps) {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);

  if (activeAccount) {
    return (
      <div
        className="account-card"
        onClick={() => setShowModal(true)}
        id="account-selector"
        style={{ display: "flex", alignItems: "center", gap: "10px", paddingRight: "10px" }}
      >
        <div className="account-avatar">
          <AccountAvatar account={activeAccount} size={36} />
        </div>
        <div className="account-info" style={{ marginRight: "4px" }}>
          <span className="account-name">{activeAccount.username}</span>
          <span className="account-type">
            <span
              className={`badge ${
                activeAccount.mode === "premium" ? "badge--premium" : "badge--offline"
              }`}
            >
              {activeAccount.mode === "premium" ? "Premium" : "Offline"}
            </span>
          </span>
        </div>

        <button
          className="logout-btn"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.2s",
            marginLeft: "auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onLogout();
          }}
          title={t("account.logout")}
          onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
          onMouseOut={(e) =>
            (e.currentTarget.style.color = "var(--color-text-muted)")
          }
        >
          <FaSignOutAlt size={14} />
        </button>
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
          <span className="account-name">{t("account.signIn")}</span>
          <span className="account-type">{t("account.clickToEnter")}</span>
        </div>
      </button>

      {showModal && (
        <LoginModal
          activeAccount={activeAccount}
          onLogout={() => {
            onLogout();
            setShowModal(false);
          }}
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

interface LoginModalProps {
  activeAccount: Account | null;
  onLogout: () => void;
  onClose: () => void;
  onLoginOffline: (username: string) => void;
  onLoginMicrosoft: () => void;
  onCancelMicrosoft: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
}

function LoginModal({
  activeAccount,
  onLogout,
  onClose,
  onLoginOffline,
  onLoginMicrosoft,
  onCancelMicrosoft,
  deviceCode,
  isPolling,
  isLoading,
}: LoginModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"premium" | "offline">("offline");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{activeAccount ? t("account.manage") : t("account.signInTitle")}</h3>
          <button className="modal-close" onClick={onClose}>
            <FaTimes size={12} />
          </button>
        </div>
        <div className="modal-body">
          {activeAccount && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              <div
                className="account-avatar"
                style={{ width: 48, height: 48, marginBottom: 12 }}
              >
                <AccountAvatar account={activeAccount} size={48} />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {t("account.activeSession")}
              </span>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "white",
                  margin: "4px 0 12px",
                }}
              >
                {activeAccount.username}
              </span>
              <button
                className="btn"
                style={{
                  width: "100%",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onClick={onLogout}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")
                }
              >
                {t("account.logoutBtn")}
              </button>
            </div>
          )}

          {!activeAccount && (
            <>
              <div className="auth-toggle">
                <button
                  className={`auth-toggle-btn ${mode === "offline" ? "active" : ""}`}
                  onClick={() => setMode("offline")}
                >
                  <FaBolt size={12} style={{ marginRight: 6 }} />
                  Offline
                </button>
                <button
                  className={`auth-toggle-btn ${mode === "premium" ? "active" : ""}`}
                  onClick={() => setMode("premium")}
                >
                  <FaKey size={14} style={{ marginRight: 6 }} />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
