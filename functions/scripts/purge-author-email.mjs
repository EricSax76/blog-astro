#!/usr/bin/env node

/**
 * purge-author-email — Elimina el campo authorEmail de la coleccion "posts".
 *
 * El campo se escribia en publishPost (RGPD art. 5.1.c, minimizacion de datos:
 * posts es de lectura publica y no deberia contener el email del autor).
 * publishPost ya no lo escribe; este script limpia los documentos existentes.
 *
 * Por defecto corre en modo --dry-run (no escribe nada, solo cuenta).
 * Requiere Application Default Credentials (`firebase login` +
 * `gcloud auth application-default login`, o --service-account=<ruta>).
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import process from "node:process";

function parseArgs(argv) {
  const options = {
    dryRun: true,
    projectId: "",
    serviceAccountPath: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--execute") {
      options.dryRun = false;
      continue;
    }
    if (arg === "--project-id" || arg.startsWith("--project-id=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      options.projectId = raw;
      continue;
    }
    if (arg === "--service-account" || arg.startsWith("--service-account=")) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      options.serviceAccountPath = raw;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(exitCode) {
  console.log(`
Uso: node functions/scripts/purge-author-email.mjs [opciones]

Opciones:
  --dry-run                     (por defecto) solo cuenta, no escribe.
  --execute                     aplica el borrado del campo authorEmail.
  --project-id=<id>             Firebase project ID (opcional si viene por ADC).
  --service-account=<ruta>      JSON de service account (si no, usa ADC).
  --help                        Muestra esta ayuda.
`);
  process.exit(exitCode);
}

async function createFirebaseContext(options) {
  const appModule = await import("firebase-admin/app");
  const firestoreModule = await import("firebase-admin/firestore");

  const appOptions = {};
  if (options.projectId) appOptions.projectId = options.projectId;

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

  return firestoreModule.getFirestore(app);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = await createFirebaseContext(options);
  const { FieldValue } = await import("firebase-admin/firestore");

  const snapshot = await db.collection("posts").get();
  const affected = snapshot.docs.filter((doc) => "authorEmail" in doc.data());

  console.log(`Posts totales: ${snapshot.size}`);
  console.log(`Posts con authorEmail: ${affected.length}`);

  if (affected.length === 0) {
    console.log("Nada que purgar.");
    return;
  }

  if (options.dryRun) {
    console.log("\n[dry-run] Ningun documento modificado. Ejecuta con --execute para aplicar.");
    for (const doc of affected) {
      console.log(`  - ${doc.id}`);
    }
    return;
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < affected.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of affected.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, { authorEmail: FieldValue.delete() });
    }
    await batch.commit();
    console.log(`Purgados ${Math.min(i + BATCH_SIZE, affected.length)}/${affected.length}`);
  }

  console.log("Listo.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
