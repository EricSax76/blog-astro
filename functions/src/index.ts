/**
 * Firebase Cloud Functions — El Alma de las Flores
 * Punto de entrada: re-exporta todas las funciones.
 */

import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

export { deleteUserData } from "./functions/deleteUserData";
export { exportUserData } from "./functions/exportUserData";
export { cleanupOnUserDeleted } from "./functions/cleanupOnUserDeleted";

// Operaciones con datos de usuario (RGPD art. 5)
export { registerUser } from "./functions/registerUser";
export { upsertUserProfile } from "./functions/upsertUserProfile";

// Contenido generado por el usuario
export { publishPost } from "./functions/publishPost";
export { addComment } from "./functions/addComment";
export { deleteComment } from "./functions/deleteComment";
export { toggleLike } from "./functions/toggleLike";
