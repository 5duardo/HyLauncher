// ============================================================
// HyLauncher — StatusBanner Component
// ============================================================

import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

interface StatusBannerProps {
  type: "info" | "success" | "warning" | "error";
  message: string;
  onDismiss?: () => void;
}

const getIcon = (type: "info" | "success" | "warning" | "error") => {
  switch (type) {
    case "info":
      return <FaInfoCircle size={16} />;
    case "success":
      return <FaCheckCircle size={16} />;
    case "warning":
      return <FaExclamationTriangle size={16} style={{ color: "var(--color-warning)" }} />;
    case "error":
      return <FaExclamationCircle size={16} style={{ color: "var(--color-error)" }} />;
  }
};

export function StatusBanner({ type, message, onDismiss }: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${type}`}>
      <span style={{ display: "flex", alignItems: "center" }}>{getIcon(type)}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          className="modal-close"
          onClick={onDismiss}
          style={{ width: 20, height: 20, fontSize: 10 }}
        >
          <FaTimes size={10} />
        </button>
      )}
    </div>
  );
}
