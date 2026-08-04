/**
 * deleteUserData — Derecho de supresión (art. 17 RGPD)
 *
 * Callable que elimina la cuenta de Auth del usuario. La limpieza de datos
 * (Firestore, Storage, rateLimits) NO se hace aquí: la hace el trigger
 * cleanupOnUserDeleted, que es idempotente y reintenta ante fallos.
 *
 * Diseño deliberado: borrar aquí las 7 superficies en secuencia dejaba, ante
 * un fallo a medias, un borrado parcial que el rate-limit (3/día) impedía
 * reintentar — exposición RGPD. Con una única operación, o la cuenta cae y
 * la limpieza queda garantizada por los reintentos del trigger, o falla
 * limpio y el usuario puede reintentar.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {CALLABLE_OPTIONS} from "../lib/callableOptions";
import {getAuth} from "firebase-admin/auth";
import {enforceRateLimit} from "../lib/rateLimit";

export const deleteUserData = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para eliminar tus datos.");
  }

  await enforceRateLimit(uid, "deleteUserData");

  try {
    await getAuth().deleteUser(uid);
    return {success: true, message: "Todos tus datos han sido eliminados correctamente."};
  } catch (error) {
    console.error("Error al eliminar la cuenta del usuario:", error);
    throw new HttpsError(
      "internal",
      "Error al eliminar los datos. Por favor, contacta con soporte."
    );
  }
});
