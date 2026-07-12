# HyLauncher ⚡

HyLauncher es un launcher de Minecraft personalizado y minimalista para Windows, diseñado para entregar una experiencia **100% plug-and-play**. Los usuarios solo abren el launcher, eligen su tipo de cuenta, presionan **Jugar** y entran directo al servidor con todo preconfigurado.

---

## Características Principales

1. **Autenticación Dual**:
   - **Modo Premium**: Login oficial con Microsoft usando OAuth2 Device Code Flow.
   - **Modo No-Premium (Offline)**: Genera UUIDs válidos e idénticos a los del servidor offline utilizando el algoritmo de cifrado MD5 estándar (UUID v3).
2. **Actualización Incremental Inteligente**:
   - Descarga automática de la versión de Minecraft y Fabric Loader especificadas.
   - Sincroniza mods desde Modrinth API o URLs directas.
   - Verifica los archivos locales mediante hashes SHA1 para descargar únicamente las modificaciones o adiciones.
   - Elimina mods antiguos ("huérfanos") automáticamente.
3. **Distribución de Configuración**:
   - Descarga y aplica opciones preconfiguradas (`options.txt`, `servers.dat`, etc.).
   - Permite definir políticas de sobreescritura (`always`, `preserve`).
4. **Independencia de Java**:
   - Autodetecta y utiliza el entorno de ejecución de Java (`javaw`) instalado en el sistema de forma nativa para evitar conflictos de permisos de descarga en Windows.
5. **Estética Premium**:
   - Interfaz moderna en modo oscuro, con efectos de glassmorphism (vidrio esmerilado) e iconos vectoriales sólidos integrados (sin emojis del sistema).

---

## Requisitos de Desarrollo

* **Node.js** v18 o superior.
* **Rust** (cargo, rustc stable).
* **Java 17 JRE/JDK** instalado y añadido al `PATH` del sistema de Windows.

---

## Instrucciones para Compilar y Ejecutar

### Modo Desarrollo
Para ejecutar la aplicación localmente en modo desarrollo con recarga en caliente:
```bash
# Instalar dependencias de Node
npm install

# Iniciar servidor de desarrollo frontend y backend de Tauri
npm run tauri dev
```

### Compilar Instalador de Producción (Windows NSIS)
Para compilar y generar el instalador autoejecutable `.exe`:
```bash
npm run tauri build
```
El instalador final se generará en la carpeta `src-tauri/target/release/bundle/nsis/`.

---

## Login con Microsoft (Premium)

El launcher ya incluye el flujo OAuth2 (Device Code) → Xbox Live → Minecraft Services.

