/**
 * addComment — Publicación de comentarios (art. 5.1.c RGPD)
 *
 * Callable function que valida y crea un comentario o respuesta.
 * El servidor asigna authorId desde el token; el cliente no puede
 * suplantar la identidad del autor ni enviar campos arbitrarios.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

const MAX_COMMENT_LENGTH = 1000;

export const addComment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para comentar.");
  }

  const { postId, title, content, parentId } = (request.data ?? {}) as {
    postId?: string;
    title?: string;
    content?: string;
    parentId?: string;
  };

  if (!postId || typeof postId !== "string" || postId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "postId es obligatorio.");
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new HttpsError("invalid-argument", "El comentario no puede estar vacío.");
  }

  if (content.trim().length > MAX_COMMENT_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `El comentario no puede superar ${MAX_COMMENT_LENGTH} caracteres.`
    );
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() ?? {};
  const authorName =
    userData.username ||
    userData.displayName ||
    request.auth?.token?.email?.split("@")[0] ||
    "Anónimo";

  const commentData: Record<string, any> = {
    postId: postId.trim(),
    title: typeof title === "string" ? title.trim() : "",
    authorId: uid,
    authorName,
    content: content.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (typeof parentId === "string" && parentId.trim().length > 0) {
    commentData.parentId = parentId.trim();
  }

  const docRef = await db.collection("comments").add(commentData);

  return { success: true, commentId: docRef.id };
});
