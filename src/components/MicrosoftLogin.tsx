// ============================================================
// HyLauncher — MicrosoftLogin Component
// ============================================================

import type { DeviceCodeResponse } from "../lib/types";

interface MicrosoftLoginProps {
  onStart: () => void;
  onCancel: () => void;
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
  isLoading: boolean;
}

export function MicrosoftLogin({
  onStart,
  onCancel,
  deviceCode,
  isPolling,
  isLoading,
}: MicrosoftLoginProps) {
  if (deviceCode && isPolling) {
    return (
      <div style={{ marginTop: "20px" }}>
        <div className="device-code-display">
          <div className="code">{deviceCode.userCode}</div>
          <p className="instruction">
            Abre{" "}
            <span
              className="link"
              onClick={() =>
                window.open(deviceCode.verificationUri, "_blank")
              }
            >
              {deviceCode.verificationUri}
            </span>{" "}
            en tu navegador e ingresa el código de arriba.
          </p>
        </div>

        <div className="polling-indicator">
          <span>Esperando autenticación</span>
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
          Cancelar
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
        Inicia sesión con tu cuenta de Microsoft para jugar con tu perfil
        premium. Se abrirá una ventana del navegador para autenticarte de forma
        segura.
      </p>
      <button
        className="btn btn--primary btn--full"
        onClick={onStart}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner" /> Conectando...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            Iniciar con Microsoft
          </>
        )}
      </button>
    </div>
  );
}
