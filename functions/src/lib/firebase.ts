/**
 * Inicialización de Firebase Admin y helpers compartidos entre funciones.
 */

import * as admin from "firebase-admin";

admin.initializeApp();

export const db = admin.firestore();
export const bucket = admin.storage().bucket();

/** Elimina todos los documentos de una colección que coincidan con un campo. */
export async function deleteCollection(
  collectionName: string,
  field: string,
  value: string
): Promise<void> {
  const snapshot = await db.collection(collectionName).where(field, "==", value).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
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
