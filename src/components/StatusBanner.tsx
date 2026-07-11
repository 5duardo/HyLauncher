// ============================================================
// HyLauncher — StatusBanner Component
// ============================================================

interface StatusBannerProps {
  type: "info" | "success" | "warning" | "error";
  message: string;
  onDismiss?: () => void;
}

const getIcon = (type: "info" | "success" | "warning" | "error") => {
  switch (type) {
    case "info":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case "success":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)' }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "warning":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-warning)' }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "error":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-error)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
  }
};

export function StatusBanner({ type, message, onDismiss }: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${type}`}>
      <span style={{ display: 'flex', alignItems: 'center' }}>{getIcon(type)}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          className="modal-close"
          onClick={onDismiss}
          style={{ width: 20, height: 20, fontSize: 10 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
