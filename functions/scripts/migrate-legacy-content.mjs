#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const ARCHIVE_DIR = path.join(REPO_ROOT, "src/pages/archivo");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const DOTENV_PATH = path.join(REPO_ROOT, ".env");

const DEFAULT_YEARS = [2011, 2012, 2013, 2014, 2015, 2016, 2017];
const MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const H2_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    overwrite: false,
    years: [...DEFAULT_YEARS],
    projectId: "",
    bucket: "",
    serviceAccountPath: "",
    authorUid: process.env.MIGRATION_AUTHOR_UID || "legacy-content",
    authorName: process.env.MIGRATION_AUTHOR_NAME || "Archivo historico",
    authorEmail:
      process.env.MIGRATION_AUTHOR_EMAIL || "legacy@elalmadelasflores.local",
  };

  const takeValue = (arg, index) => {
    const equalIndex = arg.indexOf("=");
    if (equalIndex >= 0) return arg.slice(equalIndex + 1);
    return argv[index + 1] || "";
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--years" || arg.startsWith("--years=")) {
      const raw = takeValue(arg, i);
      if (!raw) throw new Error("Falta valor para --years");
      if (arg === "--years") i += 1;
      options.years = raw
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= 1900 && value <= 3000);
      if (options.years.length === 0) {
        throw new Error("No se pudieron parsear anios validos en --years");
      }
      continue;
    }
    if (arg === "--project-id" || arg.startsWith("--project-id=")) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --project-id");
      if (arg === "--project-id") i += 1;
      options.projectId = raw;
      continue;
    }
    if (arg === "--bucket" || arg.startsWith("--bucket=")) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --bucket");
      if (arg === "--bucket") i += 1;
      options.bucket = raw;
      continue;
    }
    if (
      arg === "--service-account" ||
      arg.startsWith("--service-account=")
    ) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --service-account");
      if (arg === "--service-account") i += 1;
      options.serviceAccountPath = raw;
      continue;
    }
    if (arg === "--author-uid" || arg.startsWith("--author-uid=")) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --author-uid");
      if (arg === "--author-uid") i += 1;
      options.authorUid = raw;
      continue;
    }
    if (arg === "--author-name" || arg.startsWith("--author-name=")) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --author-name");
      if (arg === "--author-name") i += 1;
      options.authorName = raw;
      continue;
    }
    if (arg === "--author-email" || arg.startsWith("--author-email=")) {
      const raw = takeValue(arg, i).trim();
      if (!raw) throw new Error("Falta valor para --author-email");
      if (arg === "--author-email") i += 1;
      options.authorEmail = raw;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return options;
}

function printHelpAndExit(exitCode) {
  console.log(`
Uso:
  node functions/scripts/migrate-legacy-content.mjs [opciones]

Opciones:
  --dry-run                     Solo analiza y muestra resumen.
  --overwrite                   Sobrescribe docs existentes en Firestore.
  --years=2011,2012             Anios a migrar (por defecto 2011..2017).
  --project-id=<id>             Firebase project ID (opcional si viene por env).
  --bucket=<bucket>             Firebase Storage bucket (opcional si viene por env).
  --service-account=<ruta>      JSON de service account (si no, usa ADC).
  --author-uid=<uid>            authorUid a guardar en posts legacy.
  --author-name=<nombre>        authorName a guardar en posts legacy.
  --author-email=<email>        authorEmail a guardar en posts legacy.
  --help                        Muestra esta ayuda.
`);
  process.exit(exitCode);
}

async function loadEnvFile(envPath) {
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sep = trimmed.indexOf("=");
      if (sep <= 0) continue;
      const key = trimmed.slice(0, sep).trim();
      let value = trimmed.slice(sep + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }
}

function decodeHtmlEntities(value) {
  let output = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  output = output.replace(/&#(\d+);/g, (_, decimal) => {
    const codePoint = Number.parseInt(decimal, 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });

  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });

  return output;
}

