/**
 * deleteComment — Eliminación de comentarios (art. 17 RGPD: derecho de supresión)
 *
 * Callable function que elimina un comentario solo si el solicitante es su autor.
 * La verificación de propiedad se hace en el servidor para que no pueda ser
 * suplantada desde el cliente.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../lib/firebase";

export const deleteComment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  const { commentId } = (request.data ?? {}) as { commentId?: string };

  if (!commentId || typeof commentId !== "string" || commentId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "commentId es obligatorio.");
  }

  const commentRef = db.collection("comments").doc(commentId.trim());
  const snapshot = await commentRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "El comentario no existe.");
  }

  if (snapshot.data()?.authorId !== uid) {
    throw new HttpsError("permission-denied", "No tienes permiso para eliminar este comentario.");
  }

  await commentRef.delete();

  return { success: true };
});
