# El Alma de las Flores — Análisis del proyecto y gaps

> Documento de diagnóstico. Fecha: 2026-06-16. Estado: blog en Astro (SSR) + Firebase.
> Objetivo: vista general de la arquitectura, inventario de gaps y plan de trabajo priorizado.

---

## 1. Vista general

**Frontend:** Astro 6, `output: "server"`, adapter `@astrojs/node` (standalone). Tailwind v4.

**Backend:** Firebase.
- **Auth** (Email/Password).
- **Firestore**: colecciones `users`, `posts`, `comments`, `likes`.
- **Storage**: imágenes de posts (`blog/posts/{uid}/`) y avatares (`users/{uid}/avatar/`).
- **Cloud Functions** (gen2, `europe-west1`, salvo `cleanupOnUserDeleted` gen1 en `us-central1`):
  `registerUser`, `upsertUserProfile`, `publishPost`, `addComment`, `deleteComment`,
  `toggleLike`, `deleteUserData`, `exportUserData`, `cleanupOnUserDeleted`.

**Proyecto Firebase:** `el-alma-de-las-flores-blog`.

### Flujos reales (los que están cableados a páginas)
| Página | Script | Función |
|--------|--------|---------|
| `/acceder`, `/registrate` | `auth/entry.js` | registro + login (client-side directo) |
| `/publicar` | `auth/guards/publish.js` + `posts/publish/editor.ts` | subir imagen a Storage + `publishPost` |
| `/mis-publicaciones` | `posts/my-posts/*` | query `posts` por `authorUid` |
| `/mi-perfil` | `profile/settings.js` | editar perfil + avatar + `upsertUserProfile` |
| `/archivo/2026` | `posts/archive/yearbook-2026.ts` | render de posts (textContent, seguro) |
| componente social | `posts/social/interactions.js` | likes/comentarios (`toggleLike`,`addComment`,`deleteComment`) |

### Patrón de carga Firebase
Cliente carga el SDK por **dos vías distintas**:
- npm `firebase@^12` vía `src/lib/firebase/*.ts` (solo lo usan los scripts muertos).
- CDN `gstatic .../11.0.2/...` con `import()` dinámico (lo usan todos los scripts vivos).

---

## 2. Gaps — por severidad

### 🔴 Críticos (seguridad / datos)

**G1. Credencial de service account en el árbol del repo**
`el-alma-de-las-flores-blog-cdb7d0a9e656.json` contiene `private_key`. Está en `.gitignore`
(no trackeado), pero vive en disco en la raíz y es fácil filtrarlo (zip, backup, deploy).
→ Mover fuera del repo, **rotar la clave** en GCP IAM por precaución, y referenciarla solo
por ruta absoluta o `GOOGLE_APPLICATION_CREDENTIALS`.

**G2. XSS almacenado en comentarios**
`scripts/posts/social/interactions.js` renderiza `data.content` (y la respuesta) con
`el.innerHTML = \`...${data.content}...\``. El contenido es texto libre del usuario sin
sanitizar. Un comentario con `<img onerror>` ejecuta JS en todos los visitantes.
→ Usar `textContent` (como ya hace `yearbook-2026.ts`) o sanitizar. `addComment` tampoco
escapa/filtra HTML en el servidor.

**G3. Avatares de perfil ilegibles para terceros**
`storage.rules`: `match /users/{uid}/avatar/{...}` tiene `allow read: if isOwner(uid)`.
Pero el `photoURL` resultante se muestra en el header y (potencialmente) en comentarios,
es decir contenido **público**. Resultado: solo el dueño ve su propio avatar; para el resto
la imagen falla (403).
→ **Decidido: avatares públicos.** El avatar es identidad pública del autor (como el nombre).
Cambiar la subruta a `allow read: if true` y dejar `create/update/delete: if isOwner(uid)`.
Lo privado (datos personales) sigue en Firestore `users/{uid}` con lectura solo-dueño.

### 🟠 Altos (arquitectura / consistencia)

**G4. Dos sistemas de autenticación; uno está muerto y roto** — ✅ RESUELTO (2026-06-16)
Eliminados `auth/login.js`, `auth/register.js`, `profile/dashboard.js`, `user/context.js`,
`core/config.js` y todo `src/lib/` (`firebase/auth.ts`, `firebase/profiles.ts`,
`firebase/init.ts`, `auth/navigation.ts`). Build verificado, sin referencias huérfanas.
- Vivo: `entry.js` → redirige a `/publicar`, páginas `/acceder`, `/registrate`, `/mi-perfil`.
- Muerto: `auth/login.js`, `auth/register.js`, `profile/dashboard.js`, `user/context.js` +
  `lib/auth/navigation.ts` → apuntan a rutas **inexistentes** (`/user`, `/user/login`,
  `/user/register`, `/terapeuta`). Ningún `.astro` los importa.
→ **Decidido: rol `terapeuta` descartado.** Eliminar el sistema muerto completo:
`auth/login.js`, `auth/register.js`, `profile/dashboard.js`, `user/context.js`,
`lib/auth/navigation.ts`, y la rama `terapeuta` de `lib/firebase/profiles.ts`
(`getMyAccountContext`). Revisar también `lib/firebase/auth.ts` (solo lo usa código muerto).

