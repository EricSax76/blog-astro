/**
 * exportUserData — Derecho de portabilidad (art. 20 RGPD)
 *
 * Callable function que devuelve todos los datos personales del usuario
 * en formato JSON estructurado (perfil, posts, comentarios, likes).
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {CALLABLE_OPTIONS} from "../lib/callableOptions";
import {db, fetchCollection} from "../lib/firebase";
import {enforceRateLimit} from "../lib/rateLimit";

/**
 * Techo del payload inline: la respuesta de un callable capa a 10 MB.
 * Con los límites de contenido actuales (post 10 KB, comentario 1 KB)
 * equivale a ~900 posts — muy por encima del uso esperado. Si alguna
 * cuenta lo alcanza, el export pasa a entregarse manualmente vía soporte.
 */
const MAX_EXPORT_BYTES = 9 * 1024 * 1024;

export const exportUserData = onCall(
  {...CALLABLE_OPTIONS, timeoutSeconds: 120},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado para exportar tus datos.");
    }

    await enforceRateLimit(uid, "exportUserData");

    let exportData;
    try {
      const [userDoc, posts, comments, likes] = await Promise.all([
        db.collection("users").doc(uid).get(),
        fetchCollection("posts", "authorUid", uid),
        fetchCollection("comments", "authorId", uid),
        fetchCollection("likes", "userId", uid),
      ]);

      exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: "El Alma de las Flores — RGPD Art. 20",
        profile: userDoc.exists ? userDoc.data() : null,
        posts,
        comments,
        likes,
      };
    } catch (error) {
      console.error("Error al exportar datos del usuario:", error);
      throw new HttpsError(
        "internal",
        "Error al exportar los datos. Por favor, contacta con soporte."
      );
    }

    const exportBytes = Buffer.byteLength(JSON.stringify(exportData));
    if (exportBytes > MAX_EXPORT_BYTES) {
      console.error(`Export de ${uid} supera el techo inline: ${exportBytes} bytes`);
      throw new HttpsError(
        "resource-exhausted",
        "Tu exportación es demasiado grande para descargarla directamente. " +
          "Contacta con soporte y te la haremos llegar."
      );
    }

    return {success: true, data: exportData};
  }
);
