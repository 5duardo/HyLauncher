// ============================================================
// HyLauncher — AccountSelector Component
// ============================================================

import { useState, useEffect } from "react";
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
  const [showModal, setShowModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset image error state when account changes
  useEffect(() => {
    setImgError(false);
  }, [activeAccount?.id]);

  if (activeAccount) {
    const initial = activeAccount.username.charAt(0).toUpperCase();
    const isOffline = activeAccount.mode === "offline";
    const skinUrl =
      activeAccount.mode === "premium"
        ? `https://crafatar.com/avatars/${activeAccount.uuid}?size=36&overlay`
        : null;

    return (
      <div
        className="account-card"
        onClick={() => setShowModal(true)}
        id="account-selector"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '10px' }}
      >
        <div className="account-avatar">
          {isOffline ? (
            <svg width="36" height="36" viewBox="0 0 8 8" shapeRendering="crispEdges" style={{ display: 'block', borderRadius: 'inherit' }}>
              {/* Hair (Row 0-1) */}
              <rect x="0" y="0" width="8" height="2" fill="#2c160e" />
              {/* Hair sides + Forehead (Row 2) */}
              <rect x="0" y="2" width="1" height="1" fill="#2c160e" />
              <rect x="1" y="2" width="6" height="1" fill="#d29574" />
              <rect x="7" y="2" width="1" height="1" fill="#2c160e" />
              {/* Skin (Row 3) */}
              <rect x="0" y="3" width="8" height="1" fill="#d29574" />
              {/* Eyes (Row 4) */}
              <rect x="0" y="4" width="1" height="1" fill="#d29574" />
              <rect x="1" y="4" width="1" height="1" fill="#ffffff" />
              <rect x="2" y="4" width="1" height="1" fill="#3c52a1" />
              <rect x="3" y="4" width="2" height="1" fill="#d29574" />
              <rect x="5" y="4" width="1" height="1" fill="#3c52a1" />
              <rect x="6" y="4" width="1" height="1" fill="#ffffff" />
              <rect x="7" y="4" width="1" height="1" fill="#d29574" />
              {/* Nose (Row 5) */}
              <rect x="0" y="5" width="3" height="1" fill="#d29574" />
              <rect x="3" y="5" width="2" height="1" fill="#b06c50" />
              <rect x="5" y="5" width="3" height="1" fill="#d29574" />
              {/* Mouth / Beard (Row 6) */}
              <rect x="0" y="6" width="2" height="1" fill="#d29574" />
              <rect x="2" y="6" width="4" height="1" fill="#58311f" />
              <rect x="6" y="6" width="2" height="1" fill="#d29574" />
              {/* Chin (Row 7) */}
              <rect x="0" y="7" width="8" height="1" fill="#d29574" />
            </svg>
          ) : skinUrl && !imgError ? (
            <img
              src={skinUrl}
              alt={activeAccount.username}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            initial
          )}
        </div>
        <div className="account-info" style={{ marginRight: '4px' }}>
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
        
        {/* Logout Button directly inside mini profile */}
        <button
          className="logout-btn"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
            marginLeft: 'auto'
          }}
          onClick={(e) => {
            e.stopPropagation(); // Don't trigger showing LoginModal
            onLogout();
          }}
          title="Cerrar sesión"
          onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
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
          <span className="account-name">Iniciar sesión</span>
          <span className="account-type">Haz clic para entrar</span>
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

// ---- Login Modal ----

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
  const [mode, setMode] = useState<"premium" | "offline">("offline");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{activeAccount ? "Gestionar Cuenta" : "Iniciar Sesión"}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {activeAccount && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sesión Activa</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: '4px 0 12px' }}>{activeAccount.username}</span>
              <button
                className="btn"
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onClick={onLogout}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              >
                Cerrar Sesión
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
