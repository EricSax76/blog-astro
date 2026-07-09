/**
 * Rate limiting por usuario y acción, con ventana fija sobre Firestore.
 *
 * Cada par {uid, acción} tiene un doc en la colección "rateLimits" con el
 * inicio de ventana y el contador. La transacción garantiza atomicidad:
 * peticiones concurrentes no pueden superar el límite.
 *
 * La colección no es accesible desde el cliente (deny-all por defecto en
 * firebase.rules). Recomendado: política TTL de Firestore sobre el campo
 * "expiresAt" para purgar docs antiguos sin coste de mantenimiento.
 */

import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase";

type RateLimitConfig = {
  /** Máximo de llamadas permitidas dentro de la ventana. */
  maxCalls: number;
  /** Duración de la ventana en segundos. */
  windowSeconds: number;
};

/** Límites por acción. Ajustar según uso real observado. */
export const RATE_LIMITS = {
  publishPost: { maxCalls: 10, windowSeconds: 60 * 60 },
  addComment: { maxCalls: 10, windowSeconds: 60 },
  deleteComment: { maxCalls: 20, windowSeconds: 60 },
  toggleLike: { maxCalls: 30, windowSeconds: 60 },
  upsertUserProfile: { maxCalls: 10, windowSeconds: 60 },
  exportUserData: { maxCalls: 5, windowSeconds: 24 * 60 * 60 },
  deleteUserData: { maxCalls: 3, windowSeconds: 24 * 60 * 60 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

/**
 * Lanza resource-exhausted si el usuario supera el límite de la acción.
 * Debe llamarse tras autenticar y antes de ejecutar la lógica de negocio.
 */
export async function enforceRateLimit(
  uid: string,
  action: RateLimitedAction
): Promise<void> {
  const { maxCalls, windowSeconds } = RATE_LIMITS[action];
  const ref = db.collection("rateLimits").doc(`${uid}_${action}`);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStart = typeof data?.windowStart === "number" ? data.windowStart : 0;
    const count = typeof data?.count === "number" ? data.count : 0;

    if (!snap.exists || now - windowStart >= windowMs) {
      tx.set(ref, {
        windowStart: now,
        count: 1,
        // TTL: la ventana ya habrá expirado sobradamente cuando se purgue.
        expiresAt: Timestamp.fromMillis(now + windowMs * 2),
      });
      return;
    }

    if (count >= maxCalls) {
      throw new HttpsError(
        "resource-exhausted",
        "Has hecho demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo."
      );
    }

    tx.update(ref, { count: count + 1 });
  });
}
