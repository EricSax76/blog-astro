/**
 * toggleLike — Me gusta (art. 5.1.c RGPD)
 *
 * Callable function que activa o desactiva el "me gusta" de un usuario en un post.
 * El servidor fija userId desde el token; el cliente no puede asignar likes a otros.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

export const toggleLike = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para dar me gusta.");
  }

  const { postId } = (request.data ?? {}) as { postId?: string };

  if (!postId || typeof postId !== "string" || postId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "postId es obligatorio.");
  }

  const likeDocId = `${postId.trim()}_${uid}`;
  const likeRef = db.collection("likes").doc(likeDocId);
  const snapshot = await likeRef.get();

  if (snapshot.exists) {
    await likeRef.delete();
    return { success: true, liked: false };
  }

  await likeRef.set({
    postId: postId.trim(),
    userId: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, liked: true };
});
