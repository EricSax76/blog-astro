# Auditoria general - Astro + Firebase

Fecha: 2026-07-09  
Alcance: rendimiento, UX/UI, reglas Firebase, Cloud Functions y dependencias.

## Resumen ejecutivo

El proyecto compila correctamente tanto en Astro como en Functions, pero no esta listo para produccion sin endurecer seguridad y despliegue. Los riesgos principales son:

- Las reglas de Firestore permiten escrituras directas del cliente en `posts`, `comments` y `likes`, saltandose la validacion que existe en Cloud Functions.
- Las callable functions no tienen App Check, replay protection ni rate limiting por usuario, lo que deja el backend expuesto a abuso desde clientes no legitimos con una cuenta valida.
- `publishPost` acepta `imageUrl` arbitrario y no limita tamano de titulo/contenido, mientras Storage permite cualquier `image/*`, incluido SVG.
- El despliegue SSR no esta cableado en `firebase.json`: hay `output: "server"` y adapter Node, pero no hay configuracion de Hosting/web frameworks o rewrite al servidor.
- Rendimiento: el build cliente pesa 26 MB, casi todo por `public/images`; hay imagenes de hasta 2.6 MB y videos copiados aunque no todos parecen criticos para el primer render.
- UX/UI: la base visual es consistente, pero hay friccion en flujos de autor, botones con textos fijos/desactualizables y menu movil sin focus trap completo.

## Verificacion ejecutada

- `npm install` en raiz y `functions/`.
- `npm run build` en raiz: OK. Resultado: 0 errores, 0 warnings, 6 hints.
- `npm run build` en `functions/`: OK.
- `npm audit --omit=dev` en raiz: 12 vulnerabilidades productivas, 6 high.
- `npm audit --omit=dev` en `functions/`: 19 vulnerabilidades productivas, 1 critical y 5 high.

Nota: `npm install` normalizo `functions/package-lock.json` de `engines.node = "24"` a `"20"`, alineado con `functions/package.json`.

## Hallazgos criticos y altos

### A1. Firestore permite saltarse las Cloud Functions

Severidad: Alta  
Ubicacion: `firebase.rules:51`, `firebase.rules:72`, `firebase.rules:79`

Evidencia:

```js
match /posts/{postId} {
  allow read: if true;
  allow create: if isCreatingOwnPost()
    && !request.resource.data.keys().hasAny(["likeCount"]);
  allow update: if isPostOwner()
    && request.resource.data.authorUid == resource.data.authorUid
    && likeCountUntouchedOnUpdate();
  allow delete: if isPostOwner();
}

match /likes/{likeId} {
  allow read: if true;
  allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
  allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
}

match /comments/{commentId} {
  allow read: if true;
  allow create: if isSignedIn() && request.resource.data.authorId == request.auth.uid;
  allow delete: if isSignedIn() && resource.data.authorId == request.auth.uid;
}
```

Impacto: cualquier usuario autenticado puede escribir directamente en Firestore con el SDK cliente y evitar limites/sanitizacion de `publishPost`, `addComment`, `toggleLike` y `deleteComment`.

Recomendacion: si la fuente de verdad de escritura son las Functions, cambiar `posts`, `comments` y `likes` a `allow write: if false` salvo lecturas publicas. Si se quieren mantener escrituras cliente, duplicar en reglas un esquema estricto: campos permitidos, tipos, longitudes maximas, `createdAt == request.time`, `year` valido y `likeId == "${postId}_${uid}"`.

### A2. Callables sin App Check ni rate limiting

Severidad: Alta  
Ubicacion: `functions/src/functions/publishPost.ts:13`, `functions/src/functions/addComment.ts:27`, `functions/src/functions/toggleLike.ts:12`, `functions/src/functions/upsertUserProfile.ts:13`, `functions/src/functions/exportUserData.ts:11`, `functions/src/functions/deleteUserData.ts:12`

Evidencia:

