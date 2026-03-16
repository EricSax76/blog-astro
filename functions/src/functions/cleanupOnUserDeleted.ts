/**
 * cleanupOnUserDeleted — Limpieza automática al eliminar una cuenta (Auth trigger)
 *
 * Se dispara cuando Firebase Auth elimina un usuario. Borra en paralelo
 * todos sus datos de Firestore y Storage para cumplir el principio de
 * minimización del dato (art. 5.1.e RGPD).
 */

import { region } from "firebase-functions/v1";
import { db, deleteCollection, deleteStorageFiles } from "../lib/firebase";

export const cleanupOnUserDeleted = region("us-central1")
  .auth.user()
  .onDelete(async (user) => {
  const { uid } = user;

  try {
    await Promise.allSettled([
      deleteCollection("posts", "authorUid", uid),
      deleteCollection("comments", "authorId", uid),
      deleteCollection("likes", "userId", uid),
      db.collection("users").doc(uid).delete(),
      deleteStorageFiles(`blog/posts/${uid}/`),
      deleteStorageFiles(`users/${uid}/`),
    ]);
    console.log(`Limpieza completada para usuario: ${uid}`);
  } catch (error) {
    console.error(`Error al limpiar datos del usuario ${uid}:`, error);
  }
});
