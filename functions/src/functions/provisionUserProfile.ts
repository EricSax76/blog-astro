/**
 * provisionUserProfile — Provisión automática del perfil (Auth trigger onCreate)
 *
 * Red de seguridad: se dispara cuando Firebase Auth crea un usuario y garantiza
 * que SIEMPRE exista su documento `users/{uid}` con el rol asignado por el servidor,
 * aunque el cliente falle entre el alta de Auth y la llamada a upsertUserProfile.
 *
 * Idempotente: si el perfil ya fue creado por la callable, no hace nada.
 * Simétrico a cleanupOnUserDeleted (onDelete).
 *
 * gen1 porque gen2 no tiene trigger onCreate de Auth (solo funciones de
 * bloqueo, que exigen Identity Platform). La región va explícita porque
 * setGlobalOptions solo afecta a v2. Firestore y Storage están en
 * europe-southwest1 (Madrid), que solo admite gen2; europe-west1 admite gen1
 * y es donde corren las callables.
 */

import {region} from "firebase-functions/v1";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../lib/firebase";

export const provisionUserProfile = region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    const {uid, email, displayName} = user;
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    console.log(`Perfil provisionado automáticamente para: ${uid}`);
  });