```ts
export const publishPost = onCall(async (request) => {
```

Impacto: Auth evita usuarios anonimos, pero no evita automatizacion desde scripts propios con cuentas validas. Riesgos: spam, coste de Firestore/Functions/Storage, abuso de export/delete y reputacion del contenido.

Recomendacion:

- Activar App Check en web y usar `onCall({ enforceAppCheck: true }, ...)`.
- Para endpoints sensibles (`deleteUserData`, `exportUserData`) valorar replay protection (`consumeAppCheckToken`) sabiendo que anade latencia.
- Implementar rate limiting por `uid` y accion con transaccion Firestore o un servicio dedicado. Ejemplos: comentarios/minuto, posts/dia, likes/segundo, exportaciones/dia.

Referencia: Firebase documenta enforcement de App Check para Cloud Functions y replay protection para callable functions.

### A3. `publishPost` acepta URLs e inputs sin validacion fuerte

Severidad: Alta  
Ubicacion: `functions/src/functions/publishPost.ts:19`, `functions/src/functions/publishPost.ts:29`, `functions/src/functions/publishPost.ts:45`

Evidencia:

```ts
const { title, content, imageUrl } = (request.data ?? {}) as {
  title?: string;
  content?: string;
  imageUrl?: string;
};

const cleanImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";

const docRef = await db.collection("posts").add({
  title: cleanTitle,
  content: cleanContent,
  imageUrl: cleanImageUrl,
```

Impacto: un usuario autenticado puede publicar imagenes externas, URLs de tracking o payloads muy grandes en `title/content`, degradando rendimiento, privacidad y coste. El cliente renderiza `post.imageUrl` como `img.src` en `src/scripts/posts/archive/yearbook.ts:116` y `src/scripts/posts/my-posts/ui.ts:81`.

Recomendacion: aceptar `imagePath` en vez de URL publica, validar prefijo `blog/posts/{uid}/`, bucket del proyecto y tipo permitido. Aplicar limites de servidor: titulo <= 120 caracteres, contenido <= N caracteres, imagen opcional solo si pertenece al usuario. Rechazar campos extra.

### A4. Storage acepta cualquier `image/*`, incluido SVG

Severidad: Alta/Media  
Ubicacion: `storage.rules:13`, `storage.rules:19`, `src/scripts/posts/publish/editor.ts:178`

Evidencia:

```js
request.resource.contentType.matches('image/.*')
```

```ts
if (file && file.type && !file.type.startsWith("image/")) {
```

Impacto: `image/svg+xml` queda permitido. Aunque un SVG en `<img>` normalmente no ejecuta script como documento embebido, el archivo queda publicamente accesible en Storage y puede abrirse directamente. Ademas, `contentType` es metadato del upload, no verificacion de bytes.

Recomendacion: permitir solo raster (`image/jpeg`, `image/png`, `image/webp`, quizas `image/gif` si se necesita), limitar extension/nombre, mantener maximo de tamano mas bajo para avatares y posts, y considerar procesamiento server-side para generar derivados seguros.

### A5. Vulnerabilidades productivas en dependencias

Severidad: Alta  
Ubicacion: `package.json:14`, `functions/package.json:17`

Evidencia:

- Raiz: `npm audit --omit=dev` reporta 12 vulnerabilidades productivas; incluye Astro <= 7 beta con advisories XSS/SSRF, `@astrojs/node <10.0.5`, Vite, Rollup, `defu`, `devalue`.
- Functions: `npm audit --omit=dev` reporta 19 vulnerabilidades productivas; incluye `protobufjs` critical, `@grpc/grpc-js`, `fast-xml-parser`, `node-forge`, `form-data`, `path-to-regexp`.

Impacto: afecta runtime SSR y backend. En Functions, varios paquetes son transitivos de Firebase Admin/Google Cloud SDK; aun asi deben actualizarse porque el proceso ejecuta backend con privilegios.

