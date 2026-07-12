// ============================================================
// HyLauncher — SettingsPanel (Lunar-style)
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { FaBell, FaCode, FaDesktop, FaDiscord, FaFolder, FaGamepad, FaGlobe, FaInfoCircle, FaLock, FaMicrochip, FaMoon, FaSearch, FaShieldAlt, FaTh, FaTimes, FaUser } from "react-icons/fa";
import type { LauncherSettings } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsTab = "game" | "general" | "account" | "storage" | "notifications" | "discord" | "privacy" | "about";

const NAV: { id: SettingsTab; label: string; icon: ReactNode; disabled?: boolean }[] = [
  {
    id: "game",
    label: "Juego",
    icon: (
      <FaGamepad size={18} />
    ),
  },
  {
    id: "general",
    label: "General",
    icon: (
      <FaMoon size={18} />
    ),
  },
  {
    id: "account",
    label: "Cuenta",
    disabled: true,
    icon: (
      <FaUser size={18} />
    ),
  },
  {
    id: "storage",
    label: "Almacenamiento",
    disabled: true,
    icon: (
      <FaFolder size={18} />
    ),
  },
  {
    id: "notifications",
    label: "Notificaciones",
    disabled: true,
    icon: (
      <FaBell size={18} />
    ),
  },
  {
    id: "discord",
    label: "Discord",
    disabled: true,
    icon: (
      <FaDiscord size={18} />
    ),
  },
  {
    id: "privacy",
    label: "Privacidad",
    disabled: true,
    icon: (
      <FaLock size={18} />
    ),
  },
  {
    id: "about",
    label: "Acerca de",
    icon: (
      <FaInfoCircle size={18} />
    ),
  },
];

const RAM_MIN = 1024;
const RAM_MAX = 16384;
const RAM_STEP = 512;

