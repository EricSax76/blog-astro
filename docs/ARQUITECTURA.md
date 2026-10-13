# Arquitectura

Referencia técnica del blog: cómo está montado, qué datos guarda, quién los
escribe y qué protege cada capa. Describe el código actual; si algo de aquí
no cuadra con el código, manda el código y este documento está desfasado.

Operación (despliegue, backups, alertas): [`OPERACIONES.md`](OPERACIONES.md).

---

## 1. Vista general

```text
Navegador ──(HTML/JS estático)──▶ Firebase Hosting (dist/)
   │
   ├─ Firebase Auth (email/contraseña + Google)
   ├─ Firestore ── solo LECTURAS desde el cliente
   ├─ Storage ──── subida de imágenes propias (reglas por uid)
   └─ Cloud Functions (callables) ── TODAS las escrituras de contenido
          └─ App Check (reCAPTCHA v3) obligatorio en todo lo anterior
```

- **Frontend:** Astro 7 con `output: "static"` (sin SSR ni adapter). Todo el
  contenido dinámico (posts, comentarios, likes, perfil) se carga en el
  navegador contra Firebase. Tailwind v4 vía `@tailwindcss/vite`.
- **Backend:** Firebase (proyecto `el-alma-de-las-flores-blog`, plan Blaze).
  No hay servidor propio: la lógica de servidor vive en Cloud Functions.
- **Principio rector:** el cliente **lee** directamente de Firestore, pero
  **nunca escribe** contenido. Toda escritura pasa por un callable que
  autentica, limita la frecuencia, valida y fija la identidad desde el token.
  Las reglas de Firestore cierran `create`/`update` para que no haya atajo.

---

## 2. Frontend

### Estructura de `src/`

| Carpeta | Contenido |
| :--- | :--- |
| `pages/` | Rutas. Cada `.astro` es un envoltorio fino que importa su vista de `_views/`. |
| `pages/_views/` | Vistas reales. El prefijo `_` hace que Astro no las trate como rutas. |
| `components/` | Componentes por área: `home/`, `archive/`, `auth/`, `layout/`. |
| `layouts/Layout.astro` | Layout único: `<head>`/SEO, header, footer, banner de cookies e inyección de la config de Firebase. |
| `scripts/` | JS/TS de cliente, por área (ver tabla de rutas). |
| `data/archive.ts` | Fuente única de los años del anuario (header, portada, sitemap, 404). |
| `styles/global.css` | Tailwind v4 (`@import "tailwindcss"`) y tokens de diseño en `@theme`. |

### Rutas

| Ruta | Vista | Script de cliente |
| :--- | :--- | :--- |
| `/` | `_views/home/index.astro` | `home/story-path.ts`, `home/community-invitation.ts`, `ui/scroll-reveal.ts` |
| `/acceder`, `/registrate` | `_views/auth/*` | `auth/entry.js` |
| `/publicar` | `_views/author/publicar.astro` | `auth/guards/publish.js` + `posts/publish/editor.ts` |
| `/mis-publicaciones` | `_views/author/mis-publicaciones.astro` | `posts/my-posts/index.ts` |
| `/mi-perfil` | `_views/author/mi-perfil.astro` | `profile/settings.js` |
| `/archivo/2011`–`/archivo/2016` | `_views/archive/{año}.astro` | — (HTML estático) |
| `/archivo/2017` | `_views/archive/2017.astro` | `posts/archive/yearbook.ts` (modo `supplement`) |
| `/archivo/2026`, `/archivo/[year]` | `_views/archive/Yearbook.astro` | `posts/archive/yearbook.ts` |
| `/aviso-legal`, `/privacidad`, `/cookies` | `_views/legal/*` | — |
| `/404` | `pages/404.astro` (sin vista) | — |
| `/sitemap.xml` | `pages/sitemap.xml.ts` | — |

En todas las páginas: `layout/header/init.ts` (header, menú móvil, sesión),
`ux/cookie-consent.js` (banner) y `core/app-init.js` (ver §7).

### Anuario por años

- **2011–2016:** páginas estáticas con el contenido histórico escrito en el
  propio `.astro`.
