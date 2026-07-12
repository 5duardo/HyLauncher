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
  "banner.launcherUpdate": "Nueva versión del launcher: v{version}",
  "banner.launcherUpdateAction": "Ir a Acerca de en Ajustes para actualizar",

  "splash.starting": "Iniciando HyLauncher...",
  "splash.checking": "Buscando actualizaciones...",
  "splash.downloading": "Descargando actualización v{version}...",
  "splash.installing": "Preparando instalador...",
  "splash.restarting": "Instalador abierto. Cerrando HyLauncher...",
  "splash.installOpened": "Sigue el instalador para terminar. Luego vuelve a abrir HyLauncher.",
  "splash.upToDate": "Estás al día (v{version})",
  "splash.ready": "Listo",
  "splash.error": "No se pudo comprobar la actualización",
  "splash.continue": "Continuar",
  "splash.tip.1": "¿Sabías que puedes cambiar el idioma en Ajustes → General?",
  "splash.tip.2": "HyLauncher sincroniza los mods del servidor automáticamente.",
  "splash.tip.3": "Activa Discord Rich Presence para mostrar que usas HyLauncher.",
  "splash.tip.4": "Los shaders y texturas opcionales están en sus pestañas.",
  "splash.tip.5": "Si el juego se cierra mal, usa Detener en el launcher.",

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
  "view.list": "Vista lista",
  "view.grid": "Vista cuadrícula",
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
  "running.title": "Minecraft en ejecución",
  "running.lead":
    "El proceso del juego está activo.",
  "running.leadConsole": "Sesión de {name} — revisa la consola si algo falla.",
  "running.crashed": "Crash",
  "running.exited": "Cerrado",
  "running.crashTitle": "Minecraft se cerró con error",
  "running.exitTitle": "Minecraft se cerró",
  "running.crashLead":
    "Revisa la consola para ver la causa (Java, mods o crash report).",
  "running.exitLead": "El proceso terminó. Puedes revisar la consola y volver.",
  "running.back": "Volver al menú",
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
    "Si Minecraft no aparece, mira la consola abajo (Java, mods o crash).",
  "running.console": "Consola",
  "running.consoleAuto": "Auto-scroll",
  "running.consoleClear": "Limpiar",
  "running.consoleCopy": "Copiar",
  "running.consoleCopied": "Copiado",
  "running.consoleEmpty": "Esperando salida de Minecraft…",

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
  "settings.java.placeholder": "Automático — Java 17 (Temurin) del launcher",
  "settings.java.hint":
    "Minecraft 1.20.1 necesita Java 17–21. Si dejas vacío, HyLauncher usa/descarga Temurin 17 (no uses Java 25+).",
  "settings.lang.title": "Idioma",
  "settings.lang.desc": "Idioma de la interfaz del launcher",
  "settings.about.tagline": "Launcher personalizado para Minecraft",
  "settings.about.updateTitle": "Actualizar launcher",
  "settings.about.updateDesc":
    "Comprueba GitHub Releases (5duardo/HyLauncher) e instala la versión más reciente",
  "settings.about.checkOnStart": "Buscar actualizaciones al iniciar",
  "settings.about.checkOnStartHint":
    "En el splash de arranque comprueba GitHub y actualiza automáticamente",
  "settings.about.checkNow": "Buscar actualización",
  "settings.about.checking": "Buscando...",
  "settings.about.install": "Instalar v{version}",
  "settings.about.installing": "Descargando instalador...",
  "settings.about.releasePage": "Ver en GitHub",
  "settings.about.upToDate": "Estás al día (v{version})",
  "settings.about.available": "Nueva versión: v{version} — {name}",
  "settings.about.updateStarted":
    "Instalador abierto. Cierra HyLauncher para completar la actualización.",
  "settings.empty": 'No se encontraron ajustes para "{query}"',

  "settings.storage.title": "Almacenamiento",
  "settings.storage.desc": "Espacio usado por el launcher y la instancia",
  "settings.storage.total": "Total aproximado: {size}",
  "settings.storage.instance": "Instancia (mods, configs, mundos)",
  "settings.storage.cache": "Caché de descargas",
  "settings.storage.java": "Java embebido",
  "settings.storage.data": "Datos del launcher",
  "settings.storage.open": "Abrir carpeta",
  "settings.storage.openRoot": "Abrir carpeta del launcher",
  "settings.storage.clearCache": "Vaciar caché",
  "settings.storage.clearLogs": "Borrar logs ({size})",
  "settings.storage.working": "Trabajando...",
  "settings.storage.done": "Listo",
  "settings.storage.loading": "Calculando uso de disco...",

  "settings.notifications.title": "Notificaciones",
  "settings.notifications.desc": "Elige qué avisos quieres ver en el launcher",
  "settings.notifications.updates": "Actualizaciones del launcher",
  "settings.notifications.updatesHint": "Cuando haya una nueva versión en GitHub Releases",
  "settings.notifications.downloads": "Descargas e instalación",
  "settings.notifications.downloadsHint": "Progreso de mods, packs y Java",
  "settings.notifications.game": "Eventos del juego",
  "settings.notifications.gameHint": "Inicio, cierre o errores al lanzar Minecraft",

  "settings.privacy.title": "Privacidad",
  "settings.privacy.desc": "Controla qué datos puede usar HyLauncher",
  "settings.privacy.usage": "Compartir estadísticas de uso",
  "settings.privacy.usageHint": "Anónimo y opcional; desactivado por defecto",
  "settings.privacy.crash": "Informes de errores locales",
  "settings.privacy.crashHint": "Guarda logs en tu PC para diagnosticar fallos",
  "settings.privacy.discord": "Discord Rich Presence",
  "settings.privacy.discordHint": "Muestra en Discord que usas HyLauncher",
  "settings.privacy.note":
    "Las cuentas y tokens se guardan solo en tu equipo. No se envían a servidores de HyLauncher.",

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
    "Se ve en tu perfil de Discord (no en «Juegos registrados»). No hace falta agregar el juego a mano.",
  "settings.discord.preview": "Vista previa",
  "settings.discord.previewDetails": "Usando HyLauncher",
  "settings.discord.previewState": "En el menú",
  "settings.discord.statusOk": "Conectado — mira tu perfil de Discord",
  "settings.discord.statusOff": "Desactivado",
  "settings.discord.statusFail": "No conectado",
  "settings.discord.retry": "Reintentar ahora",
  "settings.discord.where":
    "Dónde mirar: clic en tu avatar de Discord → deberías ver «Jugando HyLauncher» / «Usando HyLauncher». La lista de juegos detectados no aplica.",
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
  "banner.launcherUpdate": "New launcher version: v{version}",
  "banner.launcherUpdateAction": "Open About in Settings to update",

  "splash.starting": "Starting HyLauncher...",
  "splash.checking": "Checking for updates...",
  "splash.downloading": "Downloading update v{version}...",
  "splash.installing": "Preparing installer...",
  "splash.restarting": "Installer opened. Closing HyLauncher...",
  "splash.installOpened": "Finish the installer, then reopen HyLauncher.",
  "splash.upToDate": "You're up to date (v{version})",
  "splash.ready": "Ready",
  "splash.error": "Couldn't check for updates",
  "splash.continue": "Continue",
  "splash.tip.1": "You can change the language in Settings → General.",
  "splash.tip.2": "HyLauncher syncs server mods automatically.",
  "splash.tip.3": "Turn on Discord Rich Presence to show you're using HyLauncher.",
  "splash.tip.4": "Optional shaders and textures live in their tabs.",
  "splash.tip.5": "If the game hangs, use Stop in the launcher.",

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
  "view.list": "List view",
  "view.grid": "Grid view",
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
  "running.title": "Minecraft is running",
  "running.lead": "The game process is active.",
  "running.leadConsole": "{name}'s session — check the console if something fails.",
  "running.crashed": "Crash",
  "running.exited": "Closed",
  "running.crashTitle": "Minecraft closed with an error",
  "running.exitTitle": "Minecraft closed",
  "running.crashLead":
    "Check the console for the cause (Java, mods, or crash report).",
  "running.exitLead": "The process ended. You can review the console and go back.",
  "running.back": "Back to menu",
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
    "If Minecraft doesn't appear, check the console below (Java, mods, or crash).",
  "running.console": "Console",
  "running.consoleAuto": "Auto-scroll",
  "running.consoleClear": "Clear",
  "running.consoleCopy": "Copy",
  "running.consoleCopied": "Copied",
  "running.consoleEmpty": "Waiting for Minecraft output…",

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
  "settings.java.placeholder": "Automatic — launcher Java 17 (Temurin)",
  "settings.java.hint":
    "Minecraft 1.20.1 needs Java 17–21. Leave empty to use/download Temurin 17 (don't use Java 25+).",
  "settings.lang.title": "Language",
  "settings.lang.desc": "Launcher interface language",
  "settings.about.tagline": "Custom Minecraft launcher",
  "settings.about.updateTitle": "Update launcher",
  "settings.about.updateDesc":
    "Check GitHub Releases (5duardo/HyLauncher) and install the latest version",
  "settings.about.checkOnStart": "Check for updates on startup",
  "settings.about.checkOnStartHint":
    "On the startup splash, check GitHub and update automatically",
  "settings.about.checkNow": "Check for update",
  "settings.about.checking": "Checking...",
  "settings.about.install": "Install v{version}",
  "settings.about.installing": "Downloading installer...",
  "settings.about.releasePage": "View on GitHub",
  "settings.about.upToDate": "You're up to date (v{version})",
  "settings.about.available": "New version: v{version} — {name}",
  "settings.about.updateStarted":
    "Installer opened. Close HyLauncher to finish the update.",
  "settings.empty": 'No settings found for "{query}"',

  "settings.storage.title": "Storage",
  "settings.storage.desc": "Disk space used by the launcher and instance",
  "settings.storage.total": "Approx. total: {size}",
  "settings.storage.instance": "Instance (mods, configs, worlds)",
  "settings.storage.cache": "Download cache",
  "settings.storage.java": "Embedded Java",
  "settings.storage.data": "Launcher data",
  "settings.storage.open": "Open folder",
  "settings.storage.openRoot": "Open launcher folder",
  "settings.storage.clearCache": "Clear cache",
  "settings.storage.clearLogs": "Clear logs ({size})",
  "settings.storage.working": "Working...",
  "settings.storage.done": "Done",
  "settings.storage.loading": "Calculating disk usage...",

  "settings.notifications.title": "Notifications",
  "settings.notifications.desc": "Choose which notices you want in the launcher",
  "settings.notifications.updates": "Launcher updates",
  "settings.notifications.updatesHint": "When a new version appears on GitHub Releases",
  "settings.notifications.downloads": "Downloads & install",
  "settings.notifications.downloadsHint": "Progress for mods, packs, and Java",
  "settings.notifications.game": "Game events",
  "settings.notifications.gameHint": "Start, quit, or launch errors for Minecraft",

  "settings.privacy.title": "Privacy",
  "settings.privacy.desc": "Control what data HyLauncher may use",
  "settings.privacy.usage": "Share usage statistics",
  "settings.privacy.usageHint": "Anonymous and optional; off by default",
  "settings.privacy.crash": "Local crash reports",
  "settings.privacy.crashHint": "Keep logs on your PC to diagnose failures",
  "settings.privacy.discord": "Discord Rich Presence",
  "settings.privacy.discordHint": "Show on Discord that you use HyLauncher",
  "settings.privacy.note":
    "Accounts and tokens stay on your device. They are not sent to HyLauncher servers.",

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
    "Shows on your Discord profile (not under Registered Games). No need to add the game manually.",
  "settings.discord.preview": "Preview",
  "settings.discord.previewDetails": "Using HyLauncher",
  "settings.discord.previewState": "In the menu",
  "settings.discord.statusOk": "Connected — check your Discord profile",
  "settings.discord.statusOff": "Disabled",
  "settings.discord.statusFail": "Not connected",
  "settings.discord.retry": "Retry now",
  "settings.discord.where":
    "Where to look: click your Discord avatar — you should see “Playing HyLauncher” / “Using HyLauncher”. The detected games list does not apply.",
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
