# App Check — activación con enforcement

## Estado en el repositorio

La aplicación ya está preparada para exigir App Check:

- `src/scripts/core/firebase-client.ts` inicializa una única instancia de
  Firebase y App Check con `ReCaptchaV3Provider` antes de crear
  clientes de Firestore, Storage o Functions.
- Todas las funciones callable v2 usan `enforceAppCheck: true`.
- La CSP permite las peticiones y recursos que necesita reCAPTCHA v3 y
  el intercambio de tokens con `firebaseappcheck.googleapis.com`.
- La clave de sitio se lee de `PUBLIC_APPCHECK_SITE_KEY`. Es pública por diseño;
  no se debe añadir al repositorio ninguna clave secreta ni una service account.

El repositorio no puede registrar aplicaciones de App Check ni activar el
enforcement de Firestore/Storage: esas acciones cambian el proyecto Firebase y
se hacen en las consolas de Google y Firebase.

## Plan de activación

### 1. Registrar la aplicación web

1. En la consola de reCAPTCHA, crear una clave de tipo **reCAPTCHA v3**. Incluir
   los dominios reales `el-alma-de-las-flores-blog.web.app`, el dominio
   personalizado si existe, y el dominio de preproducción si se usa. Guardar la
   clave de sitio y la clave secreta: la primera es pública y la segunda solo se
   entrega a Firebase App Check.
2. En Firebase Console → **Security → App Check → Apps**, registrar la
   aplicación web con **reCAPTCHA v3** y la clave secreta anterior.
3. Mantener inicialmente el TTL por defecto y el umbral de riesgo predeterminado
   (`0.5`); modificarlo sin observación previa puede bloquear tráfico legítimo.

### 2. Configurar y desplegar el cliente

1. Añadir la clave al secreto/entorno que construye Hosting:

   ```dotenv
   PUBLIC_APPCHECK_SITE_KEY=clave-publica-de-recaptcha-v3
   ```

2. Ejecutar las comprobaciones y desplegar Hosting primero:

   ```bash
   npm run build
   firebase deploy --only hosting
   ```

3. En producción, comprobar que las pestañas Network y Console no muestran
   bloqueos CSP ni errores de App Check, y probar: lectura de portada/archivo,
   inicio y alta de sesión, publicar con imagen, comentario, like, actualización
   de perfil y exportación de datos.

### 3. Activar enforcement

1. Desplegar Functions. Este despliegue hace efectivas las opciones
   `enforceAppCheck: true` de las siete callables (`addComment`,
   `deleteComment`, `deleteUserData`, `exportUserData`, `publishPost`,
   `toggleLike` y `upsertUserProfile`):

   ```bash
   cd functions && npm run build
   firebase deploy --only functions
   ```

2. En Firebase Console → **Security → App Check**, confirmar enforcement para
   **Cloud Firestore** y **Cloud Storage**. El cambio puede tardar hasta
   15 minutos en aplicarse.
3. Durante las primeras 24–48 horas, revisar métricas de App Check para los
   tres productos y los registros de verificación de las callables. Las
   peticiones legítimas deben aparecer como `VALID`; una tasa apreciable de
   `MISSING` o `INVALID` requiere investigar antes de seguir endureciendo
   parámetros.

## Desarrollo local y reversión

- Para desarrollo local, crear y registrar un debug token en Firebase Console →
  App Check → Apps → **Manage debug tokens**. Guardarlo solo en `.env` como
  `APPCHECK_DEBUG_TOKEN`; `Layout.astro` lo publica exclusivamente en modo
  desarrollo, antes de inicializar App Check. No usar ni compartir ese token en
  producción.
- Si la activación causa un incidente, primero pasar Firestore/Storage de nuevo
  a **Unenforced** en la consola. Para las callables, revertir temporalmente el
  despliegue a una versión sin `enforceAppCheck` y corregir la configuración del
  cliente antes de reintentarlo.
- La protección contra repetición no forma parte de este cambio. Para activarla
  en `deleteUserData` y `exportUserData` habría que conceder el rol **Firebase
  App Check Token Verifier**, configurar `consumeAppCheckToken: true` y pedir
  tokens de uso limitado desde el cliente; añade latencia por llamada.

## Referencias oficiales

- Firebase: <https://firebase.google.com/docs/app-check/web/recaptcha-provider>
- Firebase Functions: <https://firebase.google.com/docs/app-check/cloud-functions>
- Firebase enforcement: <https://firebase.google.com/docs/app-check/enable-enforcement>
- CSP de reCAPTCHA: <https://developers.google.com/recaptcha/docs/faq>
