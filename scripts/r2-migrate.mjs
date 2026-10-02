// ============================================================
// HyLauncher — Migración del pack a Cloudflare R2
// ============================================================
// Sube TODOS los archivos del manifest a R2 y genera un manifest
// reescrito con urls "{baseUrl}/<categoria>/<archivo>" (sha1 y sizes
// intactos). Cero dependencias: firma SigV4 manual con node puro.
//
// Uso (PowerShell):
//   $env:R2_ACCOUNT_ID="..."
//   $env:R2_ACCESS_KEY_ID="..."
//   $env:R2_SECRET_ACCESS_KEY="..."
//   $env:R2_BUCKET="hylauncher-packs"
//   $env:R2_PREFIX="hynilla/4.2.0"
//   $env:R2_PUBLIC_BASE="https://cdn.tudominio.com"
//   node scripts/r2-migrate.mjs --dry-run
//   node scripts/r2-migrate.mjs --overrides-dir ./keo-overrides
//
// Flags:
//   --manifest <path>       manifest origen (default: manifest-keo-vanilla.json)
//   --out <path>            manifest reescrito (default: <manifest>.r2.json)
//   --overrides-dir <dir>    carpeta local con los archivos que hoy usan
//                           {baseUrl} (mods/, resourcepacks/, shaderpacks/)
//   --skip-upload           no sube nada, solo genera el manifest reescrito
//   --dry-run               no toca red: muestra plan, bytes y faltantes
//   --concurrency <n>       subidas/descargas en paralelo (default: 6)
//   --no-skip-existing      re-sube aunque el objeto ya exista con igual tamaño
//
// Layout en R2:  <R2_PREFIX>/mods/<file>
//                <R2_PREFIX>/resourcepacks/<file>
//                <R2_PREFIX>/shaderpacks/<file>
// El baseUrl resultante es: <R2_PUBLIC_BASE>/<R2_PREFIX>

import { createHash, createHmac } from "node:crypto";
import { createWriteStream, createReadStream, promises as fs } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) return def;
  return v;
};
const has = (name) => args.includes(name);

const MANIFEST = flag("--manifest", "manifest-keo-vanilla.json");
const OUT = flag("--out", MANIFEST.replace(/\.json$/, ".r2.json"));
const OVERRIDES_DIR = flag("--overrides-dir", "");
const SKIP_UPLOAD = has("--skip-upload");
const DRY_RUN = has("--dry-run");
const CONCURRENCY = parseInt(flag("--concurrency", "6"), 10) || 6;
const SKIP_EXISTING = !has("--no-skip-existing");

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PREFIX = "hynilla/4.2.0",
  R2_PUBLIC_BASE = "",
} = process.env;

if (!DRY_RUN && !SKIP_UPLOAD) {
  for (const v of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (!process.env[v]) {
      console.error(`Falta variable de entorno ${v}. Ver docs/R2_SETUP.md`);
      process.exit(1);
    }
  }
}

// ---------- SigV4 (mínimo para PUT/HEAD en R2) ----------

