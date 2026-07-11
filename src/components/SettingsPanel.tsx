// ============================================================
// HyLauncher — SettingsPanel Component
// ============================================================

import { useState, useEffect } from "react";
import type { LauncherSettings } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<LauncherSettings>({
    ramMb: 4096,
    theme: "dark",
    language: "es",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    cmd.getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await cmd.saveSettings(settings);
      onClose();
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setIsSaving(false);
  };

  const ramGb = (settings.ramMb / 1024).toFixed(1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configuración
          </h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-panel">
            {/* RAM */}
            <div className="settings-row">
              <label>Memoria RAM asignada</label>
              <div className="ram-slider">
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={settings.ramMb}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      ramMb: Number(e.target.value),
                    }))
                  }
                />
                <span className="value">{ramGb} GB</span>
              </div>
              <p className="input-hint">
                Recomendado: 4 GB para modpacks ligeros, 6–8 GB para pesados.
              </p>
            </div>

            {/* Java Path Override */}
            <div className="settings-row">
              <label>Ruta de Java (opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Automático — dejar vacío para usar el del sistema"
                value={settings.javaPathOverride ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    javaPathOverride: e.target.value || undefined,
                  }))
                }
              />
              <p className="input-hint">
                Solo cambia esto si sabes lo que haces. El launcher utilizará el 
                comando 'javaw' del sistema de forma automática.
              </p>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <button
                className="btn btn--primary"
                onClick={handleSave}
                disabled={isSaving}
                style={{ flex: 1 }}
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
              <button
                className="btn btn--secondary"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
