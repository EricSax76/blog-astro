/**
 * Firebase Cloud Functions — El Alma de las Flores
 * Punto de entrada: re-exporta todas las funciones.
 */

import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

export { deleteUserData } from "./functions/deleteUserData";
export { exportUserData } from "./functions/exportUserData";
export { cleanupOnUserDeleted } from "./functions/cleanupOnUserDeleted";

// Provisión y sincronización del perfil (RGPD art. 5)
// El alta de la cuenta la hace el cliente con el SDK de Auth; el servidor
// provisiona el perfil (rol + username) vía callable y un trigger de respaldo.
export { provisionUserProfile } from "./functions/provisionUserProfile";
export { upsertUserProfile } from "./functions/upsertUserProfile";

// Contenido generado por el usuario
export { publishPost } from "./functions/publishPost";
export { addComment } from "./functions/addComment";
export { deleteComment } from "./functions/deleteComment";
export { toggleLike } from "./functions/toggleLike";
