/**
 * addComment — Publicación de comentarios (art. 5.1.c RGPD)
 *
 * Callable function que valida y crea un comentario o respuesta.
 * El servidor asigna authorId desde el token; el cliente no puede
 * suplantar la identidad del autor ni enviar campos arbitrarios.
 * Se comprueba que el post existe y, en respuestas, que el comentario
 * padre existe y pertenece al mismo post (evita huérfanos y cruces).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";
import { requireAllowedKeys, cleanOptionalText, stripHtml } from "../lib/validation";

const MAX_COMMENT_LENGTH = 1000;
const MAX_TITLE_LENGTH = 200;

export const addComment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para comentar.");
  }

  requireAllowedKeys(request.data, ["postId", "title", "content", "parentId"]);

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

  const safeContent = stripHtml(content);
  if (safeContent.length === 0) {
    throw new HttpsError("invalid-argument", "El comentario no puede estar vacío.");
  }

  const cleanPostId = postId.trim();

  const postDoc = await db.collection("posts").doc(cleanPostId).get();
  if (!postDoc.exists) {
    throw new HttpsError("not-found", "La publicación no existe.");
  }

  const cleanParentId =
    typeof parentId === "string" && parentId.trim().length > 0
      ? parentId.trim()
      : null;

  if (cleanParentId) {
    const parentDoc = await db.collection("comments").doc(cleanParentId).get();
    if (!parentDoc.exists) {
      throw new HttpsError("not-found", "El comentario al que respondes no existe.");
    }
    if (parentDoc.data()?.postId !== cleanPostId) {
      throw new HttpsError(
        "invalid-argument",
        "El comentario padre pertenece a otra publicación."
      );
    }
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() ?? {};
  const authorName =
    userData.username ||
    userData.displayName ||
    request.auth?.token?.email?.split("@")[0] ||
    "Anónimo";

  const commentData: Record<string, any> = {
    postId: cleanPostId,
    title: cleanOptionalText(title, "El título", MAX_TITLE_LENGTH),
    authorId: uid,
    authorName,
    content: safeContent,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (cleanParentId) {
    commentData.parentId = cleanParentId;
  }

  const docRef = await db.collection("comments").add(commentData);

  return { success: true, commentId: docRef.id };
});