**G5. `registerUser` (Cloud Function) nunca se invoca en el flujo vivo**
`entry.js` registra con `createUserWithEmailAndPassword` en cliente y luego llama
`upsertUserProfile`. La función `registerUser` (que crea Auth + perfil atómicamente desde el
servidor, el patrón "correcto" documentado en su propio comentario) solo la usa el código muerto
(`lib/firebase/auth.ts`). → Unificar: o se adopta `registerUser`, o se elimina.

**G6. `src/pages/api/posts.ts` escribe a JSON local**
Endpoint que hace `fs.writeFile` sobre `src/data/posts.json`. No funciona en despliegue
serverless/inmutable y compite conceptualmente con el flujo real (Firestore `publishPost`).
Es legacy de la plantilla. → Eliminar (y revisar `src/data/posts.json`, `flowers.js`).

**G7. Doble fuente del SDK de Firebase y versiones divergentes**
`package.json` declara `firebase@^12.9.0`; los scripts vivos importan CDN `11.0.2`; los
type-decls (`firebase-cdn-modules.d.ts`) fijan `11.0.2`. → Unificar a una sola vía/versión
(preferible bundle npm; el CDN añade latencia y desincronización de tipos).

### 🟡 Medios (robustez / escala / cumplimiento)

**G8. Funciones RGPD sin interfaz**
`deleteUserData` (art. 17) y `exportUserData` (art. 20) están implementadas y exportadas,
pero **ningún script las llama** y `/mi-perfil` no tiene botones de "exportar mis datos" /
"eliminar cuenta". → Cablear UI en el perfil.

**G9. Borrado por lotes sin paginación (límite 500)**
`deleteCollection` en `functions/src/lib/firebase.ts` hace un único `batch` (máx 500 escrituras
por batch en Firestore). Un usuario con >500 posts/comentarios/likes deja datos sin borrar →
incumple G8/RGPD silenciosamente. Igual en `cleanupOnUserDeleted`. → Iterar en lotes.

**G10. `year` fijo a 2026 al publicar**
`editor.ts` llama `publishPost({ ..., year: 2026 })`. Los archivos `/archivo/2011..2017` son
estáticos y solo `/archivo/2026` lee Firestore. Tras 2026 las entradas quedan mal clasificadas.
→ Derivar el año del servidor (ya hay fallback `new Date().getFullYear()` en la función) y/o
generar la página de archivo por año dinámicamente.

**G11. Sin App Check ni control de abuso en callables**
`addComment`, `publishPost`, `toggleLike` no validan App Check ni tienen rate limiting. Un
script puede crear comentarios/posts masivamente con una cuenta. → Habilitar App Check y/o
límites por usuario.

**G12. Sin tests**
`functions/package.json` incluye `firebase-functions-test` pero no hay tests. Cero cobertura
en front y back. → Mínimo: tests de reglas (emulador) y de las callables críticas.

### 🟢 Bajos (mantenimiento / docs)

- **G13.** `README.md` es la plantilla de Astro con secciones Firebase pegadas al final.
  No documenta arquitectura, rutas, ni despliegue del sitio (solo de reglas/funciones).
- **G14.** No hay `.env.example` (el README lo menciona) — onboarding manual.
- **G15.** `tsconfig` excluye `functions`; las functions tienen su propio tsconfig. OK, pero no
  hay `astro check`/lint en el front.
- **G16.** Likes: el cliente se suscribe a toda la colección `likes` filtrada por `postId` y
  cuenta `snapshot.size`. Funciona, pero no escala; no hay contador denormalizado en el post.
- **G17.** `src/data/` (`posts.json`, `flowers.js`, `home-page.ts`) mezcla datos estáticos con
  el modelo Firestore; conviene aclarar qué es fuente de verdad.
- **G18.** Inconsistencia de región: `cleanupOnUserDeleted` (gen1, `us-central1`) vs resto
  (`europe-west1`). Es obligado para triggers Auth gen1, pero conviene documentarlo.

---

## 3. Plan de trabajo propuesto (orden sugerido)

1. **Seguridad inmediata:** G1 (sacar/rotar service account), G2 (XSS comentarios), G3 (avatares).
2. **Limpieza arquitectónica:** G6 (borrar `api/posts`), G4 + G5 (decidir y unificar auth),
   G7 (unificar SDK).
3. **Cumplimiento RGPD:** G8 (UI export/delete) + G9 (paginar borrados).
4. **Robustez:** G10 (año), G11 (App Check), G16 (contador likes).
5. **Calidad/Docs:** G12 (tests con emulador), G13/G14 (README real + `.env.example`).

---

## 4. Decisiones tomadas (2026-06-16)

- **Rol `terapeuta`:** descartado. → Eliminar sistema de auth muerto (ver G4).
- **Avatares:** públicos (`read: if true`, escritura solo dueño). → ver G3.
- **Archivo histórico 2011–2017:** se mantiene como páginas estáticas en código.
  El script `migrate:legacy` queda sin uso por ahora (no borrar, pero no es prioridad).
- **Despliegue:** destino final Firebase Hosting, pero **aún no**. De momento solo entorno
  de desarrollo local. → G6/G7 siguen siendo limpieza válida, pero sin urgencia de deploy.