Recomendacion: ejecutar `npm audit fix` en ambos arboles, revisar diff y desplegar. Si `firebase-admin@14.x` exige breaking changes, hacer una rama dedicada y correr emuladores/build antes de deploy.

## Hallazgos medios

### M1. SSR de Astro no esta conectado al despliegue Firebase

Severidad: Media/Alta segun plan de deploy  
Ubicacion: `astro.config.mjs:7`, `astro.config.mjs:9`, `firebase.json:1`

Evidencia:

```js
export default defineConfig({
  site: 'https://el-alma-de-las-flores-blog.web.app',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
```

`firebase.json` declara Firestore, Functions y Storage, pero no contiene `hosting`.

Impacto: el build genera servidor Node (`dist/server`) y cliente (`dist/client`), pero Firebase Hosting no sabe servirlo ni aplicar headers/cache/rewrites. En produccion puede acabar desplegandose solo una parte, sin SSR o sin cabeceras.

Recomendacion: decidir una ruta:

- Static-first: si las paginas dinamicas son cliente + Firestore, cambiar a `output: "static"` y usar Hosting simple.
- SSR real: seguir la guia Astro/Firebase con webframeworks o configurar Hosting + Functions/App Hosting, manteniendo plan Blaze.

### M2. Sin CSP ni cabeceras de seguridad visibles

Severidad: Media  
Ubicacion: `src/layouts/Layout.astro:30`, `firebase.json:1`

Evidencia: no aparece `Content-Security-Policy`, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` ni bloque `hosting.headers`.

Impacto: si aparece una regresion XSS, no hay defensa en profundidad. La app usa scripts inline (`src/layouts/Layout.astro:85`) y modulos remotos de Firebase CDN, asi que una CSP requiere planificacion.

Recomendacion: definir cabeceras en Firebase Hosting o en el servidor SSR. Prioridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`. Evitar `unsafe-eval`; reducir inline scripts o usar nonce/hash.

### M3. `addComment` no valida existencia de post ni consistencia de respuestas

Severidad: Media  
Ubicacion: `functions/src/functions/addComment.ts:68`, `functions/src/functions/addComment.ts:77`

Evidencia:

```ts
const commentData: Record<string, any> = {
  postId: postId.trim(),
  ...
};

if (typeof parentId === "string" && parentId.trim().length > 0) {
  commentData.parentId = parentId.trim();
}
```

Impacto: se pueden crear comentarios huerfanos para posts inexistentes o respuestas enlazadas a comentarios de otro post. Esto ensucia datos y puede distorsionar contadores/listados.

Recomendacion: comprobar `posts/{postId}` antes de escribir; si hay `parentId`, comprobar que `comments/{parentId}` existe y tiene el mismo `postId`.

### M4. Trigger de borrado de usuario no reintenta fallos parciales

Severidad: Media  
Ubicacion: `functions/src/functions/cleanupOnUserDeleted.ts:17`

Evidencia:

```ts
await Promise.allSettled([
  deleteCollection("posts", "authorUid", uid),
  ...
]);
console.log(`Limpieza completada para usuario: ${uid}`);
```

Impacto: `Promise.allSettled` marca la funcion como completada aunque una limpieza falle. Para una funcion RGPD, eso puede dejar datos personales residuales sin reintento automatico.

Recomendacion: usar `Promise.all`, inspeccionar resultados y lanzar error ante cualquier fallo. Hacer idempotentes los deletes para que un reintento sea seguro.

### M5. Consultas de posts/comentarios sin paginacion

Severidad: Media  
Ubicacion: `src/scripts/posts/archive/yearbook.ts:267`, `src/scripts/posts/my-posts/firebase.ts:64`, `src/scripts/posts/social/interactions.js:225`

Evidencia:

```ts
query(postsRef, where("year", "==", ARCHIVE_YEAR), orderBy("createdAt", "desc"))
```

```js
query(collection(db, "comments"), where("postId", "==", this.postId), orderBy("createdAt", "asc"))
```

