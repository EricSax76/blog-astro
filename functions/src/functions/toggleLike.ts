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

  const id = postId.trim();
  const likeRef = db.collection("likes").doc(`${id}_${uid}`);
  const postRef = db.collection("posts").doc(id);

  // Transacción: el doc de like (saber si ESTE usuario dio like) y el contador
  // denormalizado posts/{id}.likeCount se actualizan atómicamente. La lectura del
  // contador en cliente pasa a ser O(1) (un doc) en vez de escanear la colección.
  const liked = await db.runTransaction(async (tx) => {
    const likeSnap = await tx.get(likeRef);

    if (likeSnap.exists) {
      tx.delete(likeRef);
      tx.update(postRef, {
        likeCount: admin.firestore.FieldValue.increment(-1),
      });
      return false;
    }

    tx.set(likeRef, {
      postId: id,
      userId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(postRef, {
      likeCount: admin.firestore.FieldValue.increment(1),
    });
    return true;
  });

  return { success: true, liked };
});
