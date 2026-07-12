// ============================================================
// HyLauncher — i18n (es / en)
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as cmd from "./tauri-commands";

export type Locale = "es" | "en";

type Dict = Record<string, string>;

const es: Dict = {
  "title.playing": "HyLauncher — Jugando",
  "title.play": "HyLauncher — Jugar",
  "title.mods": "HyLauncher — Mods ({count})",
  "title.minimize": "Minimizar",
  "title.restore": "Restaurar",
  "title.maximize": "Maximizar",
  "title.close": "Cerrar",

  "nav.play": "Jugar",
  "nav.mods": "Mods",
  "nav.textures": "Texturas",
  "nav.shaders": "Shaders",
  "nav.settings": "Ajustes",

  "welcome.back": "Bienvenido de vuelta,",
  "welcome.player": "Jugador",

  "mods.listTitle": "Listado de Mods",
  "textures.listTitle": "Packs de Texturas",
  "shaders.listTitle": "Packs de Shaders",
  "mods.listSubtitle": "Sincronizados con el servidor ({count} en total)",
  "textures.listSubtitle": "Opciones de apariencia ({count} disponibles)",
  "shaders.listSubtitle": "Efectos visuales avanzados ({count} disponibles)",

  "banner.update": "Actualización disponible: {count} mods por descargar",

  "mods.search": "Buscar mods...",
  "textures.search": "Buscar texturas...",
  "shaders.search": "Buscar shaders...",
  "mods.installing": "Instalando... ({percent}%)",
  "mods.installCount": "Instalar Mods ({count})",
  "mods.upToDate": "Mods al día",
  "mods.col.mod": "Mod",
  "mods.col.file": "Archivo",
  "mods.col.size": "Tamaño",
  "mods.col.type": "Tipo",
  "mods.col.side": "Lado",
  "mods.col.status": "Estado",
  "mods.required": "Requerido",
  "mods.optional": "Opcional",
  "mods.empty": "No se encontraron mods que coincidan con la búsqueda",
  "textures.col.name": "Textura",
  "textures.col.action": "Acción",
  "textures.empty": "No se encontraron texturas",
  "shaders.col.name": "Shader",
  "shaders.empty": "No se encontraron shaders",
  "action.installing": "Instalando...",
  "action.uninstall": "Desinstalar",
  "action.install": "Instalar",

  "play.hello": "Hola, {name}",
  "play.modsOk": "Mods OK",
  "play.pending": "{count} pendientes",
  "play.noSession": "Sin sesión",
  "play.loginToPlay": "Inicia sesión para jugar",
  "play.installModsFirst": "Instalar mods primero",
  "play.autoConnect": " · conexión automática al lanzar",
  "play.goToMods": "Ir a mods",
  "play.ready": "Listo",
  "play.toDownload": "{count} por descargar",
  "play.synced": "Todo sincronizado",
  "play.client": "Cliente",
  "play.pack": "Pack",
  "play.shortcuts": "Accesos",
  "play.modsHint": "Ver lista e instalar",
  "play.texturesHint": "Packs opcionales",
  "play.shadersHint": "Efectos visuales",
  "play.settingsHint": "RAM, Java e idioma",

  "btn.launch": "LANZAR JUEGO",
  "btn.checking": "VERIFICANDO...",
  "btn.installPlay": "INSTALAR Y JUGAR",
  "btn.installMods": "INSTALAR MODS",
  "btn.downloading": "DESCARGANDO...",
  "btn.installing": "INSTALANDO...",
  "btn.verifying": "VERIFICANDO...",
  "btn.launching": "LANZANDO...",
  "btn.playing": "JUGANDO",
  "btn.retry": "REINTENTAR",

  "running.live": "En juego",
  "running.title": "Minecraft está abierto",
  "running.lead":
    "El launcher quedó minimizado. Puedes volver aquí cuando quieras o cerrar el proceso de Minecraft.",
  "running.session": "Sesión",
  "running.activePlayer": "Jugador activo",
  "running.packServer": "Servidor del pack",
  "running.gameWindow": "Ventana de juego",
  "running.gameBg": "Proceso de Minecraft en segundo plano",
  "running.controls": "Controles",
  "running.stop": "Cerrar juego",
  "running.stopping": "Cerrando...",
  "running.openLauncher": "Abrir launcher",
  "running.note":
    "Cerrar juego finaliza el proceso de Minecraft. Abrir launcher solo restaura esta ventana.",

  "account.signIn": "Iniciar sesión",
  "account.clickToEnter": "Haz clic para entrar",
  "account.logout": "Cerrar sesión",
  "account.manage": "Gestionar Cuenta",
  "account.signInTitle": "Iniciar Sesión",
  "account.activeSession": "Sesión Activa",
  "account.logoutBtn": "Cerrar Sesión",

  "offline.username": "Nombre de usuario",
  "offline.rules": "3–16 caracteres. Solo letras, números y guion bajo.",
  "offline.invalid": "Nombre inválido",
  "offline.saving": "Guardando...",
  "offline.enter": "Entrar como Offline",

  "ms.copyTitle": "Clic para copiar",
  "ms.copiedClipboard": "Copiado al portapapeles ✓",
  "ms.instruction":
    "El código se copió y se abrió {link} en tu navegador. Pega el código allí para continuar.",
  "ms.waitingAuth": "Esperando autenticación",
  "ms.cancel": "Cancelar",
  "ms.blurb":
    "Inicia sesión con tu cuenta de Microsoft para jugar con tu perfil premium. Se copiará el código y se abrirá el navegador automáticamente.",
  "ms.connecting": "Conectando...",
  "ms.start": "Iniciar con Microsoft",

  "settings.search": "Buscar ajustes...",
  "settings.protected": "Ajustes protegidos",
  "settings.soon": "Pronto",
  "settings.saving": "Guardando...",
  "settings.saved": "Guardado ✓",
  "settings.footer.rights": "© HyLauncher 2026",
  "settings.footer.disclaimer": "No afiliado a Mojang o Microsoft",
  "settings.nav.game": "Juego",
  "settings.nav.general": "General",
  "settings.nav.account": "Cuenta",
  "settings.nav.storage": "Almacenamiento",
  "settings.nav.notifications": "Notificaciones",
  "settings.nav.discord": "Discord",
  "settings.nav.privacy": "Privacidad",
  "settings.nav.about": "Acerca de",
  "settings.ram.title": "Memoria asignada",
  "settings.ram.desc": "Cuánta RAM asignar a la instancia del juego",
  "settings.ram.free": "Tienes {free} GB libres para asignar",
  "settings.res.title": "Resolución del juego",
  "settings.res.desc": "Resolución de la ventana de Minecraft (próximamente)",
  "settings.res.preset": "Seleccionar preset",
  "settings.res.preview": "Visualizar en pantalla",
  "settings.res.fullscreen": "Iniciar en pantalla completa",
  "settings.res.lockAspect": "Bloquear relación de aspecto",
  "settings.java.title": "Ruta de Java",
  "settings.java.desc": "Override opcional del ejecutable Java",
  "settings.java.placeholder": "Automático — dejar vacío para usar javaw del sistema",
  "settings.java.hint":
    "Solo cámbialo si sabes lo que haces. Por defecto usa el Java del sistema.",
  "settings.lang.title": "Idioma",
  "settings.lang.desc": "Idioma de la interfaz del launcher",
  "settings.about.tagline": "Launcher personalizado para HyServer",
  "settings.empty": 'No se encontraron ajustes para "{query}"',

  "settings.account.title": "Cuenta activa",
  "settings.account.desc": "Gestiona tu sesión de Minecraft",
  "settings.account.none": "No hay sesión iniciada",
  "settings.account.noneHint": "Inicia sesión desde el botón de cuenta arriba a la derecha.",
  "settings.account.active": "Activa",
  "settings.account.use": "Usar",
  "settings.account.remove": "Eliminar",
  "settings.account.logout": "Cerrar sesión",
  "settings.account.saved": "Cuentas guardadas",
  "settings.account.premium": "Premium",
  "settings.account.offline": "Offline",

  "settings.discord.title": "Rich Presence",
  "settings.discord.desc": "Muestra en Discord que estás usando HyLauncher",
  "settings.discord.toggle": "Mostrar estado en Discord",
  "settings.discord.toggleHint":
    "Aparecerá «Usando HyLauncher» mientras el launcher esté abierto, y «Jugando Minecraft» al lanzar el juego.",
  "settings.discord.clientId": "Discord Application ID",
  "settings.discord.clientIdHint":
    "Crea una app en discord.com/developers → Application ID. Discord debe estar abierto.",
  "settings.discord.clientIdPlaceholder": "Ej. 1234567890123456789",
  "settings.discord.preview": "Vista previa",
  "settings.discord.previewDetails": "Usando HyLauncher",
  "settings.discord.previewState": "En el menú",
};

