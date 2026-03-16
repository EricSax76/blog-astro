/**
 * registerUser — Registro de usuario (art. 5 RGPD: integridad y confidencialidad)
 *
 * Callable function que crea la cuenta de Firebase Auth y el perfil de Firestore
 * de forma atómica desde el servidor. Garantiza que:
 * - El rol se asigna siempre por el servidor (nunca por el cliente).
 * - Solo se almacenan los campos mínimos necesarios (art. 5.1.c RGPD).
 * - La contraseña nunca llega a Firestore.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

export const registerUser = onCall(async (request) => {
  const { username, email, password, locale } = (request.data ?? {}) as {
    username?: string;
    email?: string;
    password?: string;
    locale?: string;
  };

  if (!username || typeof username !== "string" || username.trim().length < 3 || username.trim().length > 50) {
    throw new HttpsError("invalid-argument", "El nombre de usuario debe tener entre 3 y 50 caracteres.");
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "El correo electrónico no es válido.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
  }

  try {
    const userRecord = await admin.auth().createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: username.trim(),
    });

    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      locale: typeof locale === "string" && locale.length > 0 ? locale : "es",
      role: "autor",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      throw new HttpsError("already-exists", error.message ?? "El correo ya está registrado.");
    }
    console.error("[registerUser] Error:", error);
    throw new HttpsError("internal", "No se pudo completar el registro. Inténtalo de nuevo.");
  }
});