- **2017:** estático, más una rejilla en modo `supplement` que añade los posts
  de Firestore con `year == 2017` (sin estado "vacío" si no hay ninguno).
- **2026 y `[year]`:** misma vista `Yearbook.astro`; `yearbook.ts` lee el año
  de `data-year` y consulta Firestore. `[year].astro` prerenderiza 2018 →
  año del build + 1 (`getStaticPaths`); las páginas con fichero propio tienen
  prioridad. Al cambiar de año basta con reconstruir y desplegar.
- **Cuidado:** el sitemap y el header solo listan `ARCHIVE_YEARS` de
  `data/archive.ts`; los años generados por `[year].astro` no aparecen ahí
  hasta que se añaden a esa lista.

### Portada

`_views/home/index.astro` compone `HomeHero` → `HomeStoryPath` →
`HomeYearbooks` → `HomeCommunityInvitation` → `HomeClosing`.

`HomeStoryPath` («el camino del cuaderno») es mejora progresiva:
`stories-feed.ts` carga las 12 últimas publicaciones y las pinta en una
rejilla 2D; si el usuario permite movimiento y hay al menos 2 entradas,
`story-path.ts` importa bajo demanda `three` + `CSS3DRenderer` y mueve esas
mismas tarjetas DOM a una escena 3D cuya cámara sigue al scroll nativo.
Cualquier fallo deja la rejilla. No hay WebGL ni modelos: Three.js solo
posiciona elementos HTML.

### Cliente Firebase

- `Layout.astro` construye la config con las variables `PUBLIC_FIREBASE_*` y
  `PUBLIC_APPCHECK_SITE_KEY` y la publica en `window.__FIREBASE_CONFIG__`
  (bloque `is:inline`). En build de producción **aborta el build** si falta
  alguna. En desarrollo inyecta además `APPCHECK_DEBUG_TOKEN` si existe.
- `scripts/core/firebase-client.ts` es el único punto de entrada al SDK:
  `getFirebaseApp()` inicializa la app y **App Check (reCAPTCHA v3) una sola
  vez, antes que cualquier otro servicio**. `hasValidFirebaseConfig()` exige
  también la clave de App Check: sin ella los scripts no inicializan Firebase
  y muestran su aviso de configuración.
- El SDK es el paquete npm `firebase` (v11), importado dinámicamente
  (`import("firebase/auth")`, etc.) para que no entre en el JS crítico.
- Los callables se invocan con `getFunctions(app, "europe-west1")`.

### Estado de sesión en la UI

Para pintar el header sin esperar al SDK (sin parpadeo), hay un **espejo de
UI** de la sesión:

- `window.__BLOG_AUTH_STATE__` = `{ isAuthenticated, email, photoURL, displayName }`,
  persistido en `localStorage["blog-auth-state"]` y difundido con el evento
  `blog-auth-changed` (constantes en `scripts/layout/header/constants.ts`).
- Lo escriben `auth/entry.js`, `auth/guards/publish.js`,
  `profile/settings.js` y el logout de `layout/header/auth.ts`.
- Lo leen `layout/header/auth.ts` (también escucha `storage` para
  sincronizar pestañas), `home/community-invitation.ts` y `posts/publish/editor.ts`.
- **No es un control de seguridad:** no guarda tokens. La sesión real es la
  del SDK de Auth (`onAuthStateChanged`) y cada callable verifica el token.

### Estilos y fuentes

- Tailwind v4: tokens (colores papel/tinta/musgo/polen/pétalo, duraciones) en
  el bloque `@theme` de `src/styles/global.css`.
- Fuentes autoalojadas con `@fontsource` (Cormorant Garamond, Red Hat Text):
  ninguna petición a terceros, compatible con la CSP (`font-src 'self'`).

### Cookies

`ux/cookie-consent.js` guarda el consentimiento en
`localStorage["blog-cookie-consent"]` con versión (`CONSENT_VERSION`); si
cambia el propósito de las cookies, subir la versión invalida los
consentimientos previos. Hoy no hay analítica ni marketing activos.

---

## 3. Cloud Functions

Código en `functions/src/`. Punto de entrada `index.ts`:
`setGlobalOptions({maxInstances: 10, region: "europe-west1"})`.