function htmlToText(html) {
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/(p|div|section|article|blockquote|ul|ol|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(withBreaks);
  const lines = decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  return lines.join("\n\n");
}

function extractPropValue(tag, propName) {
  const doubleQuoted = tag.match(new RegExp(`${propName}\\s*=\\s*"([^"]*)"`, "i"));
  if (doubleQuoted) return doubleQuoted[1].trim();
  const singleQuoted = tag.match(new RegExp(`${propName}\\s*=\\s*'([^']*)'`, "i"));
  if (singleQuoted) return singleQuoted[1].trim();
  return "";
}

function extractArticleBlocks(source) {
  const blocks = [];
  const stack = [];
  const articleTagRe = /<\/?article\b[^>]*>/gi;
  let match;

  while ((match = articleTagRe.exec(source)) !== null) {
    const tag = match[0];
    const tagIndex = match.index;
    const lower = tag.toLowerCase();

    if (lower.startsWith("</article")) {
      const open = stack.pop();
      if (open) {
        blocks.push({
          start: open.start,
          end: articleTagRe.lastIndex,
          html: source.slice(open.start, articleTagRe.lastIndex),
        });
      }
      continue;
    }

    stack.push({ start: tagIndex });
  }

  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}

function extractSocialTags(source) {
  const tags = [];
  const socialTagRe = /<SocialInteractions\b[\s\S]*?\/>/gi;
  let match;
  while ((match = socialTagRe.exec(source)) !== null) {
    const tag = match[0];
    const postId = extractPropValue(tag, "postId");
    const postTitle = extractPropValue(tag, "postTitle");
    if (!postId) continue;
    tags.push({
      index: match.index,
      postId,
      postTitle,
      raw: tag,
    });
  }
  return tags;
}

function resolveArticleForSocialTag(tagIndex, articleBlocks) {
  const direct = articleBlocks.find(
    (block) => tagIndex >= block.start && tagIndex <= block.end
  );
  if (direct) return direct;

  let fallback = null;
  for (const block of articleBlocks) {
    if (block.end <= tagIndex) {
      fallback = block;
      continue;
    }
    break;
  }
  return fallback;
}

function extractFirstImageSrc(articleHtml) {
  const imageSrcRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imageSrcRe.exec(articleHtml)) !== null) {
    const src = String(match[1] || "").trim();
    if (!src) continue;
    if (/^https?:\/\//i.test(src)) continue;
    return src;
  }
  return "";
}

function resolveLocalImagePath(imageSrc) {
  if (!imageSrc) return "";
  if (/^https?:\/\//i.test(imageSrc)) return "";

  let normalized = imageSrc.trim();
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  if (normalized.startsWith("images/")) {
    return path.join(PUBLIC_DIR, normalized);
  }

  if (normalized.startsWith("public/")) {
    return path.join(REPO_ROOT, normalized);
  }

  return path.join(REPO_ROOT, normalized);
}

function extractTitle(articleHtml, fallbackTitle) {
  const match = articleHtml.match(H2_RE);
  if (!match) return fallbackTitle || "Entrada sin titulo";
  const parsed = htmlToText(match[1]).trim();
  return parsed || fallbackTitle || "Entrada sin titulo";
}

function extractDateLabel(articleText) {
  const monthNames = Object.keys(MONTHS).join("|");
  const re = new RegExp(
    `\\b(${monthNames})\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})\\b`,
    "i"
  );
  const match = articleText.match(re);
  return match ? match[0] : "";
}

function parseDateFromLabel(label, fallbackYear) {
  if (!label) {
    return new Date(Date.UTC(fallbackYear, 0, 1, 12, 0, 0));
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const re = new RegExp(
    `\\b(${monthNames})\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})\\b`,
    "i"
  );
  const match = label.match(re);
  if (!match) {
    return new Date(Date.UTC(fallbackYear, 0, 1, 12, 0, 0));
  }

  const month = MONTHS[match[1].toLowerCase()];
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year)
  ) {
    return new Date(Date.UTC(fallbackYear, 0, 1, 12, 0, 0));
  }

  const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(fallbackYear, 0, 1, 12, 0, 0));
  }

  return parsed;
}

function normalizeContent(articleHtml) {
  const withoutHeader = articleHtml.replace(/<header\b[\s\S]*?<\/header>/gi, " ");
  const withoutSocial = withoutHeader.replace(
    /<SocialInteractions\b[\s\S]*?\/>/gi,
    " "
  );
  const withoutArticleTags = withoutSocial
    .replace(/^<article\b[^>]*>/i, " ")
    .replace(/<\/article>\s*$/i, " ");
  const text = htmlToText(withoutArticleTags).trim();
  return text;
}

function sanitizeSegment(value) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "archivo";
}

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

