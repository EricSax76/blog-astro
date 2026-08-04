/**
 * Inicialización de Firebase Admin y helpers compartidos entre funciones.
 */

import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldPath} from "firebase-admin/firestore";
import type {DocumentData} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

initializeApp();

export const db = getFirestore();
export const bucket = getStorage().bucket();

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

/**
 * Obtiene todos los documentos de una colección que coincidan con un campo.
 * Pagina con cursor para que una cuenta con miles de documentos no cargue
 * la colección entera en una sola query.
 */
export async function fetchCollection(
  collectionName: string,
  field: string,
  value: string
): Promise<DocumentData[]> {
  const results: DocumentData[] = [];
  let query = db
    .collection(collectionName)
    .where(field, "==", value)
    .orderBy(FieldPath.documentId())
    .limit(BATCH_LIMIT);

  for (;;) {
    const snapshot = await query.get();
    snapshot.docs.forEach((doc) => results.push({id: doc.id, ...doc.data()}));
    if (snapshot.size < BATCH_LIMIT) break;
    query = query.startAfter(snapshot.docs[snapshot.size - 1]);
  }

  return results;
}

/** Deletes concurrentes máximos contra Storage. */
const STORAGE_DELETE_CONCURRENCY = 25;

/**
 * Elimina todos los archivos de Storage bajo un prefijo dado.
 * Lista por páginas y borra en lotes acotados: un prefijo con miles de
 * archivos no debe traducirse en miles de peticiones simultáneas.
 */
export async function deleteStorageFiles(prefix: string): Promise<void> {
  let pageToken: string | undefined;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      prefix,
      maxResults: 100,
      autoPaginate: false,
      pageToken,
    });

    for (let i = 0; i < files.length; i += STORAGE_DELETE_CONCURRENCY) {
      await Promise.all(
        files.slice(i, i + STORAGE_DELETE_CONCURRENCY).map((file) => file.delete())
      );
    }

    pageToken = (nextQuery as {pageToken?: string} | null)?.pageToken;
  } while (pageToken);
}