| Función | Tipo | Región | Rate limit | Qué hace |
| :--- | :--- | :--- | :--- | :--- |
| `upsertUserProfile` | callable | europe-west1 | 10/min | Sincroniza el perfil; en la creación fija `role` y `username`. |
| `publishPost` | callable | europe-west1 | 10/hora | Valida y crea un post; resuelve la imagen desde una ruta de Storage. |
| `addComment` | callable | europe-west1 | 10/min | Valida y crea un comentario o respuesta. |
| `deleteComment` | callable | europe-west1 | 20/min | Borra un comentario si el solicitante es su autor. |
| `toggleLike` | callable | europe-west1 | 30/min | Activa/desactiva el like y ajusta `likeCount` en una transacción. |
| `exportUserData` | callable | europe-west1 | 5/día | Devuelve en JSON perfil, posts, comentarios y likes (RGPD art. 20). |
| `deleteUserData` | callable | europe-west1 | 3/día | Borra la cuenta de Auth; la limpieza la hace el trigger (RGPD art. 17). |
| `provisionUserProfile` | Auth `onCreate` (gen1) | us-central1 | — | Red de seguridad: crea `users/{uid}` si el callable no llegó a hacerlo. |
| `cleanupOnUserDeleted` | Auth `onDelete` (gen1) | us-central1 | — | Borra todos los datos del usuario; reintenta ante fallo (`failurePolicy`). |

Los triggers de Auth gen1 solo existen en `us-central1`; por eso son la
excepción de región.

Utilidades compartidas (`functions/src/lib/`):

- `callableOptions.ts` — `CALLABLE_OPTIONS` de los 7 callables:
  `enforceAppCheck: true` y CORS restringido a `*.web.app`,
  `*.firebaseapp.com` del proyecto y `http://localhost:*`.
- `rateLimit.ts` — `RATE_LIMITS` (tabla de arriba) y `enforceRateLimit()`:
  ventana fija por `{uid, acción}` en una transacción. Se llama tras
  autenticar y antes de la lógica.
- `validation.ts` — `requireAllowedKeys()` (rechaza campos no esperados),
  `cleanOptionalText()` (tipo + longitud + `stripHtml`).
- `firebase.ts` — Admin SDK (`db`, `bucket`) y borrado/lectura paginados
  (`deleteCollection`, `fetchCollection`, `deleteStorageFiles`).

---

## 4. Modelo de datos

### Firestore

**`posts/{autoId}`** — lectura pública.

| Campo | Origen |
| :--- | :--- |
| `title` (≤120), `content` (≤10 000) | Cliente, saneado con `stripHtml` en `publishPost`. |
| `imageUrl` | Derivada por el servidor desde `imagePath`; nunca una URL libre. |
| `authorUid` | Token de Auth. |
| `authorName` | Copiado al publicar: `username` → `displayName` → parte local del email → `"Autor"`. |
| `year` | Reloj del servidor (`new Date().getFullYear()`). |
| `likeCount` | `0` al crear; solo lo cambia `toggleLike`. |
| `createdAt`, `updatedAt`, `createdAtMs` | Servidor. |

Los posts migrados del histórico (`migrate:legacy`) llevan además un objeto
`legacy` y, por defecto, `authorUid: "legacy-content"`. Puede quedar
`authorEmail` en posts antiguos hasta ejecutar la purga (ver
[`PLAN-LANZAMIENTO`](PLAN-LANZAMIENTO-2026-08-04.md)).

Reglas: `create`/`update` cerrados; `delete` permitido al autor (hoy no hay
UI que lo use).

**`comments/{autoId}`** — lectura pública.
`postId`, `parentId?` (respuesta; debe ser del mismo post), `title?` (≤200),
`content` (≤1000, `stripHtml`), `authorId` (token), `authorName` (como en
posts, fallback `"Anónimo"`), `createdAt`. Creación solo vía `addComment`;
borrado del propio autor (el cliente usa `deleteComment`).

**`likes/{postId}_{uid}`** — lectura pública.
`postId`, `userId`, `createdAt`. Solo `toggleLike` crea y borra; el id
compuesto impide likes duplicados.

**`users/{uid}`** — lectura solo del propio usuario.