async function parseArchiveYear(year) {
  const sourceFile = path.join(ARCHIVE_DIR, `${year}.astro`);
  const source = await fs.readFile(sourceFile, "utf8");
  const articleBlocks = extractArticleBlocks(source);
  const socialTags = extractSocialTags(source);
  const sourceRel = path.relative(REPO_ROOT, sourceFile);

  const posts = [];

  for (const tag of socialTags) {
    const article = resolveArticleForSocialTag(tag.index, articleBlocks);
    if (!article) {
      console.warn(
        `[warn] No se encontro <article> asociado para postId=${tag.postId} en ${sourceRel}`
      );
      continue;
    }

    const articleText = htmlToText(article.html);
    const dateLabel = extractDateLabel(articleText);
    const parsedDate = parseDateFromLabel(dateLabel, year);
    const title = extractTitle(article.html, tag.postTitle);
    const content = normalizeContent(article.html);
    const imageSrc = extractFirstImageSrc(article.html);
    const localImagePath = resolveLocalImagePath(imageSrc);
    const localImageExists = localImagePath
      ? await fs
          .access(localImagePath)
          .then(() => true)
          .catch(() => false)
      : false;

    posts.push({
      postId: tag.postId,
      title,
      content,
      year,
      createdAtDate: parsedDate,
      createdAtMs: parsedDate.getTime(),
      dateLabel,
      sourceFile: sourceRel,
      imageSrc: imageSrc || "",
      localImagePath: localImageExists ? localImagePath : "",
    });
  }

  return posts;
}

function ensureUniquePostIds(posts) {
  const seen = new Map();
  for (const post of posts) {
    if (!seen.has(post.postId)) {
      seen.set(post.postId, post);
      continue;
    }
    const previous = seen.get(post.postId);
    throw new Error(
      `postId duplicado: "${post.postId}" (${previous.sourceFile} y ${post.sourceFile})`
    );
  }
}

function buildStorageObjectPath(authorUid, post) {
  const basename = path.basename(post.localImagePath || post.imageSrc || "image");
  const safeName = sanitizeSegment(basename);
  return `blog/posts/${authorUid}/legacy/${post.year}/${post.postId}-${safeName}`;
}

function buildDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
}

async function createFirebaseContext(options) {
  const appModule = await import("firebase-admin/app");
  const firestoreModule = await import("firebase-admin/firestore");
  const storageModule = await import("firebase-admin/storage");

  const appOptions = {};
  if (options.projectId) appOptions.projectId = options.projectId;
  if (options.bucket) appOptions.storageBucket = options.bucket;

  if (options.serviceAccountPath) {
    const absPath = path.resolve(process.cwd(), options.serviceAccountPath);
    const raw = await fs.readFile(absPath, "utf8");
    const serviceAccount = JSON.parse(raw);
    appOptions.credential = appModule.cert(serviceAccount);
    if (!appOptions.projectId && serviceAccount.project_id) {
      appOptions.projectId = serviceAccount.project_id;
    }
  } else {
    appOptions.credential = appModule.applicationDefault();
  }

  const app = appModule.getApps().length
    ? appModule.getApps()[0]
    : appModule.initializeApp(appOptions);
  const db = firestoreModule.getFirestore(app);
  const storage = storageModule.getStorage(app);

  const bucketName =
    options.bucket ||
    app.options.storageBucket ||
    process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "";
  if (!bucketName) {
    throw new Error(
      "No se pudo resolver Storage bucket. Usa --bucket o define PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  return {
    db,
    bucket: storage.bucket(bucketName),
    Timestamp: firestoreModule.Timestamp,
    FieldValue: firestoreModule.FieldValue,
  };
}

async function uploadLocalImage(post, context, uploadCache, authorUid) {
  if (!post.localImagePath) return "";
  if (uploadCache.has(post.localImagePath)) {
    return uploadCache.get(post.localImagePath);
  }

  const objectPath = buildStorageObjectPath(authorUid, post);
  const file = context.bucket.file(objectPath);
  const binary = await fs.readFile(post.localImagePath);
  const token = crypto.randomUUID();
  const contentType = contentTypeFromPath(post.localImagePath);

  await file.save(binary, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        sourceFile: path.relative(REPO_ROOT, post.localImagePath),
      },
    },
  });

  const url = buildDownloadUrl(context.bucket.name, objectPath, token);
  uploadCache.set(post.localImagePath, url);
  return url;
}

