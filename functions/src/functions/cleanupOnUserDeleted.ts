/**
 * cleanupOnUserDeleted — Limpieza automática al eliminar una cuenta (Auth trigger)
 *
 * Se dispara cuando Firebase Auth elimina un usuario (tanto desde
 * deleteUserData como desde la consola). Es la ÚNICA ruta de limpieza de
 * datos: borra Firestore, Storage y los docs de rateLimits del usuario.
 *
 * failurePolicy es imprescindible: sin él, un trigger gen1 que lanza error
 * NO se reintenta — el rethrow sería solo un log. Con él, GCF reintenta la
 * limpieza (idempotente) hasta que complete.
 */

import {region} from "firebase-functions/v1";
import {db, deleteCollection, deleteStorageFiles} from "../lib/firebase";
import {RATE_LIMITS} from "../lib/rateLimit";

/** Borra los docs de rateLimits del usuario (id = `${uid}_${acción}`). */
async function deleteRateLimitDocs(uid: string): Promise<void> {
  const batch = db.batch();
  for (const action of Object.keys(RATE_LIMITS)) {
    batch.delete(db.collection("rateLimits").doc(`${uid}_${action}`));
  }
  await batch.commit();
}

export const cleanupOnUserDeleted = region("us-central1")
  .runWith({failurePolicy: true, timeoutSeconds: 540})
  .auth.user()
  .onDelete(async (user) => {
    const {uid} = user;

    // Se intentan todas las limpiezas (son idempotentes) y después se falla
    // en bloque si alguna no terminó: tragarse un fallo parcial dejaría datos
    // personales residuales sin reintento, incumpliendo el art. 17 RGPD.
    const tasks: Array<[string, Promise<unknown>]> = [
      ["posts", deleteCollection("posts", "authorUid", uid)],
      ["comments", deleteCollection("comments", "authorId", uid)],
      ["likes", deleteCollection("likes", "userId", uid)],
      ["perfil", db.collection("users").doc(uid).delete()],
      ["rateLimits", deleteRateLimitDocs(uid)],
      ["storage:blog", deleteStorageFiles(`blog/posts/${uid}/`)],
      ["storage:users", deleteStorageFiles(`users/${uid}/`)],
    ];

    const results = await Promise.allSettled(tasks.map(([, promise]) => promise));
    const failures = results
      .map((result, i) => ({result, name: tasks[i][0]}))
      .filter(({result}) => result.status === "rejected");

    if (failures.length > 0) {
      failures.forEach(({name, result}) => {
        console.error(
          `Fallo limpiando "${name}" del usuario ${uid}:`,
          (result as PromiseRejectedResult).reason
        );
      });
      throw new Error(
        `Limpieza incompleta para ${uid}: fallaron ${failures
          .map(({name}) => name)
          .join(", ")}`
      );
    }

    console.log(`Limpieza completada para usuario: ${uid}`);
  });
