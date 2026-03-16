/**
 * exportUserData — Derecho de portabilidad (art. 20 RGPD)
 *
 * Callable function que devuelve todos los datos personales del usuario
 * en formato JSON estructurado (perfil, posts, comentarios, likes).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, fetchCollection } from "../lib/firebase";

export const exportUserData = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para exportar tus datos.");
  }

  try {
    const [userDoc, posts, comments, likes] = await Promise.all([
      db.collection("users").doc(uid).get(),
      fetchCollection("posts", "authorUid", uid),
      fetchCollection("comments", "authorId", uid),
      fetchCollection("likes", "userId", uid),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: "El Alma de las Flores — RGPD Art. 20",
      profile: userDoc.exists ? userDoc.data() : null,
      posts,
      comments,
      likes,
    };

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Error al exportar datos del usuario:", error);
    throw new HttpsError("internal", "Error al exportar los datos. Por favor, contacta con soporte.");
  }
});