async function migratePosts(posts, options) {
  const context = await createFirebaseContext(options);
  const uploadCache = new Map();
  let createdOrUpdated = 0;
  let skippedExisting = 0;
  let uploadedImages = 0;

  for (const post of posts) {
    const ref = context.db.collection("posts").doc(post.postId);
    const existing = await ref.get();

    if (existing.exists && !options.overwrite) {
      skippedExisting += 1;
      console.log(`[skip] ${post.postId} (ya existe)`);
      continue;
    }

    let imageUrl = "";
    if (post.localImagePath) {
      const wasCached = uploadCache.has(post.localImagePath);
      imageUrl = await uploadLocalImage(
        post,
        context,
        uploadCache,
        options.authorUid
      );
      if (!wasCached) uploadedImages += 1;
    }

    const payload = {
      title: post.title,
      content: post.content,
      imageUrl,
      authorUid: options.authorUid,
      authorEmail: options.authorEmail,
      authorName: options.authorName,
      year: post.year,
      createdAt: context.Timestamp.fromDate(post.createdAtDate),
      createdAtMs: post.createdAtMs,
      updatedAt: context.FieldValue.serverTimestamp(),
      legacy: {
        source: "astro-archive-migration",
        sourceFile: post.sourceFile,
        originalPostId: post.postId,
        originalDateLabel: post.dateLabel || "",
        originalImageSrc: post.imageSrc || "",
        migratedAtMs: Date.now(),
      },
    };

    await ref.set(payload, { merge: true });
    createdOrUpdated += 1;
    console.log(
      `[ok] ${post.postId} (${post.year})${imageUrl ? " +imagen" : ""}`
    );
  }

  return { createdOrUpdated, skippedExisting, uploadedImages };
}

function printDryRunSummary(posts, options) {
  const postsWithImage = posts.filter((post) => Boolean(post.localImagePath));
  const missingImage = posts.filter((post) => post.imageSrc && !post.localImagePath);
  const byYear = new Map();

  for (const post of posts) {
    byYear.set(post.year, (byYear.get(post.year) || 0) + 1);
  }

  console.log("Dry run completado.");
  console.log(`- Anios: ${options.years.join(", ")}`);
  console.log(`- Posts detectados: ${posts.length}`);
  console.log(`- Posts con imagen local: ${postsWithImage.length}`);
  console.log(`- Imagenes faltantes: ${missingImage.length}`);
  console.log("- Conteo por anio:");
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    console.log(`  ${year}: ${byYear.get(year)}`);
  }

  if (postsWithImage.length > 0) {
    console.log("- Imagenes asociadas:");
    for (const post of postsWithImage) {
      console.log(
        `  ${post.postId} -> ${path.relative(REPO_ROOT, post.localImagePath)}`
      );
    }
  }

  if (missingImage.length > 0) {
    console.log("- Advertencias de imagen:");
    for (const post of missingImage) {
      console.log(`  ${post.postId} -> no existe ${post.imageSrc}`);
    }
  }
}

async function main() {
  await loadEnvFile(DOTENV_PATH);
  const options = parseArgs(process.argv.slice(2));

  if (!options.projectId && process.env.PUBLIC_FIREBASE_PROJECT_ID) {
    options.projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
  }
  if (!options.bucket && process.env.PUBLIC_FIREBASE_STORAGE_BUCKET) {
    options.bucket = process.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
  }

  const years = [...new Set(options.years)].sort((a, b) => a - b);
  const allPosts = [];
  for (const year of years) {
    const filePath = path.join(ARCHIVE_DIR, `${year}.astro`);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      console.warn(`[warn] No existe ${path.relative(REPO_ROOT, filePath)}. Se omite.`);
      continue;
    }

    const yearPosts = await parseArchiveYear(year);
    allPosts.push(...yearPosts);
  }

  ensureUniquePostIds(allPosts);

  if (options.dryRun) {
    printDryRunSummary(allPosts, options);
    return;
  }

  if (!options.projectId) {
    console.warn(
      "[warn] projectId no definido explicitamente. Se usara el resuelto por credenciales."
    );
  }
  if (!options.bucket) {
    console.warn(
      "[warn] bucket no definido explicitamente. Se intentara resolver desde app/env."
    );
  }

  console.log(`Migrando ${allPosts.length} posts legacy a Firestore...`);
  const result = await migratePosts(allPosts, options);
  console.log("Migracion completada.");
  console.log(`- Creados/actualizados: ${result.createdOrUpdated}`);
  console.log(`- Omitidos por existir: ${result.skippedExisting}`);
  console.log(`- Imagenes subidas: ${result.uploadedImages}`);
}

main().catch((error) => {
  console.error("Error en migracion:", error);
  process.exit(1);
});