const en: Dict = {
  "title.playing": "HyLauncher — Playing",
  "title.play": "HyLauncher — Play",
  "title.mods": "HyLauncher — Mods ({count})",
  "title.minimize": "Minimize",
  "title.restore": "Restore",
  "title.maximize": "Maximize",
  "title.close": "Close",

  "nav.play": "Play",
  "nav.mods": "Mods",
  "nav.textures": "Textures",
  "nav.shaders": "Shaders",
  "nav.settings": "Settings",

  "welcome.back": "Welcome back,",
  "welcome.player": "Player",

  "mods.listTitle": "Mods List",
  "textures.listTitle": "Texture Packs",
  "shaders.listTitle": "Shader Packs",
  "mods.listSubtitle": "Synced with the server ({count} total)",
  "textures.listSubtitle": "Appearance options ({count} available)",
  "shaders.listSubtitle": "Advanced visual effects ({count} available)",

  "banner.update": "Update available: {count} mods to download",

  "mods.search": "Search mods...",
  "textures.search": "Search textures...",
  "shaders.search": "Search shaders...",
  "mods.installing": "Installing... ({percent}%)",
  "mods.installCount": "Install Mods ({count})",
  "mods.upToDate": "Mods up to date",
  "mods.col.mod": "Mod",
  "mods.col.file": "File",
  "mods.col.size": "Size",
  "mods.col.type": "Type",
  "mods.col.side": "Side",
  "mods.col.status": "Status",
  "mods.required": "Required",
  "mods.optional": "Optional",
  "mods.empty": "No mods matched your search",
  "textures.col.name": "Texture",
  "textures.col.action": "Action",
  "textures.empty": "No textures found",
  "shaders.col.name": "Shader",
  "shaders.empty": "No shaders found",
  "action.installing": "Installing...",
  "action.uninstall": "Uninstall",
  "action.install": "Install",

  "play.hello": "Hello, {name}",
  "play.modsOk": "Mods OK",
  "play.pending": "{count} pending",
  "play.noSession": "Not signed in",
  "play.loginToPlay": "Sign in to play",
  "play.installModsFirst": "Install mods first",
  "play.autoConnect": " · auto-connect on launch",
  "play.goToMods": "Go to mods",
  "play.ready": "Ready",
  "play.toDownload": "{count} to download",
  "play.synced": "Fully synced",
  "play.client": "Client",
  "play.pack": "Pack",
  "play.shortcuts": "Shortcuts",
  "play.modsHint": "Browse and install",
  "play.texturesHint": "Optional packs",
  "play.shadersHint": "Visual effects",
  "play.settingsHint": "RAM, Java & language",

  "btn.launch": "LAUNCH GAME",
  "btn.checking": "CHECKING...",
  "btn.installPlay": "INSTALL & PLAY",
  "btn.installMods": "INSTALL MODS",
  "btn.downloading": "DOWNLOADING...",
  "btn.installing": "INSTALLING...",
  "btn.verifying": "VERIFYING...",
  "btn.launching": "LAUNCHING...",
  "btn.playing": "PLAYING",
  "btn.retry": "RETRY",

  "running.live": "In game",
  "running.title": "Minecraft is open",
  "running.lead":
    "The launcher was minimized. You can come back anytime or close the Minecraft process.",
  "running.session": "Session",
  "running.activePlayer": "Active player",
  "running.packServer": "Pack server",
  "running.gameWindow": "Game window",
  "running.gameBg": "Minecraft process in the background",
  "running.controls": "Controls",
  "running.stop": "Close game",
  "running.stopping": "Closing...",
  "running.openLauncher": "Open launcher",
  "running.note":
    "Close game ends the Minecraft process. Open launcher only restores this window.",

  "account.signIn": "Sign in",
  "account.clickToEnter": "Click to enter",
  "account.logout": "Sign out",
  "account.manage": "Manage Account",
  "account.signInTitle": "Sign In",
  "account.activeSession": "Active Session",
  "account.logoutBtn": "Sign Out",

  "offline.username": "Username",
  "offline.rules": "3–16 characters. Letters, numbers, and underscore only.",
  "offline.invalid": "Invalid name",
  "offline.saving": "Saving...",
  "offline.enter": "Enter as Offline",

  "ms.copyTitle": "Click to copy",
  "ms.copiedClipboard": "Copied to clipboard ✓",
  "ms.instruction":
    "The code was copied and {link} opened in your browser. Paste the code there to continue.",
  "ms.waitingAuth": "Waiting for authentication",
  "ms.cancel": "Cancel",
  "ms.blurb":
    "Sign in with your Microsoft account to play with your premium profile. The code will be copied and the browser will open automatically.",
  "ms.connecting": "Connecting...",
  "ms.start": "Sign in with Microsoft",

  "settings.search": "Search settings...",
  "settings.protected": "Protected settings",
  "settings.soon": "Soon",
  "settings.saving": "Saving...",
  "settings.saved": "Saved ✓",
  "settings.footer.rights": "© HyLauncher 2026",
  "settings.footer.disclaimer": "Not affiliated with Mojang or Microsoft",
  "settings.nav.game": "Game",
  "settings.nav.general": "General",
  "settings.nav.account": "Account",
  "settings.nav.storage": "Storage",
  "settings.nav.notifications": "Notifications",
  "settings.nav.discord": "Discord",
  "settings.nav.privacy": "Privacy",
  "settings.nav.about": "About",
  "settings.ram.title": "Allocated memory",
  "settings.ram.desc": "How much RAM to assign to the game instance",
  "settings.ram.free": "You have {free} GB free to allocate",
  "settings.res.title": "Game resolution",
  "settings.res.desc": "Minecraft window resolution (coming soon)",
  "settings.res.preset": "Select preset",
  "settings.res.preview": "Preview on screen",
  "settings.res.fullscreen": "Start in fullscreen",
  "settings.res.lockAspect": "Lock aspect ratio",
  "settings.java.title": "Java path",
  "settings.java.desc": "Optional Java executable override",
  "settings.java.placeholder": "Automatic — leave empty to use system javaw",
  "settings.java.hint":
    "Only change this if you know what you're doing. Uses system Java by default.",
  "settings.lang.title": "Language",
  "settings.lang.desc": "Launcher interface language",
  "settings.about.tagline": "Custom launcher for HyServer",
  "settings.empty": 'No settings found for "{query}"',

  "settings.account.title": "Active account",
  "settings.account.desc": "Manage your Minecraft session",
  "settings.account.none": "Not signed in",
  "settings.account.noneHint": "Sign in from the account button in the top right.",
  "settings.account.active": "Active",
  "settings.account.use": "Use",
  "settings.account.remove": "Remove",
  "settings.account.logout": "Sign out",
  "settings.account.saved": "Saved accounts",
  "settings.account.premium": "Premium",
  "settings.account.offline": "Offline",

  "settings.discord.title": "Rich Presence",
  "settings.discord.desc": "Show on Discord that you're using HyLauncher",
  "settings.discord.toggle": "Show status on Discord",
  "settings.discord.toggleHint":
    "Shows “Using HyLauncher” while the launcher is open, and “Playing Minecraft” when the game is running.",
  "settings.discord.clientId": "Discord Application ID",
  "settings.discord.clientIdHint":
    "Create an app at discord.com/developers → Application ID. Discord must be open.",
  "settings.discord.clientIdPlaceholder": "e.g. 1234567890123456789",
  "settings.discord.preview": "Preview",
  "settings.discord.previewDetails": "Using HyLauncher",
  "settings.discord.previewState": "In the menu",
};

const DICTS: Record<Locale, Dict> = { es, en };

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    cmd
      .getSettings()
      .then((s) => {
        if (s.language === "en" || s.language === "es") {
          setLocaleState(s.language);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const raw = DICTS[locale][key] ?? DICTS.es[key] ?? key;
      return interpolate(raw, params);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}
