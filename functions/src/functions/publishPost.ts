/**
 * publishPost — Publicación de entradas del blog (art. 5.1.f RGPD)
 *
 * Callable function que crea una entrada en la colección "posts".
 * El servidor fija authorUid desde el token de autenticación, impidiendo
 * que el cliente suplanente la autoría de otro usuario.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

export const publishPost = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para publicar.");
  }

  const { title, content, imageUrl, year } = (request.data ?? {}) as {
    title?: string;
    content?: string;
    imageUrl?: string;
    year?: number;
  };

  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanContent = typeof content === "string" ? content.trim() : "";
  const cleanImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";

  if (!cleanTitle && !cleanContent && !cleanImageUrl) {
    throw new HttpsError("invalid-argument", "Añade un título, contenido o imagen antes de publicar.");
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() ?? {};
  const authorName =
    userData.username ||
    userData.displayName ||
    request.auth?.token?.email?.split("@")[0] ||
    "Autor";

  const docRef = await db.collection("posts").add({
    title: cleanTitle,
    content: cleanContent,
    imageUrl: cleanImageUrl,
    authorUid: uid,
    authorEmail: request.auth?.token?.email ?? "",
    authorName,
    year: typeof year === "number" ? year : new Date().getFullYear(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, postId: docRef.id };
});
