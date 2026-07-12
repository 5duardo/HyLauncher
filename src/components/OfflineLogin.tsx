// ============================================================
// HyLauncher — OfflineLogin Component
// ============================================================

import { useState } from "react";
import { FaBolt } from "react-icons/fa";

interface OfflineLoginProps {
  onSubmit: (username: string) => void;
  isLoading: boolean;
}

export function OfflineLogin({ onSubmit, isLoading }: OfflineLoginProps) {
  const [username, setUsername] = useState("");

  const isValid =
    username.length >= 3 &&
    username.length <= 16 &&
    /^[a-zA-Z0-9_]+$/.test(username);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      onSubmit(username);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="input-group">
        <label htmlFor="offline-username">Nombre de usuario</label>
        <input
          id="offline-username"
          type="text"
          className="input-field"
          placeholder="Steve"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        <p className="input-hint">
          3–16 caracteres. Solo letras, números y guion bajo.
          {username.length > 0 && !isValid && (
            <span style={{ color: "var(--color-error)", marginLeft: "8px" }}>
              Nombre inválido
            </span>
          )}
        </p>
      </div>

      <button
        type="submit"
        className="btn btn--primary btn--full"
        disabled={!isValid || isLoading}
        style={{ marginTop: "16px" }}
      >
        {isLoading ? (
          <>
            <span className="spinner" /> Guardando...
          </>
        ) : (
          <>
            <FaBolt size={12} style={{ marginRight: 6 }} />
            Entrar como Offline
          </>
        )}
      </button>
    </form>
  );
}
