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
  FaExternalLinkAlt,
  FaFolder,
  FaGamepad,
  FaGlobe,
  FaHdd,
  FaInfoCircle,
  FaLock,
  FaMicrochip,
  FaMoon,
  FaSearch,
  FaShieldAlt,
  FaSync,
  FaTh,
  FaTimes,
  FaTrash,
  FaUser,
} from "react-icons/fa";
import type {
  Account,
  LauncherSettings,
  LauncherUpdateCheck,
  StorageInfo,
} from "../lib/types";
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

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

function StorageSettingsSection({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await cmd.getStorageInfo());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      await refresh();
      setMessage(t("settings.storage.done"));
    } catch (err) {
      setMessage(String(err));
    } finally {
      setBusy(null);
    }
  };

  const total = info?.totalBytes || 1;
  const rows: { label: string; bytes: number; which: "instance" | "cache" | "java" | "data" }[] =
    info
      ? [
          {
            label: t("settings.storage.instance"),
            bytes: info.instanceBytes,
            which: "instance",
          },
          { label: t("settings.storage.cache"), bytes: info.cacheBytes, which: "cache" },
          { label: t("settings.storage.java"), bytes: info.javaBytes, which: "java" },
          { label: t("settings.storage.data"), bytes: info.dataBytes, which: "data" },
        ]
      : [];

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-icon">
          <FaHdd size={16} />
        </div>
        <div>
          <h3>{t("settings.storage.title")}</h3>
          <p>{t("settings.storage.desc")}</p>
        </div>
      </div>

      {info && (
        <>
          <p className="settings-storage-total">
            {t("settings.storage.total", { size: formatBytes(info.totalBytes) })}
          </p>
          <p className="settings-hint settings-storage-path">{info.launcherRoot}</p>

          <div className="settings-storage-list">
            {rows.map((row) => (
              <div key={row.which} className="settings-storage-row">
                <div className="settings-storage-row-top">
                  <strong>{row.label}</strong>
                  <span>{formatBytes(row.bytes)}</span>
                </div>
                <div className="settings-storage-bar">
                  <span style={{ width: `${Math.max(2, (row.bytes / total) * 100)}%` }} />
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => void cmd.openStorageFolder(row.which)}
                >
                  <FaFolder size={12} /> {t("settings.storage.open")}
                </button>
              </div>
            ))}
          </div>

          <div className="settings-storage-actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!!busy}
              onClick={() => void cmd.openStorageFolder("launcher")}
            >
              <FaFolder size={14} /> {t("settings.storage.openRoot")}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy === "cache"}
              onClick={() =>
                void runAction("cache", () => cmd.clearLauncherCache())
              }
            >
              <FaTrash size={14} />{" "}
              {busy === "cache"
                ? t("settings.storage.working")
                : t("settings.storage.clearCache")}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy === "logs"}
              onClick={() =>
                void runAction("logs", () => cmd.clearLauncherLogs())
              }
            >
              <FaTrash size={14} />{" "}
              {busy === "logs"
                ? t("settings.storage.working")
                : t("settings.storage.clearLogs", {
                    size: formatBytes(info.logsBytes),
                  })}
            </button>
          </div>
          {message && <p className="settings-hint">{message}</p>}
        </>
      )}

      {!info && <p className="settings-hint">{t("settings.storage.loading")}</p>}
    </section>
  );
}