Impacto: anuario, mis publicaciones y comentarios cargan colecciones completas. Con crecimiento real, aumenta latencia, coste y memoria del navegador.

Recomendacion: usar `limit()` + cursores (`startAfter`) para posts y comentarios. Para comentarios, cargar inicial con limite y boton "ver mas"; mantener realtime solo para el tramo visible si es necesario.

### M6. Listeners realtime sin `unsubscribe`

Severidad: Media/Baja  
Ubicacion: `src/scripts/posts/social/interactions.js:191`, `src/scripts/posts/social/interactions.js:231`

Evidencia:

```js
onSnapshot(postRef, (snap) => { ... });
onSnapshot(q, (snapshot) => { ... });
```

Impacto: el custom element no guarda ni libera listeners en `disconnectedCallback`. En navegacion con transiciones o re-render dinamico, pueden quedar listeners activos y consumo innecesario.

Recomendacion: guardar los unsubscribe que devuelve `onSnapshot` y ejecutarlos en `disconnectedCallback`.

## Rendimiento

### P1. Assets publicos demasiado pesados

Severidad: Alta/Media  
Ubicacion: `public/images`

Evidencia:

- `public/images` pesa 21 MB; `dist/client` pesa 26 MB.
- Imagenes grandes: `Willow...jpg` 2.6 MB, `Oak...png` 1.9 MB, `Elm.jpeg` 1.2 MB, `Gentian...jpg` 1.1 MB, `Impatiens...jpg` 892 KB.
- Videos copiados: `video_logo (1).mp4` 3.6 MB y `presentacion.mp4` 2.9 MB.

Impacto: LCP y navegacion movil se resienten, sobre todo en el catalogo de 38 flores y paginas con imagen hero.

Recomendacion: mover imagenes a `src/assets` y usar `astro:assets` para generar formatos/tamanos responsivos. Comprimir originales, generar WebP/AVIF y usar `width`, `height`, `decoding="async"` y `fetchpriority` para hero/LCP.

### P2. Firebase SDK se carga desde CDN en varias rutas

Severidad: Media  
Ubicacion: `src/scripts/auth/entry.js:171`, `src/scripts/posts/social/interactions.js:120`, `src/scripts/posts/archive/yearbook.ts:254`, `src/scripts/profile/settings.js:147`

Impacto: cada flujo depende de modulos remotos `gstatic`, lo que complica CSP/SRI y puede duplicar trabajo de inicializacion. Es razonable para desarrollo, pero en produccion conviene empaquetar el SDK modular y dejar que Vite haga tree-shaking/cache.

Recomendacion: migrar importaciones a `firebase/app`, `firebase/auth`, `firebase/firestore`, etc. desde npm, manteniendo version unica en `package.json`.

### P3. Fuentes externas bloqueantes

Severidad: Baja/Media  
Ubicacion: `src/layouts/Layout.astro:56`

Evidencia:

```astro
<link href="https://fonts.googleapis.com/css2?...&display=swap" rel="stylesheet" />
```

Impacto: dependencia externa en primer render. `display=swap` ayuda, pero sigue siendo una peticion critica.

Recomendacion: autoalojar fuentes o reducir pesos. Actualmente se cargan 8 variantes entre Cormorant Garamond y Red Hat Text.

## UX/UI

### U1. Flujos de autor tienen microcopy y estados mejorables

Severidad: Media  
Ubicacion: `src/pages/_views/author/publicar.astro:23`, `src/pages/_views/author/publicar.astro:153`, `src/scripts/posts/publish/editor.ts:239`

Evidencia:

```astro
Porque tu palabra importa
...
<button id="blog-go-2026">Ir al 2026</button>
```

El script ya calcula el ano actual, pero el texto visible queda fijo en 2026.

Impacto: el panel parece editorial, pero falta feedback operativo: limite de caracteres, tamano maximo real de imagen, progreso de subida y errores accionables. El texto "Ir al 2026" quedara obsoleto.

