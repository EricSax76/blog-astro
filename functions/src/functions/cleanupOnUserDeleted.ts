/**
 * cleanupOnUserDeleted — Limpieza automática al eliminar una cuenta (Auth trigger)
 *
 * Se dispara cuando Firebase Auth elimina un usuario. Borra en paralelo
 * todos sus datos de Firestore y Storage para cumplir el principio de
 * minimización del dato (art. 5.1.e RGPD).
 */

import { region } from "firebase-functions/v1";
import { db, deleteCollection, deleteStorageFiles } from "../lib/firebase";

export const cleanupOnUserDeleted = region("us-central1")
  .auth.user()
  .onDelete(async (user) => {
  const { uid } = user;

  // Se intentan todas las limpiezas (son idempotentes) y después se falla
  // en bloque si alguna no terminó: tragarse un fallo parcial dejaría datos
  // personales residuales sin reintento, incumpliendo el art. 17 RGPD.
  const tasks: Array<[string, Promise<unknown>]> = [
    ["posts", deleteCollection("posts", "authorUid", uid)],
    ["comments", deleteCollection("comments", "authorId", uid)],
    ["likes", deleteCollection("likes", "userId", uid)],
    ["perfil", db.collection("users").doc(uid).delete()],
    ["storage:blog", deleteStorageFiles(`blog/posts/${uid}/`)],
    ["storage:users", deleteStorageFiles(`users/${uid}/`)],
  ];

  const results = await Promise.allSettled(tasks.map(([, promise]) => promise));
  const failures = results
    .map((result, i) => ({ result, name: tasks[i][0] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    failures.forEach(({ name, result }) => {
      console.error(
        `Fallo limpiando "${name}" del usuario ${uid}:`,
        (result as PromiseRejectedResult).reason
      );
    });
    throw new Error(
      `Limpieza incompleta para ${uid}: fallaron ${failures
        .map(({ name }) => name)
        .join(", ")}`
    );
  }

  console.log(`Limpieza completada para usuario: ${uid}`);
});
