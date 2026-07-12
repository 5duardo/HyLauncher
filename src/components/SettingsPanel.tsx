// ============================================================
// HyLauncher — SettingsPanel (Lunar-style)
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  FaBell,
  FaCheck,
  FaChevronDown,
  FaCode,
  FaDesktop,
  FaDiscord,
  FaFolder,
  FaGamepad,
  FaGlobe,
  FaInfoCircle,
  FaLock,
  FaMicrochip,
  FaMoon,
  FaSearch,
  FaShieldAlt,
  FaTh,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import type { Account, LauncherSettings } from "../lib/types";
import { useI18n, type Locale } from "../lib/i18n";
import * as cmd from "../lib/tauri-commands";
import { AccountAvatar } from "./AccountAvatar";

interface SettingsPanelProps {
  onClose: () => void;
  activeAccount: Account | null;
  accounts: Account[];
  onLogout: () => void;
  onSelectAccount: (id: string) => void;
  onRemoveAccount: (id: string) => void;
}

type SettingsTab =
  | "game"
  | "general"
  | "account"
  | "storage"
  | "notifications"
  | "discord"
  | "privacy"
  | "about";

const RAM_MIN = 1024;
const RAM_MAX = 16384;
const RAM_STEP = 512;

const LANG_OPTIONS: { value: Locale; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

function estimateSystemRamMb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory && nav.deviceMemory > 0) {
    return Math.floor(nav.deviceMemory * 1024);
  }
  return 16384;
}

function LanguageDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (locale: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current =
    LANG_OPTIONS.find((o) => o.value === value) ?? LANG_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`lang-dropdown ${open ? "lang-dropdown--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="lang-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <FaChevronDown size={12} className="lang-dropdown-chevron" />
      </button>
      {open && (
        <ul className="lang-dropdown-menu" role="listbox">
          {LANG_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === current.value}
                className={`lang-dropdown-option ${
                  opt.value === current.value ? "lang-dropdown-option--active" : ""
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === current.value && <FaCheck size={11} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsPanel({
  onClose,
  activeAccount,
  accounts,
  onLogout,
  onSelectAccount,
  onRemoveAccount,
}: SettingsPanelProps) {
  const { t, locale, setLocale } = useI18n();
  const [settings, setSettings] = useState<LauncherSettings>({
    ramMb: 4096,
    theme: "dark",
    language: "es",
    discordRpcEnabled: true,
    discordClientId: "",
  });
  const [activeTab, setActiveTab] = useState<SettingsTab>("game");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const systemRamMb = useMemo(() => estimateSystemRamMb(), []);

  const NAV: { id: SettingsTab; label: string; icon: ReactNode; disabled?: boolean }[] =
    useMemo(
      () => [
        { id: "game", label: t("settings.nav.game"), icon: <FaGamepad size={18} /> },
        { id: "general", label: t("settings.nav.general"), icon: <FaMoon size={18} /> },
        {
          id: "account",
          label: t("settings.nav.account"),
          icon: <FaUser size={18} />,
        },
        {
          id: "storage",
          label: t("settings.nav.storage"),
          disabled: true,
          icon: <FaFolder size={18} />,
        },
        {
          id: "notifications",
          label: t("settings.nav.notifications"),
          disabled: true,
          icon: <FaBell size={18} />,
        },
        {
          id: "discord",
          label: t("settings.nav.discord"),
          icon: <FaDiscord size={18} />,
        },
        {
          id: "privacy",
          label: t("settings.nav.privacy"),
          disabled: true,
          icon: <FaLock size={18} />,
        },
        { id: "about", label: t("settings.nav.about"), icon: <FaInfoCircle size={18} /> },
      ],
      [t]
    );

  useEffect(() => {
    cmd
      .getSettings()
      .then((s) => {
        setSettings(s);
        if (s.language === "en" || s.language === "es") {
          setLocale(s.language);
        }
      })
      .catch(console.error);
  }, [setLocale]);

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

  const handleLanguageChange = (next: Locale) => {
    setLocale(next);
    updateSettings({ language: next });
  };

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
    activeTab === "game" &&
    matches(["juego", "game", "memoria", "memory", "ram", "java", "resolución", "resolucion", "resolution"]);
  const showGeneral =
    activeTab === "general" && matches(["general", "idioma", "language"]);
  const showAccount =
    activeTab === "account" &&
    matches(["cuenta", "account", "sesión", "sesion", "login", "premium", "offline"]);
  const showDiscord =
    activeTab === "discord" && matches(["discord", "rpc", "presence", "estado", "rich"]);
  const showAbout =
    activeTab === "about" && matches(["acerca", "about", "launcher", "hy"]);

  const discordEnabled = settings.discordRpcEnabled !== false;

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="settings-modal-close settings-modal-close--floating"
          onClick={onClose}
          title={t("title.close")}
        >
          <FaTimes size={14} />
        </button>

        <div className="settings-modal-layout">
          <aside className="settings-sidebar">
            <div className="settings-search-row">
              <div className="settings-search-wrap">
                <FaSearch size={14} />
                <input
                  type="text"
                  className="settings-search"
                  placeholder={t("settings.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="settings-shield-btn"
                title={t("settings.protected")}
              >
                <FaShieldAlt size={14} />
              </button>
            </div>

            <nav className="settings-nav">
              {(search ? filteredNav : NAV).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${activeTab === item.id ? "active" : ""} ${
                    item.disabled ? "disabled" : ""
                  }`}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                >
                  <span className="settings-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.disabled && (
                    <span className="settings-nav-soon">{t("settings.soon")}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="settings-sidebar-footer">
              <span>{t("settings.footer.rights")}</span>
              <span>{t("settings.footer.disclaimer")}</span>
            </div>
          </aside>

          <div className="settings-content">
            <div className="settings-content-header">
              <div className="settings-content-actions">
                {isSaving && (
                  <span className="settings-save-status">{t("settings.saving")}</span>
                )}
                {!isSaving && savedFlash && (
                  <span className="settings-save-status settings-save-status--ok">
                    {t("settings.saved")}
                  </span>
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
                        <h3>{t("settings.ram.title")}</h3>
                        <p>{t("settings.ram.desc")}</p>
                      </div>
                    </div>

                    <div className="settings-ram-display">
                      <span className="settings-ram-pill">
                        {ramGb} GB <span className="settings-ram-pill-sep">~{systemGb} GB</span>
                      </span>
                      <span className="settings-ram-free">
                        {t("settings.ram.free", { free: freeGbStr })}
                      </span>
                    </div>

                    <div className="settings-slider-wrap">
                      <span className="settings-slider-label">500 MB</span>
                      <div
                        className="settings-slider-track"
                        style={{
                          ["--slider-fill" as string]: `${
                            ((settings.ramMb - RAM_MIN) /
                              (Math.min(RAM_MAX, systemRamMb) - RAM_MIN)) *
                            100
                          }%`,
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
                        <h3>{t("settings.res.title")}</h3>
                        <p>{t("settings.res.desc")}</p>
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
                        {t("settings.res.preset")}
                      </button>
                      <button type="button" className="settings-res-btn" disabled>
                        <FaDesktop size={16} />
                        {t("settings.res.preview")}
                      </button>
                    </div>

                    <div className="settings-checkboxes">
                      <label className="settings-checkbox">
                        <input type="checkbox" disabled />
                        <span>{t("settings.res.fullscreen")}</span>
                      </label>
                      <label className="settings-checkbox">
                        <input type="checkbox" disabled />
                        <span>{t("settings.res.lockAspect")}</span>
                      </label>
                    </div>
                  </section>

                  <section className="settings-section">
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <FaCode size={16} />
                      </div>
                      <div>
                        <h3>{t("settings.java.title")}</h3>
                        <p>{t("settings.java.desc")}</p>
                      </div>
                    </div>

                    <input
                      type="text"
                      className="settings-input"
                      placeholder={t("settings.java.placeholder")}
                      value={settings.javaPathOverride ?? ""}
                      onChange={(e) =>
                        updateSettings({
                          javaPathOverride: e.target.value || undefined,
                        })
                      }
                    />
                    <p className="settings-hint">{t("settings.java.hint")}</p>
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
                      <h3>{t("settings.lang.title")}</h3>
                      <p>{t("settings.lang.desc")}</p>
                    </div>
                  </div>

                  <LanguageDropdown value={locale} onChange={handleLanguageChange} />
                </section>
              )}

              {showAccount && (
                <>
                  <section className="settings-section">
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <FaUser size={16} />
                      </div>
                      <div>
                        <h3>{t("settings.account.title")}</h3>
                        <p>{t("settings.account.desc")}</p>
                      </div>
                    </div>

                    {activeAccount ? (
                      <div className="settings-account-card">
                        <div className="settings-account-avatar">
                          <AccountAvatar account={activeAccount} size={48} />
                        </div>
                        <div className="settings-account-meta">
                          <strong>{activeAccount.username}</strong>
                          <span>
                            {activeAccount.mode === "premium"
                              ? t("settings.account.premium")
                              : t("settings.account.offline")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={onLogout}
                        >
                          {t("settings.account.logout")}
                        </button>
                      </div>
                    ) : (
                      <div className="settings-account-empty">
                        <p>{t("settings.account.none")}</p>
                        <span>{t("settings.account.noneHint")}</span>
                      </div>
                    )}
                  </section>

                  {accounts.length > 0 && (
                    <section className="settings-section">
                      <div className="settings-section-head">
                        <div className="settings-section-icon">
                          <FaUser size={16} />
                        </div>
                        <div>
                          <h3>{t("settings.account.saved")}</h3>
                          <p>{accounts.length}</p>
                        </div>
                      </div>

                      <ul className="settings-account-list">
                        {accounts.map((acc) => {
                          const isActive = activeAccount?.id === acc.id;
                          return (
                            <li key={acc.id} className="settings-account-row">
                              <div className="settings-account-avatar settings-account-avatar--sm">
                                <AccountAvatar account={acc} size={32} />
                              </div>
                              <div className="settings-account-meta">
                                <strong>{acc.username}</strong>
                                <span>
                                  {acc.mode === "premium"
                                    ? t("settings.account.premium")
                                    : t("settings.account.offline")}
                                  {isActive ? ` · ${t("settings.account.active")}` : ""}
                                </span>
                              </div>
                              <div className="settings-account-actions">
                                {!isActive && (
                                  <button
                                    type="button"
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => onSelectAccount(acc.id)}
                                  >
                                    {t("settings.account.use")}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() => onRemoveAccount(acc.id)}
                                >
                                  {t("settings.account.remove")}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </>
              )}

              {showDiscord && (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div className="settings-section-icon">
                      <FaDiscord size={16} />
                    </div>
                    <div>
                      <h3>{t("settings.discord.title")}</h3>
                      <p>{t("settings.discord.desc")}</p>
                    </div>
                  </div>

                  <label className="settings-toggle-row">
                    <div>
                      <strong>{t("settings.discord.toggle")}</strong>
                      <span>{t("settings.discord.toggleHint")}</span>
                    </div>
                    <input
                      type="checkbox"
                      className="settings-toggle"
                      checked={discordEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ discordRpcEnabled: enabled });
                        if (!enabled) {
                          void cmd.clearDiscordPresence().catch(console.warn);
                        } else {
                          void cmd
                            .updateDiscordPresence(
                              t("settings.discord.previewDetails"),
                              t("settings.discord.previewState")
                            )
                            .catch(console.warn);
                        }
                      }}
                    />
                  </label>

                  <div className="settings-discord-preview" aria-hidden={!discordEnabled}>
                    <div className="settings-discord-preview-badge">
                      <FaDiscord size={14} />
                      {t("settings.discord.preview")}
                    </div>
                    <div className="settings-discord-preview-card">
                      <img src="/logo.png" alt="" className="settings-discord-preview-logo" />
                      <div>
                        <strong>HyLauncher</strong>
                        <span>{t("settings.discord.previewDetails")}</span>
                        <em>{t("settings.discord.previewState")}</em>
                      </div>
                    </div>
                  </div>

                  <label className="settings-field-label" htmlFor="discord-client-id">
                    {t("settings.discord.clientId")}
                  </label>
                  <input
                    id="discord-client-id"
                    type="text"
                    className="settings-input"
                    placeholder={t("settings.discord.clientIdPlaceholder")}
                    value={settings.discordClientId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value.trim();
                      updateSettings({ discordClientId: id });
                      if (discordEnabled && id) {
                        void cmd
                          .updateDiscordPresence(
                            t("settings.discord.previewDetails"),
                            t("settings.discord.previewState")
                          )
                          .catch(console.warn);
                      }
                    }}
                    disabled={!discordEnabled}
                  />
                  <p className="settings-hint">{t("settings.discord.clientIdHint")}</p>
                </section>
              )}

              {showAbout && (
                <section className="settings-section">
                  <div className="settings-about-card">
                    <img src="/logo.png" alt="HyLauncher" className="settings-about-logo" />
                    <h3>HyLauncher</h3>
                    <p>{t("settings.about.tagline")}</p>
                    <span className="settings-about-version">
                      v1.0.0 · Minecraft 1.20.1 · Fabric
                    </span>
                  </div>
                </section>
              )}

              {search && filteredNav.length === 0 && (
                <p className="settings-empty">{t("settings.empty", { query: search })}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
