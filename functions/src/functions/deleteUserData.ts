/**
 * deleteUserData — Derecho de supresión (art. 17 RGPD)
 *
 * Callable function que elimina todos los datos personales de un usuario:
 * posts, comentarios, likes, perfil de Firestore, archivos de Storage y cuenta de Auth.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db, deleteCollection, deleteStorageFiles } from "../lib/firebase";

export const deleteUserData = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para eliminar tus datos.");
  }

  try {
    await deleteCollection("posts", "authorUid", uid);
    await deleteCollection("comments", "authorId", uid);
    await deleteCollection("likes", "userId", uid);
    await db.collection("users").doc(uid).delete();
    await deleteStorageFiles(`blog/posts/${uid}/`);
    await deleteStorageFiles(`users/${uid}/`);
    await admin.auth().deleteUser(uid);

    return { success: true, message: "Todos tus datos han sido eliminados correctamente." };
  } catch (error) {
    console.error("Error al eliminar datos del usuario:", error);
    throw new HttpsError("internal", "Error al eliminar los datos. Por favor, contacta con soporte.");
  }
});