| Campo | Origen |
| :--- | :--- |
| `uid`, `email` | Token de Auth (se resincroniza en cada `upsertUserProfile`). |
| `username` | Se fija **solo al crear** el perfil (formulario de alta o `displayName` de Auth). |
| `displayName` (≤50) | Editable desde `/mi-perfil` vía `upsertUserProfile`. |
| `role` | `"autor"` al crear. Ningún código lo lee todavía. |
| `createdAt`, `updatedAt`, `lastSeenAt`, `lastLoginAt` | Servidor. |

La foto de perfil **no** está en Firestore: vive en el perfil de Firebase
Auth (`photoURL`). Las reglas permitirían al dueño parchear
`displayName`/`photoURL`/`updatedAt`/`lastSeenAt`, pero el cliente actual no
escribe nunca en `users` directamente.

**`rateLimits/{uid}_{acción}`** — sin acceso desde el cliente (deny-all).
`windowStart` (ms), `count`, `expiresAt` (política TTL de Firestore; se
purga ~24 h después de vencer).

Cualquier otra colección: denegada por la regla comodín.

### Storage

| Ruta | Lectura | Escritura |
| :--- | :--- | :--- |
| `blog/posts/{uid}/{ts}-{nombre}` | pública | dueño; JPEG/PNG/WebP/GIF < 10 MB; nombre `[A-Za-z0-9._-]{1,200}` |
| `users/{uid}/avatar/{ts}-{nombre}` | pública | dueño; mismos formatos, < 5 MB |
| `users/{uid}/**` (resto) | dueño | denegada |
| resto | denegada | denegada |

Sin SVG a propósito: un SVG servido desde Storage puede ejecutar script.

### Índices compuestos (`firestore.indexes.json`)

| Índice | Consulta que lo usa |
| :--- | :--- |
| `posts (year ↑, createdAt ↓)` | Anuario por año (`yearbook.ts`). |
| `posts (authorUid ↑, createdAt ↓)` | Mis publicaciones (`my-posts/firebase.ts`). |
| `comments (postId ↑, createdAt ↑)` | Comentarios de un post (`interactions.js`). ⚠️ La consulta ordena `createdAt` **descendente**: pendiente de confirmar en el smoke test que el índice la sirve. |

La portada (`orderBy createdAt desc, limit 12`) usa el índice simple
automático. `yearbook.ts` y `my-posts` degradan a una consulta sin orden si
falta el índice (aviso en consola).

---

## 5. Flujos principales

### Alta e inicio de sesión (`auth/entry.js`)

1. **Alta con email:** `createUserWithEmailAndPassword` → `updateProfile`
   (nombre) → `upsertUserProfile({displayName, username})`, que crea
   `users/{uid}` con `role` y `username`. Redirige a `/publicar`.
2. **Login con email o Google (popup):** autentica →
   `upsertUserProfile` (resincroniza email y `lastLoginAt`; crea el perfil si
   faltara). Redirige a `/publicar`.
3. **En paralelo**, el alta en Auth dispara `provisionUserProfile`: si el
   perfil aún no existe, lo crea. Así no quedan cuentas sin perfil aunque el
   cliente falle entre los pasos.

Las contraseñas solo van al SDK de Auth, nunca a funciones propias.

### Publicar (`/publicar`)

1. `guards/publish.js` espera a la sesión y llama a `upsertUserProfile`; solo
   si responde bien habilita el formulario.
2. `editor.ts` valida en cliente (tipo, ≤10 MB, algo de contenido), sube la
   imagen a `blog/posts/{uid}/{Date.now()}-{nombre}` y llama a
   `publishPost({title, content, imagePath})`.
3. `publishPost` comprueba que la ruta es del usuario, que el fichero existe
   y es raster, deriva la URL de descarga, fija autor y año, y devuelve
   `{postId, year}`. El cliente redirige a `/archivo/{year}`.

### Leer, comentar y dar like

- Cada post del anuario lleva `<blog-social-interactions data-post-id>`
  (`posts/social/interactions.js`, web component).
- `likeCount` llega por `onSnapshot` del documento del post; el like propio,
  por `getDoc(likes/{postId}_{uid})`. El botón llama a `toggleLike`.