function amzDates(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  const time =
    `${stamp}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return { stamp, time };
}

function signRequest(method, key, { contentSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", contentLength = "", contentType = "", cacheControl = "" } = {}) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const uri = "/" + [R2_BUCKET, ...key.split("/").map((s) => encodeURIComponent(s))].join("/");
  const { stamp, time } = amzDates();
  const headers = {
    host,
    "x-amz-content-sha256": contentSha256,
    "x-amz-date": time,
  };
  if (contentLength !== "") headers["content-length"] = String(contentLength);
  if (contentType) headers["content-type"] = contentType;
  if (cacheControl) headers["cache-control"] = cacheControl;
  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((n) => `${n}:${String(headers[n]).trim()}\n`).join("");
  const canonical = [
    method, uri, "",
    canonicalHeaders, signedNames.join(";"), contentSha256,
  ].join("\n");
  const scope = `${stamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", time, scope, sha256hex(canonical)].join("\n");
  const kDate = createHmac("sha256", "AWS4" + R2_SECRET_ACCESS_KEY).update(stamp).digest();
  const kService = createHmac("sha256", kDate).update("auto").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedNames.join(";")}, Signature=${signature}`;
  return { host, uri, headers };
}

function sha256hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

function httpsReq({ host, uri, headers, method }, bodyStream) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path: uri, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("timeout")));
    if (bodyStream) bodyStream.pipe(req);
    else req.end();
  });
}

async function s3Head(key) {
  const { host, uri, headers } = signRequest("HEAD", key);
  return httpsReq({ host, uri, headers, method: "HEAD" });
}

async function s3PutFile(key, filePath, size) {
  const sha256 = await hashFile(filePath, "sha256");
  const { host, uri, headers } = signRequest("PUT", key, {
    contentSha256: sha256,
    contentLength: size,
    contentType: "application/octet-stream",
    // Las keys llevan versión (hynilla/4.2.0/...) -> inmutables.
    cacheControl: "public, max-age=31536000, immutable",
  });
  const stream = createReadStream(filePath);
  const res = await httpsReq({ host, uri, headers, method: "PUT" }, stream);
  if (res.status !== 200) {
    throw new Error(`PUT ${key} -> HTTP ${res.status}: ${res.body.toString().slice(0, 300)}`);
  }
}

function hashFile(filePath, algo) {
  return new Promise((resolve, reject) => {
    const h = createHash(algo);
    const s = createReadStream(filePath);
    s.on("data", (c) => h.update(c));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

// ---------- Descarga con reintentos ----------

function fetchToFile(url, dest, expectedSha1) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    const h = createHash("sha1");
    let size = 0;
    const req = https.get(url, { headers: { "User-Agent": "HyLauncher-migrate/1.0" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        out.close();
        fetchToFile(res.headers.location, dest, expectedSha1).then(resolve, reject);
        return;
      }
      if (res.statusCode === 429 || (res.statusCode >= 500 && res.statusCode < 600)) {
        out.close();
        reject(new Error(`HTTP ${res.statusCode} (reintentable)`));
        return;
      }
      if (res.statusCode !== 200) {
        out.close();
        reject(new Error(`HTTP ${res.statusCode} en ${url}`));
        return;
      }
      res.on("data", (c) => {
        h.update(c);
        size += c.length;
      });
      res.pipe(out);
      out.on("finish", () => {
        out.close();
        const got = h.digest("hex");
        if (expectedSha1 && expectedSha1 !== "REPLACE_WITH_ACTUAL_SHA1" && got !== expectedSha1.toLowerCase()) {
          reject(new Error(`sha1 mismatch en ${url}: esperado ${expectedSha1}, got ${got}`));
          return;
        }
        resolve({ size, sha1: got });
      });
    });
    req.on("error", (e) => {
      out.close();
      reject(e);
    });
    req.setTimeout(180000, () => req.destroy(new Error("timeout")));
  });
}

async function withRetry(fn, tries = 4, baseMs = 1500) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.random() * 500));
    }
  }
  throw last;
}

// ---------- Main ----------

const CAT_OF = { mods: "mods", resourcePacks: "resourcepacks", shaderPacks: "shaderpacks" };

async function main() {
  const raw = await fs.readFile(MANIFEST, "utf8");
  const manifest = JSON.parse(raw);
  const prefix = R2_PREFIX.replace(/^\/+|\/+$/g, "");

  // Recolecta jobs: { entry, cat, key, source: "remote"|"override", url }
  const jobs = [];
  const push = (entry, manifestKey) => {
    const cat = CAT_OF[manifestKey];
    const filename = entry.filename;
    const key = `${prefix}/${cat}/${filename}`;
    const isOverride = (entry.url || "").startsWith("{baseUrl}");
    jobs.push({ entry, manifestKey, cat, key, filename, isOverride, url: entry.url });
  };
  for (const m of manifest.mods ?? []) push(m, "mods");
  for (const r of manifest.resourcePacks ?? []) push(r, "resourcePacks");
  for (const s of manifest.shaderPacks ?? []) push(s, "shaderPacks");
  for (const r of manifest.optionalResourcePacks ?? []) push(r, "resourcePacks");
  for (const s of manifest.optionalShaderPacks ?? []) push(s, "shaderPacks");

  // Colisiones: misma key, distinto contenido.
  const byKey = new Map();
  for (const j of jobs) {
    const prev = byKey.get(j.key);
    if (prev && prev.entry.sha1 !== j.entry.sha1) {
      console.error(`COLISIÓN: ${j.key} tiene sha1 distintos (${prev.entry.sha1} vs ${j.entry.sha1}). Renombra uno.`);
      process.exit(1);
    }
    byKey.set(j.key, j);
  }

  const totalBytes = jobs.reduce((a, j) => a + (j.entry.size || 0), 0);
  const overrides = jobs.filter((j) => j.isOverride);
  console.log(`Manifest: ${MANIFEST} | pack ${manifest.packName} v${manifest.packVersion}`);
  console.log(`Jobs: ${jobs.length} archivos (${(totalBytes / 1048576).toFixed(1)} MB), overrides locales: ${overrides.length}`);

  // Localiza overrides en disco.
  const missingOverrides = [];
  for (const j of overrides) {
    const candidates = [
      OVERRIDES_DIR ? path.join(OVERRIDES_DIR, j.cat, j.filename) : "",
      OVERRIDES_DIR ? path.join(OVERRIDES_DIR, j.cat, decodeURIComponent(j.filename)) : "",
    ].filter(Boolean);
    j.localPath = "";
    for (const c of candidates) {
      try {
        await fs.access(c);
        j.localPath = c;
        break;
      } catch { /* sigue */ }
    }
    if (!j.localPath) missingOverrides.push(`${j.cat}/${j.filename}`);
  }

  if (DRY_RUN) {
    console.log("\n--- DRY RUN (sin red) ---");
    console.log(`Subiría ${jobs.length - overrides.length} archivos remotos + ${overrides.length - missingOverrides.length} overrides.`);
    if (missingOverrides.length) {
      console.log(`Faltan en --overrides-dir (${missingOverrides.length}):`);
      for (const m of missingOverrides) console.log(`  - ${m}`);
    }
    console.log(`baseUrl resultante: ${R2_PUBLIC_BASE || "(define R2_PUBLIC_BASE)"}/${prefix}`);
    return;
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "r2mig-"));
  let up = 0, skipped = 0, failed = 0;
  const failures = [];

  const worker = async (j) => {
    const label = `${j.cat}/${j.filename}`;
    try {
      if (!SKIP_UPLOAD) {
        // Si ya existe con igual tamaño, saltar.
        if (SKIP_EXISTING && j.entry.size) {
          try {
            const head = await withRetry(() => s3Head(j.key), 2, 800);
            const len = parseInt(head.headers["content-length"] || "0", 10);
            if (head.status === 200 && len === j.entry.size) {
              skipped++;
              process.stdout.write(`= ${label}\n`);
              return;
            }
          } catch { /* sigue a subir */ }
        }
        if (j.isOverride) {
          if (!j.localPath) throw new Error("override sin archivo local (súbelo manual o pasa --overrides-dir)");
          const st = await fs.stat(j.localPath);
          const sha1 = await hashFile(j.localPath, "sha1");
          if (j.entry.sha1 && j.entry.sha1 !== "REPLACE_WITH_ACTUAL_SHA1" && sha1 !== j.entry.sha1.toLowerCase()) {
            throw new Error(`sha1 local ${sha1} != manifest ${j.entry.sha1}`);
          }
          await withRetry(() => s3PutFile(j.key, j.localPath, st.size));
        } else {
          const dest = path.join(tmp, `${up + skipped + failed}-${path.basename(j.filename).slice(-60)}`);
          const got = await withRetry(() => fetchToFile(j.url, dest, j.entry.sha1));
          await withRetry(() => s3PutFile(j.key, dest, got.size));
          await fs.unlink(dest).catch(() => {});
        }
      }
      up++;
      process.stdout.write(`+ ${label}\n`);
    } catch (e) {
      failed++;
      failures.push(`${label}: ${e.message}`);
      process.stdout.write(`x ${label}: ${e.message}\n`);
    }
  };

  // Pool simple.
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const j = queue.shift();
        await worker(j);
      }
    })
  );

  console.log(`\nSubidos: ${up} | ya existían: ${skipped} | fallidos: ${failed}`);
  if (failures.length) {
    console.log("Fallidos:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  // Reescribe manifest -> {baseUrl}.
  const enc = (s) => encodeURIComponent(s).replace(/'/g, "%27");
  const rewriteUrl = (j) => `{baseUrl}/${j.cat}/${enc(j.filename)}`;
  const out = JSON.parse(JSON.stringify(manifest));
  const apply = (list, manifestKey) => {
    for (const e of list ?? []) {
      const match = jobs.find(
        (x) => x.manifestKey === manifestKey && x.filename === e.filename && x.entry.sha1 === e.sha1
      );
      if (match) e.url = rewriteUrl(match);
    }
  };
  apply(out.mods, "mods");
  apply(out.resourcePacks, "resourcePacks");
  apply(out.shaderPacks, "shaderPacks");
  apply(out.optionalResourcePacks, "resourcePacks");
  apply(out.optionalShaderPacks, "shaderPacks");
  const publicBase = (R2_PUBLIC_BASE || "https://TU-DOMINIO-O-PUB-r2.dev").replace(/\/+$/, "");
  out.baseUrl = `${publicBase}/${prefix}`;
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`Manifest reescrito: ${OUT}`);
  console.log(`baseUrl: ${out.baseUrl}`);
  if (!R2_PUBLIC_BASE) console.log("AVISO: define R2_PUBLIC_BASE y regenera (o edita baseUrl a mano).");
  if (missingOverrides.length) {
    console.log(`\nSube a mano estos ${missingOverrides.length} a R2 bajo ${prefix}/<cat>/ (o repite con --overrides-dir):`);
    for (const m of missingOverrides.slice(0, 20)) console.log(`  - ${m}`);
    if (missingOverrides.length > 20) console.log(`  ... y ${missingOverrides.length - 20} más`);
  }
  console.log("\nSiguiente: revisa el diff del manifest, reemplaza el original + copia en src-tauri/resources/ y haz push.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
