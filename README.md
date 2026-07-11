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
