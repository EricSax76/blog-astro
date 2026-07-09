# App Check — pendiente de activación manual

El rate limiting por usuario ya está implementado en las callables
(`functions/src/lib/rateLimit.ts`). App Check queda pendiente porque
requiere pasos en la consola de Firebase que no se pueden automatizar
desde el repositorio:

1. Consola Firebase → App Check → registrar la app web con reCAPTCHA v3
   (genera un site key).
2. Añadir al cliente (tras la migración a SDK npm, `firebase/app-check`):

   ```js
   import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

   initializeAppCheck(app, {
     provider: new ReCaptchaV3Provider(import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY),
     isTokenAutoRefreshEnabled: true,
   });
   ```

3. Activar enforcement en las callables:

   ```ts
   export const publishPost = onCall({ enforceAppCheck: true }, async (request) => {
   ```

   Para `deleteUserData` y `exportUserData` valorar además
   `consumeAppCheckToken: true` (replay protection; añade latencia).

4. Activar enforcement también para Firestore y Storage en la consola
   una vez verificado que el token llega desde la web.

Importante: no activar `enforceAppCheck` antes de completar los pasos 1-2,
o todas las llamadas legítimas fallarán.

Recomendación adicional: crear una política TTL en Firestore sobre
`rateLimits.expiresAt` para purgar los contadores caducados
(Consola → Firestore → TTL → colección `rateLimits`, campo `expiresAt`).
