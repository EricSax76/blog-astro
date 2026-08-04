/**
 * Opciones comunes de todos los callables.
 */

import {CallableOptions} from "firebase-functions/v2/https";

export const CALLABLE_OPTIONS: CallableOptions = {
  enforceAppCheck: true,
  // Sin esta lista firebase-functions refleja cualquier origen (CORS abierto):
  // una página de terceros podría invocar los callables con un token robado.
  // localhost cubre el desarrollo local, que llama a producción (no hay
  // supuestos de emulador en el código shipped).
  cors: [
    "https://el-alma-de-las-flores-blog.web.app",
    "https://el-alma-de-las-flores-blog.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
  ],
};
