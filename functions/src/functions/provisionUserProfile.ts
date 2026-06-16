/**
 * provisionUserProfile — Provisión automática del perfil (Auth trigger onCreate)
 *
 * Red de seguridad: se dispara cuando Firebase Auth crea un usuario y garantiza
 * que SIEMPRE exista su documento `users/{uid}` con el rol asignado por el servidor,
 * aunque el cliente falle entre el alta de Auth y la llamada a upsertUserProfile.
 *
 * Idempotente: si el perfil ya fue creado por la callable, no hace nada.
 * Simétrico a cleanupOnUserDeleted (onDelete). Los triggers de Auth gen1 solo
 * están disponibles en us-central1.
 */

import { region } from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { db } from "../lib/firebase";

export const provisionUserProfile = region("us-central1")
  .auth.user()
  .onCreate(async (user) => {
    const { uid, email, displayName } = user;
    const userRef = db.collection("users").doc(uid);

    const snapshot = await userRef.get();
    if (snapshot.exists) {
      // La callable upsertUserProfile ya creó el perfil (con username del formulario).
      return;
    }

    await userRef.set(
      {
        uid,
        email: email ?? "",
        username: displayName ?? "",
        role: "autor",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Perfil provisionado automáticamente para: ${uid}`);
  });
