/**
 * upsertUserProfile — Sincronización controlada del perfil (art. 5.1.c RGPD)
 *
 * Callable function que actualiza campos de sesión en el perfil del usuario.
 * El servidor controla qué campos pueden escribirse; el cliente nunca toca
 * directamente el documento de Firestore ni puede cambiar su propio rol.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

export const upsertUserProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  const { displayName } = (request.data ?? {}) as { displayName?: string };

  const userRef = db.collection("users").doc(uid);
  const snapshot = await userRef.get();

  const payload: Record<string, any> = {
    uid,
    email: request.auth?.token?.email ?? "",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (typeof displayName === "string" && displayName.trim().length > 0) {
    payload.displayName = displayName.trim().substring(0, 50);
  }

  if (!snapshot.exists) {
    payload.role = "autor";
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.lastLoginAt = admin.firestore.FieldValue.serverTimestamp();
  } else {
    payload.lastLoginAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(payload, { merge: true });

  return { success: true };
});