function NotificationsSettingsSection({
  settings,
  updateSettings,
  t,
}: {
  settings: LauncherSettings;
  updateSettings: (patch: Partial<LauncherSettings>, autoSave?: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const toggles: {
    key: keyof LauncherSettings;
    title: string;
    hint: string;
    value: boolean;
  }[] = [
    {
      key: "notificationsUpdates",
      title: t("settings.notifications.updates"),
      hint: t("settings.notifications.updatesHint"),
      value: settings.notificationsUpdates !== false,
    },
    {
      key: "notificationsDownloads",
      title: t("settings.notifications.downloads"),
      hint: t("settings.notifications.downloadsHint"),
      value: settings.notificationsDownloads !== false,
    },
    {
      key: "notificationsGame",
      title: t("settings.notifications.game"),
      hint: t("settings.notifications.gameHint"),
      value: settings.notificationsGame !== false,
    },
  ];

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-icon">
          <FaBell size={16} />
        </div>
        <div>
          <h3>{t("settings.notifications.title")}</h3>
          <p>{t("settings.notifications.desc")}</p>
        </div>
      </div>

      {toggles.map((item) => (
        <label key={item.key} className="settings-toggle-row">
          <div>
            <strong>{item.title}</strong>
            <span>{item.hint}</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={item.value}
            onChange={(e) =>
              updateSettings({ [item.key]: e.target.checked } as Partial<LauncherSettings>)
            }
          />
        </label>
      ))}
    </section>
  );
}

function PrivacySettingsSection({
  settings,
  updateSettings,
  t,
}: {
  settings: LauncherSettings;
  updateSettings: (patch: Partial<LauncherSettings>, autoSave?: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-icon">
          <FaLock size={16} />
        </div>
        <div>
          <h3>{t("settings.privacy.title")}</h3>
          <p>{t("settings.privacy.desc")}</p>
        </div>
      </div>

      <label className="settings-toggle-row">
        <div>
          <strong>{t("settings.privacy.usage")}</strong>
          <span>{t("settings.privacy.usageHint")}</span>
        </div>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={!!settings.privacyShareUsage}
          onChange={(e) => updateSettings({ privacyShareUsage: e.target.checked })}
        />
      </label>

      <label className="settings-toggle-row">
        <div>
          <strong>{t("settings.privacy.crash")}</strong>
          <span>{t("settings.privacy.crashHint")}</span>
        </div>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={settings.privacyCrashReports !== false}
          onChange={(e) => updateSettings({ privacyCrashReports: e.target.checked })}
        />
      </label>

      <label className="settings-toggle-row">
        <div>
          <strong>{t("settings.privacy.discord")}</strong>
          <span>{t("settings.privacy.discordHint")}</span>
        </div>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={settings.discordRpcEnabled !== false}
          onChange={(e) => updateSettings({ discordRpcEnabled: e.target.checked })}
        />
      </label>

      <p className="settings-hint">{t("settings.privacy.note")}</p>
    </section>
  );
}

function AboutSettingsSection({
  settings,
  updateSettings,
  t,
}: {
  settings: LauncherSettings;
  updateSettings: (patch: Partial<LauncherSettings>, autoSave?: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [version, setVersion] = useState("…");
  const [check, setCheck] = useState<LauncherUpdateCheck | null>(null);
  const [busy, setBusy] = useState<"check" | "install" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void cmd.getAppVersion().then(setVersion).catch(() => setVersion("1.0.0"));
  }, []);

  const runCheck = async () => {
    setBusy("check");
    setError(null);
    try {
      setCheck(await cmd.checkForLauncherUpdate());
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const runInstall = async () => {
    setBusy("install");
    setError(null);
    try {
      await cmd.installLauncherUpdate();
      setError(t("settings.about.updateStarted"));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="settings-section">
      <div className="settings-about-card">
        <img src="/logo.png" alt="HyLauncher" className="settings-about-logo" />
        <h3>HyLauncher</h3>
        <p>{t("settings.about.tagline")}</p>
        <span className="settings-about-version">
          v{version} · Minecraft 1.20.1 · Fabric
        </span>
      </div>

      <div className="settings-section-head" style={{ marginTop: 20 }}>
        <div className="settings-section-icon">
          <FaSync size={16} />
        </div>
        <div>
          <h3>{t("settings.about.updateTitle")}</h3>
          <p>{t("settings.about.updateDesc")}</p>
        </div>
      </div>

      <label className="settings-toggle-row">
        <div>
          <strong>{t("settings.about.checkOnStart")}</strong>
          <span>{t("settings.about.checkOnStartHint")}</span>
        </div>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={settings.checkUpdatesOnStart !== false}
          onChange={(e) => updateSettings({ checkUpdatesOnStart: e.target.checked })}
        />
      </label>

      <div className="settings-storage-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy !== null}
          onClick={() => void runCheck()}
        >
          <FaSync size={14} />{" "}
          {busy === "check"
            ? t("settings.about.checking")
            : t("settings.about.checkNow")}
        </button>
        {check?.updateAvailable && check.downloadUrl && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy !== null}
            onClick={() => void runInstall()}
          >
            {busy === "install"
              ? t("settings.about.installing")
              : t("settings.about.install", { version: check.latestVersion })}
          </button>
        )}
        {check?.htmlUrl && (
          <a
            className="btn btn--secondary"
            href={check.htmlUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FaExternalLinkAlt size={12} /> {t("settings.about.releasePage")}
          </a>
        )}
      </div>

      {check && !check.updateAvailable && !error && (
        <p className="settings-hint">
          {t("settings.about.upToDate", { version: check.currentVersion })}
        </p>
      )}
      {check?.updateAvailable && (
        <div className="settings-update-notes">
          <strong>
            {t("settings.about.available", {
              version: check.latestVersion,
              name: check.releaseName || check.latestVersion,
            })}
          </strong>
          {check.releaseNotes && (
            <pre className="settings-update-body">{check.releaseNotes.slice(0, 1200)}</pre>
          )}
        </div>
      )}
      {error && <p className="settings-hint">{error}</p>}
    </section>
  );
}

function DiscordSettingsSection({
  discordEnabled,
  updateSettings,
  t,
}: {
  discordEnabled: boolean;
  updateSettings: (patch: Partial<LauncherSettings>, autoSave?: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [status, setStatus] = useState<{
    connected: boolean;
    enabled: boolean;
    lastError: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await cmd.getDiscordStatus();
      setStatus({
        connected: s.connected,
        enabled: s.enabled,
        lastError: s.lastError,
      });
    } catch {
      setStatus({ connected: false, enabled: discordEnabled, lastError: null });
    }
  }, [discordEnabled]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const retry = async () => {
    setBusy(true);
    try {
      await cmd.updateDiscordPresence(
        t("settings.discord.previewDetails"),
        t("settings.discord.previewState")
      );
      await refresh();
    } catch (err) {
      console.warn(err);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = !discordEnabled
    ? t("settings.discord.statusOff")
    : status?.connected
      ? t("settings.discord.statusOk")
      : t("settings.discord.statusFail");

  return (
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
              setStatus({ connected: false, enabled: false, lastError: null });
            } else {
              void retry();
            }
          }}
        />
      </label>

      <div
        className={`settings-discord-status ${
          status?.connected ? "settings-discord-status--ok" : "settings-discord-status--fail"
        }`}
      >
        <span>{statusLabel}</span>
        {status?.lastError && !status.connected && (
          <em>{status.lastError}</em>
        )}
        {discordEnabled && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void retry()}
            disabled={busy}
          >
            {t("settings.discord.retry")}
          </button>
        )}
      </div>

      <p className="settings-hint">{t("settings.discord.where")}</p>

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
    </section>
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
    notificationsUpdates: true,
    notificationsDownloads: true,
    notificationsGame: true,
    privacyShareUsage: false,
    privacyCrashReports: true,
    checkUpdatesOnStart: true,
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
          icon: <FaFolder size={18} />,
        },
        {
          id: "notifications",
          label: t("settings.nav.notifications"),
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
  const showStorage =
    activeTab === "storage" &&
    matches([
      "almacenamiento",
      "storage",
      "cache",
      "disco",
      "disk",
      "carpeta",
      "folder",
      "logs",
    ]);
  const showNotifications =
    activeTab === "notifications" &&
    matches(["notificaciones", "notifications", "avisos", "alertas"]);
  const showPrivacy =
    activeTab === "privacy" &&
    matches(["privacidad", "privacy", "datos", "crash", "telemetria", "telemetry"]);
  const showAbout =
    activeTab === "about" &&
    matches(["acerca", "about", "launcher", "hy", "actualizar", "update", "version"]);

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
                <DiscordSettingsSection
                  discordEnabled={discordEnabled}
                  updateSettings={updateSettings}
                  t={t}
                />
              )}

              {showStorage && <StorageSettingsSection t={t} />}

              {showNotifications && (
                <NotificationsSettingsSection
                  settings={settings}
                  updateSettings={updateSettings}
                  t={t}
                />
              )}

              {showPrivacy && (
                <PrivacySettingsSection
                  settings={settings}
                  updateSettings={updateSettings}
                  t={t}
                />
              )}

              {showAbout && (
                <AboutSettingsSection
                  settings={settings}
                  updateSettings={updateSettings}
                  t={t}
                />
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
