/**
 * Inicialización de Firebase Admin y helpers compartidos entre funciones.
 */

import * as admin from "firebase-admin";

admin.initializeApp();

export const db = admin.firestore();
export const bucket = admin.storage().bucket();

/** Máximo de escrituras por batch en Firestore. */
const BATCH_LIMIT = 500;

/**
 * Elimina todos los documentos de una colección que coincidan con un campo.
 * Itera en lotes de 500 (límite de Firestore) para soportar volúmenes
 * grandes; un único batch dejaría datos sin borrar y rompería RGPD.
 */
export async function deleteCollection(
  collectionName: string,
  field: string,
  value: string
): Promise<void> {
  const baseQuery = db
    .collection(collectionName)
    .where(field, "==", value)
    .limit(BATCH_LIMIT);

  for (;;) {
    const snapshot = await baseQuery.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // Última página: menos documentos que el límite → no quedan más.
    if (snapshot.size < BATCH_LIMIT) break;
  }
}

/** Obtiene todos los documentos de una colección que coincidan con un campo. */
export async function fetchCollection(
  collectionName: string,
  field: string,
  value: string
): Promise<admin.firestore.DocumentData[]> {
  const snapshot = await db.collection(collectionName).where(field, "==", value).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Elimina todos los archivos de Storage bajo un prefijo dado. */
export async function deleteStorageFiles(prefix: string): Promise<void> {
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((file) => file.delete()));
}