**Por defecto usa el Client ID de [Prism Launcher](https://github.com/PrismLauncher/PrismLauncher)** (open source, ya aprobado por Microsoft para la API de Minecraft). No necesitas registrar Azure ni esperar aprobación para probar login Premium.

### Client ID propio (opcional, para producción)

Si quieres usar tu propia marca/app en Azure:

1. Entra a [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name:** `HyLauncher` (o el nombre de tu servidor).
3. **Supported account types:** *Accounts in any organizational directory and personal Microsoft accounts*.
4. **Redirect URI:** déjalo vacío (no hace falta para Device Code Flow).
5. Clic en **Register**.
6. Copia el **Application (client) ID** (formato UUID).

### Paso 2 — Habilitar flujo público

1. En tu app → **Authentication**.
2. En **Advanced settings** → **Allow public client flows** → **Yes**.
3. Guarda los cambios.

> No necesitas agregar permisos de Microsoft Graph. Los scopes `XboxLive.signin` se piden en el login automáticamente.

### Paso 3 — Solicitar acceso a la API de Minecraft (obligatorio)

Desde 2023, **Microsoft no permite** que apps nuevas de Azure usen `api.minecraftservices.com` sin aprobación previa. Si ves el error *"Invalid app registration"*, es porque falta este paso.

1. Abre el formulario oficial: **[aka.ms/mce-reviewappid](https://aka.ms/mce-reviewappid)**
2. Rellena con los datos de tu app:
   - **Application (client) ID:** el UUID de tu app de Azure (el mismo de `.env`)
   - **Tenant ID:** `consumers` (cuentas personales de Microsoft)
   - Describe HyLauncher como launcher para tu servidor de Minecraft
3. Envía el formulario y **espera la respuesta por correo** (puede tardar días o semanas)
4. Cuando Microsoft apruebe tu app, el login Premium funcionará sin cambiar código

Hasta que aprueben tu app, el flujo llegará hasta Microsoft/Xbox pero fallará al conectar con Minecraft.

### Paso 4 — Configurar Client ID propio (opcional)

Solo si completaste la aprobación de Microsoft, crea `.env`:

```env
MICROSOFT_CLIENT_ID=tu-client-id-aprobado
```

Si **no** tienes `.env` o dejas la variable vacía, se usa el Client ID de Prism automáticamente.

Reinicia el launcher:

```bash
npm run tauri dev
```

### Paso 5 — Iniciar sesión en el launcher

1. Clic en tu perfil / **Iniciar sesión**.
2. Pestaña **Premium** → **Iniciar con Microsoft**.
3. Se muestra un código (ej. `ABCD-1234`).
4. Abre [https://microsoft.com/link](https://microsoft.com/link) en el navegador e ingresa el código.
5. Inicia sesión con la cuenta que **tiene Minecraft Java comprado**.
6. El launcher detectará el login y guardará la cuenta como **Premium**.

### Requisitos de la cuenta

- Debe ser una cuenta **Microsoft** (no solo Xbox).
- Debe tener **Minecraft: Java Edition** comprado en esa cuenta.
- Si la cuenta no tiene el juego, verás: *"Esta cuenta de Microsoft no tiene Minecraft Java comprado"*.

### Producción (instalador .exe)

Para builds de release, el Client ID se puede:

- Leer de `.env` al compilar (`MICROSOFT_CLIENT_ID=... npm run tauri build`), o
- Embeberse en compile-time si defines la variable antes de `cargo build`.

### Bug corregido

El frontend enviaba el código equivocado al hacer polling (`userCode` en lugar de `deviceCode`). Ya está corregido — sin esto el login nunca completaba aunque Azure estuviera bien configurado.

---

## Estructura del Archivo `manifest.json`

El launcher requiere un archivo `manifest.json` hosteado en tu servidor web (o localmente como `manifest-example.json` para pruebas). Ejemplo de esquema:

```json
{
  "packVersion": "1.0.0",
  "packName": "Mi Servidor",
  "packDescription": "Modpack oficial del servidor",
  "minecraft": "1.20.1",
  "fabricLoader": "0.19.3",
  "baseUrl": "https://tuservidor.com/archivos",
  "mods": [
    {
      "id": "fabric-api",
      "filename": "fabric-api-0.92.9+1.20.1.jar",
      "url": "https://cdn.modrinth.com/data/P7dR8mSH/versions/hu6gukgT/fabric-api-0.92.9%2B1.20.1.jar",
      "sha1": "89c79de1c8e17f3d34fded3a2fe401e7e60a707d",
      "size": 2111565,
      "required": true,
      "side": "both"
    }
  ],
  "configs": [
    {
      "path": "options.txt",
      "url": "{baseUrl}/configs/options.txt",
      "sha1": "8f6c...",
      "overwritePolicy": "always"
    }
  ],
  "resourcePacks": [],
  "shaderPacks": [],
  "protectedPaths": [
    "screenshots/",
    "saves/",
    "logs/"
  ],
  "server": {
    "name": "Mi Servidor",
    "address": "play.miservidor.com",
    "port": 25565,
    "autoConnect": true
  },
  "java": {
    "version": 17
  }
}
```

### Explicación de Campos del Manifest:
* `baseUrl`: URL base utilizada para expandir los comodines `{baseUrl}` en las descargas de configuración.
* `overwritePolicy`: `always` para forzar la sobreescritura de archivos en cada arranque, o `preserve` para dejar que el usuario guarde cambios locales.
* `protectedPaths`: Rutas dentro de la carpeta del juego que la sincronización **nunca** eliminará ni modificará (por ejemplo, mundos locales o capturas).
* `autoConnect`: Si está en `true`, el launcher instruirá al juego para conectarse al servidor de forma automática e inmediata al iniciar.