function estimateSystemRamMb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory && nav.deviceMemory > 0) {
    return Math.floor(nav.deviceMemory * 1024);
  }
  return 16384;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<LauncherSettings>({
    ramMb: 4096,
    theme: "dark",
    language: "es",
  });
  const [activeTab, setActiveTab] = useState<SettingsTab>("game");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const systemRamMb = useMemo(() => estimateSystemRamMb(), []);

  useEffect(() => {
    cmd.getSettings().then(setSettings).catch(console.error);
  }, []);

  const persistSettings = useCallback(async (next: LauncherSettings) => {
    setIsSaving(true);
    try {
      await cmd.saveSettings(next);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<LauncherSettings>, autoSave = true) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (autoSave) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => persistSettings(next), 400);
        }
        return next;
      });
    },
    [persistSettings]
  );

  const ramGb = (settings.ramMb / 1024).toFixed(1);
  const systemGb = (systemRamMb / 1024).toFixed(1);
  const freeGb = Math.max(0, systemRamMb - settings.ramMb);
  const freeGbStr = (freeGb / 1024).toFixed(1);

  const filteredNav = NAV.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const q = search.trim().toLowerCase();
  const matches = (keywords: string[]) =>
    !q || keywords.some((k) => k.includes(q) || q.includes(k));

  const showGame =
    activeTab === "game" && matches(["juego", "memoria", "ram", "java", "resolución", "resolucion"]);
  const showGeneral =
    activeTab === "general" && matches(["general", "idioma", "language"]);
  const showAbout =
    activeTab === "about" && matches(["acerca", "about", "launcher", "hy"]);

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="settings-modal-close settings-modal-close--floating" onClick={onClose} title="Cerrar">
          <FaTimes size={14} />
        </button>

        <div className="settings-modal-layout">
          {/* Sidebar */}
          <aside className="settings-sidebar">
            <div className="settings-search-row">
              <div className="settings-search-wrap">
                <FaSearch size={14} />
                <input
                  type="text"
                  className="settings-search"
                  placeholder="Buscar ajustes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="button" className="settings-shield-btn" title="Ajustes protegidos">
                <FaShieldAlt size={14} />
              </button>
            </div>

            <nav className="settings-nav">
              {(search ? filteredNav : NAV).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${activeTab === item.id ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                >
                  <span className="settings-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.disabled && <span className="settings-nav-soon">Pronto</span>}
                </button>
              ))}
            </nav>

            <div className="settings-sidebar-footer">
              <span>© HyLauncher 2026</span>
              <span>No afiliado a Mojang o Microsoft</span>
            </div>
          </aside>

          {/* Content */}
          <div className="settings-content">
            <div className="settings-content-header">
              <div className="settings-content-actions">
                {isSaving && <span className="settings-save-status">Guardando...</span>}
                {!isSaving && savedFlash && (
                  <span className="settings-save-status settings-save-status--ok">Guardado ✓</span>
                )}
              </div>
            </div>

            <div className="settings-content-scroll">
              {showGame && (
                <>
                  <section className="settings-section">
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <FaMicrochip size={16} />
                      </div>
                      <div>
                        <h3>Memoria asignada</h3>
                        <p>Cuánta RAM asignar a la instancia del juego</p>
                      </div>
                    </div>

                    <div className="settings-ram-display">
                      <span className="settings-ram-pill">
                        {ramGb} GB <span className="settings-ram-pill-sep">~{systemGb} GB</span>
                      </span>
                      <span className="settings-ram-free">
                        Tienes {freeGbStr} GB libres para asignar
                      </span>
                    </div>

                    <div className="settings-slider-wrap">
                      <span className="settings-slider-label">500 MB</span>
                      <div
                        className="settings-slider-track"
                        style={{
                          ["--slider-fill" as string]: `${((settings.ramMb - RAM_MIN) / (Math.min(RAM_MAX, systemRamMb) - RAM_MIN)) * 100}%`,
                        }}
                      >
                        <input
                          type="range"
                          className="settings-slider"
                          min={RAM_MIN}
                          max={Math.min(RAM_MAX, systemRamMb)}
                          step={RAM_STEP}
                          value={settings.ramMb}
                          onChange={(e) =>
                            updateSettings({ ramMb: Number(e.target.value) })
                          }
                        />
                      </div>
                      <span className="settings-slider-label">{systemGb} GB</span>
                    </div>
                  </section>

                  <section className="settings-section">
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <FaDesktop size={16} />
                      </div>
                      <div>
                        <h3>Resolución del juego</h3>
                        <p>Resolución de la ventana de Minecraft (próximamente)</p>
                      </div>
                    </div>

                    <div className="settings-resolution">
                      <div className="settings-res-input">
                        <span>W</span>
                        <input type="text" value="1280" readOnly disabled />
                      </div>
                      <span className="settings-res-x">×</span>
                      <div className="settings-res-input">
                        <span>H</span>
                        <input type="text" value="720" readOnly disabled />
                      </div>
                    </div>

                    <div className="settings-res-actions">
                      <button type="button" className="settings-res-btn" disabled>
                        <FaTh size={14} />
                        Seleccionar preset
                      </button>
                      <button type="button" className="settings-res-btn" disabled>
                        <FaDesktop size={16} />
                        Visualizar en pantalla
                      </button>
                    </div>

                    <div className="settings-checkboxes">
                      <label className="settings-checkbox">
                        <input type="checkbox" disabled />
                        <span>Iniciar en pantalla completa</span>
                      </label>
                      <label className="settings-checkbox">
                        <input type="checkbox" disabled />
                        <span>Bloquear relación de aspecto</span>
                      </label>
                    </div>
                  </section>

                  <section className="settings-section">
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <FaCode size={16} />
                      </div>
                      <div>
                        <h3>Ruta de Java</h3>
                        <p>Override opcional del ejecutable Java</p>
                      </div>
                    </div>

                    <input
                      type="text"
                      className="settings-input"
                      placeholder="Automático — dejar vacío para usar javaw del sistema"
                      value={settings.javaPathOverride ?? ""}
                      onChange={(e) =>
                        updateSettings({
                          javaPathOverride: e.target.value || undefined,
                        })
                      }
                    />
                    <p className="settings-hint">
                      Solo cámbialo si sabes lo que haces. Por defecto usa el Java del sistema.
                    </p>
                  </section>
                </>
              )}

              {showGeneral && (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div className="settings-section-icon">
                      <FaGlobe size={16} />
                    </div>
                    <div>
                      <h3>Idioma</h3>
                      <p>Idioma de la interfaz del launcher</p>
                    </div>
                  </div>

                  <select
                    className="settings-select"
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value })}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </section>
              )}

              {showAbout && (
                <section className="settings-section">
                  <div className="settings-about-card">
                    <img src="/logo.png" alt="HyLauncher" className="settings-about-logo" />
                    <h3>HyLauncher</h3>
                    <p>Launcher personalizado para HyServer</p>
                    <span className="settings-about-version">v1.0.0 · Minecraft 1.20.1 · Fabric</span>
                  </div>
                </section>
              )}

              {search && filteredNav.length === 0 && (
                <p className="settings-empty">No se encontraron ajustes para "{search}"</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