- Comentarios: `onSnapshot` de los 50 más recientes (`postId ==`,
  `createdAt desc`); «Ver anteriores» amplía la ventana. Crear y borrar van
  por `addComment` y `deleteComment`. Respuestas: un nivel en la UI.
- Todo el texto de usuario se pinta con `textContent`, nunca con `innerHTML`.

### RGPD (`/mi-perfil`, `profile/settings.js`)

- **Exportar:** `exportUserData` → descarga `mis-datos-{uid}.json`. Tope de
  9 MB inline (`resource-exhausted` → entrega manual por soporte).
- **Eliminar cuenta:** confirmación → `deleteUserData` (solo borra la cuenta
  de Auth) → `signOut` y limpieza de `localStorage`. El borrado de la cuenta
  dispara `cleanupOnUserDeleted`, que elimina posts, comentarios, likes,
  perfil, `rateLimits` y los ficheros de `blog/posts/{uid}/` y `users/{uid}/`.
  Si alguna parte falla, lanza error y Cloud Functions reintenta (es
  idempotente). Es la **única** ruta de limpieza, también si se borra un
  usuario desde la consola.

---

## 6. Seguridad por capas

| Capa | Dónde | Qué frena |
| :--- | :--- | :--- |
| Reglas Firestore | `firebase.rules` | Escritura directa de contenido; lectura de perfiles ajenos y de `rateLimits`. |
| Reglas Storage | `storage.rules` | Subidas fuera de la carpeta propia, SVG, tamaños excesivos. |
| App Check | Cliente + `enforceAppCheck` + enforcement en consola (Firestore, Storage) | Clientes que no son la web legítima. |
| Rate limiting | `functions/src/lib/rateLimit.ts` | Abuso con una cuenta válida. |
| CORS | `functions/src/lib/callableOptions.ts` | Invocación de callables desde orígenes ajenos. |
| Validación en servidor | Callables + `lib/validation.ts` | Campos inesperados, longitudes, HTML, suplantación de autor, URLs de imagen inyectadas. |
| Render seguro | Scripts de cliente | XSS almacenado (`textContent`, sin `innerHTML` con datos). |
| Cabeceras HTTP | `firebase.json` → `hosting.headers` | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. |
| Guard de build | `Layout.astro` | Desplegar con la config de Firebase vacía. |

Detalle de App Check y su reversión: [`APP-CHECK-ENFORCEMENT.md`](APP-CHECK-ENFORCEMENT.md).

---

## 7. Deuda y limitaciones conocidas

Lista de trabajo detallada en [`PLAN-LANZAMIENTO`](PLAN-LANZAMIENTO-2026-08-04.md)
(Fases 2 y 3). Resumen de lo que afecta a la arquitectura:

- **Sin tests.** Ni de reglas ni de funciones.
- **Sin moderación ni rol admin:** `role` se escribe pero no se lee; el autor
  de un post no puede borrar comentarios ajenos.
- **Huérfanos:** borrar un post no borra sus comentarios, likes ni imagen; un
  comentario padre borrado deja sus respuestas; una imagen subida cuyo
  `publishPost` falla queda en Storage; cada cambio de avatar sube un fichero
  nuevo sin borrar el anterior (todo se limpia solo al eliminar la cuenta).
- **Perfil:** `displayName`/`username` sin saneado ni unicidad. Si
  `provisionUserProfile` gana la carrera al callable en el alta, `username`
  queda con el `displayName` de Auth de ese instante (puede ser vacío) y el
  nombre de autor cae a `displayName`.
- **No se exige `email_verified`** para publicar ni comentar.
- **CSP con `script-src 'unsafe-inline'`**, necesario por el bloque
  `is:inline` de `Layout.astro`.
- **`core/app-init.js`** se carga en todas las páginas, pero ninguno de sus
  selectores (`.site-header`, `.has-dropdown`, `.read-more`) existe ya en el
  markup: es código muerto.
- **`tailwind.config.mjs` no se carga:** Tailwind v4 solo lo leería con
  `@config` en `global.css`. Las clases `prose` (plugin `typography`) no
  tienen efecto.
- **`maxInstances: 10`** global: tope de gasto, pero también techo de
  concurrencia por función.