Recomendacion: mostrar "Ir al anuario actual", progreso de upload, validacion de tamano/tipo antes de subir y estados success/error no basados en `alert()`.

### U2. Menu movil no implementa focus trap completo

Severidad: Media/Baja  
Ubicacion: `src/components/layout/header/HeaderMobileMenu.astro:6`, `src/scripts/layout/header/mobile-menu.ts:13`

Evidencia: el menu usa `role="dialog"` y enfoca el primer enlace, pero no atrapa `Tab`, no marca el fondo como inert y no devuelve foco si el usuario tabula fuera.

Impacto: accesibilidad incompleta para teclado/lectores de pantalla.

Recomendacion: implementar focus trap, cerrar al click fuera si aplica, y usar `inert`/`aria-hidden` para contenido de fondo mientras el dialog esta abierto.

### U3. Red social del footer usa enlaces `#`

Severidad: Baja  
Ubicacion: `src/components/layout/Footer.astro:30`, `src/components/layout/Footer.astro:41`, `src/components/layout/Footer.astro:52`

Impacto: usuarios que pulsan redes no llegan a ningun destino; tambien genera ruido para navegacion con teclado.

Recomendacion: usar URLs reales o deshabilitar/ocultar hasta tener perfiles.

### U4. Layout general usa tarjetas grandes y mucho radio

Severidad: Baja  
Ubicacion: varias vistas (`rounded-[2rem]`, `rounded-[2.5rem]`, `rounded-[2.8rem]`)

Impacto: visualmente es coherente con el tema floral, pero en herramientas operativas (`publicar`, `mi-perfil`, `mis-publicaciones`) reduce densidad y escaneabilidad. Para autores recurrentes conviene una UI mas compacta y predecible.

Recomendacion: mantener el lenguaje editorial en contenido publico y compactar vistas de autor: radios menores, labels mas directas, acciones persistentes y mensajes de estado claros.

## Fortalezas observadas

- Astro y Functions compilan correctamente.
- Se usa `strict` en `functions/tsconfig.json`.
- `publishPost`, `addComment`, `toggleLike` y perfil toman identidad desde `request.auth.uid`, no desde el cliente.
- Comentarios y posts renderizan texto de usuario con `textContent` en rutas revisadas, reduciendo riesgo XSS.
- Indices de Firestore para `comments(postId, createdAt)`, `posts(year, createdAt)` y `posts(authorUid, createdAt)` estan declarados.
- Lectura de perfiles de usuario esta restringida al propietario.
- `likeCount` esta protegido frente a escrituras directas del cliente.

## Prioridad recomendada

1. Cerrar escrituras cliente de `posts/comments/likes` o endurecer schemas en reglas.
2. Activar App Check y rate limiting en callables.
3. Actualizar dependencias con `npm audit fix` y revisar breaking changes de `firebase-admin`.
4. Validar `publishPost`: longitudes, campos extra, existencia/propiedad de imagen.
5. Restringir Storage a raster seguro y procesar imagenes.
6. Decidir despliegue: static Hosting vs SSR real en Firebase.
7. Optimizar imagenes y cambiar a `astro:assets`.
8. Paginacion en posts/comentarios y unsubscribe de listeners.
9. Mejorar UX del panel autor y accesibilidad del menu movil.

## Referencias oficiales consultadas

- Firebase App Check en Cloud Functions: https://firebase.google.com/docs/app-check/cloud-functions
- Firebase Hosting headers/rewrites: https://firebase.google.com/docs/hosting/full-config
- Astro deploy en Firebase: https://docs.astro.build/en/guides/deploy/firebase/
- Astro Node adapter: https://docs.astro.build/en/guides/integrations-guide/node/
- Firestore paginacion y limites: https://firebase.google.com/docs/firestore/query-data/query-cursors
- Storage Rules metadata/type/size: https://firebase.google.com/docs/storage/security/rules-conditions
