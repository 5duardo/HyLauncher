# Cloudflare R2 para los modpacks de HyLauncher

Objetivo: que todos los archivos del pack vivan en **tu** CDN (adiós 429 de
Modrinth y versiones que desaparecen). El launcher no necesita cambios de
código: solo cambia el `baseUrl` del manifest.

## 1. Crear el bucket (consola de Cloudflare)

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**.
2. **Create bucket** → nombre `hylauncher-packs` (minúsculas, único en tu cuenta) →
   ubicación **Automatic** → Create.
3. (Recomendado) **Dominio propio**: dentro del bucket → **Settings** →
   **Public access** → **Custom Domains** → Connect Domain
   (p. ej. `cdn.tudominio.com`; el dominio debe estar en Cloudflare).
   Sin dominio propio: **Settings** → **Public access** →
   **Allow public access via r2.dev** (URL tipo `https://pub-xxxx.r2.dev`).
   Guarda esa URL pública: será tu `R2_PUBLIC_BASE`.
4. CORS: **no hace falta** (el launcher descarga con reqwest, no es navegador).

## 2. Token de API

1. R2 → **Manage API tokens** (o My Profile → API Tokens) → **Create Account API token**.
2. Permisos: **Admin Read & Write** sobre el bucket `hylauncher-packs`.
   Guarda: **Account ID**, **Access Key ID**, **Secret Access Key**
   (el secret solo se muestra una vez).

## 3. Ejecutar la migración (desde la raíz del repo)

PowerShell:

```powershell
$env:R2_ACCOUNT_ID="..."
$env:R2_ACCESS_KEY_ID="..."
$env:R2_SECRET_ACCESS_KEY="..."
$env:R2_BUCKET="hylauncher-packs"
$env:R2_PREFIX="hynilla/4.2.0"
$env:R2_PUBLIC_BASE="https://cdn.tudominio.com"  # o tu URL pub-xxxx.r2.dev

# 1) Ver el plan sin tocar red:
node scripts/r2-migrate.mjs --dry-run

# 2) Subir todo y generar el manifest reescrito:
node scripts/r2-migrate.mjs --overrides-dir ./keo-overrides
```

Notas:

- `--overrides-dir` es la carpeta con los 10 archivos que hoy usan `{baseUrl}`
  (los del release `keo-4.2.0`), organizados en `mods/`, `resourcepacks/` y
  `shaderpacks/`. Sin ella, esos 10 se listan para subirlos a mano y sus URLs
  igual quedan reescritas al layout de R2.
- El script verifica el **sha1** de cada descarga contra el manifest y **salta**
  lo que ya exista en R2 con igual tamaño (re-ejecutable sin costo).
- Layout resultante: `<base>/mods/<file>`,
  `<base>/resourcepacks/<file>`, `<base>/shaderpacks/<file>`, con
  `Cache-Control: public, max-age=31536000, immutable` (las keys llevan versión).
- Salida: `manifest-keo-vanilla.r2.json` con `baseUrl` apuntando a R2 y todas
  las URLs como `{baseUrl}/<categoria>/<archivo>`.

## 4. Activar el nuevo manifest

1. Revisa el diff de `manifest-keo-vanilla.r2.json` (solo deben cambiar `baseUrl`
   y `url`; **sha1/size intactos** → los jugadores NO re-descargan nada).
2. Reemplaza `manifest-keo-vanilla.json` en raíz **y** en
   `src-tauri/resources/`, haz push a `main`.
3. Prueba desde cero (borra `instances/keo-vanilla`): un clic en
   **Instalar y jugar** debe traerlo todo desde R2.

## 5. Actualizar el pack en el futuro

1. Detecta versiones nuevas en Modrinth (catálogo, no CDN).
2. Descarga los jars nuevos, súbelos bajo un **nuevo prefijo**
   (`hynilla/4.3.0/...`) — nunca sobrescribas una versión publicada.
3. Regenera el manifest con el script (o edita a mano), cambia `baseUrl`,
   sube el manifest a GitHub. Los jugadores reciben solo el diff.

Coste orientativo: R2 cobra ~$0.015/GB-mes de almacenamiento y la descarga
(egress) es gratis. 500 MB × versiones publicadas ≈ centavos/mes.
