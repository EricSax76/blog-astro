# El Alma de las Flores — Análisis del proyecto y gaps

> Documento de diagnóstico. Fecha: 2026-06-16. Estado: blog en Astro (SSR) + Firebase.
> Objetivo: vista general de la arquitectura, inventario de gaps y plan de trabajo priorizado.
> Actualización 2026-06-16: ejecutados G1–G3, G6–G10, G13/G14, G17/G18 (ver §3 Estado).

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

**G1. Credencial de service account en el árbol del repo** — ✅ RESUELTO (parcial, 2026-06-16)
`el-alma-de-las-flores-blog-cdb7d0a9e656.json` contiene `private_key`. Está en `.gitignore`
(no trackeado), pero vivía en disco en la raíz.
- Movido a `~/.firebase-keys/` (`chmod 700` dir, `600` archivo), fuera del repo.
- README documenta usar `GOOGLE_APPLICATION_CREDENTIALS` / ruta absoluta.
- ⚠️ **PENDIENTE MANUAL:** rotar la clave en GCP IAM por precaución (no se puede
  desde aquí: GCP Console > IAM & Admin > Service Accounts > Keys).

**G2. XSS almacenado en comentarios** — ✅ RESUELTO (2026-06-16)
`scripts/posts/social/interactions.js` interpolaba `data.content` y `data.authorName` en
`innerHTML`. Un comentario con `<img onerror>` ejecutaba JS en todos los visitantes.
- Cliente: `createCommentElement` ahora construye los nodos con `createElement` +
  `textContent` (autor, fecha, cuerpo). Sin interpolación de texto de usuario en HTML.
- Servidor (defensa en profundidad): `addComment` aplica `stripHtml()` al contenido
  antes de persistir y rechaza si queda vacío.

**G3. Avatares de perfil ilegibles para terceros** — ✅ RESUELTO (2026-06-16)
El avatar (`users/{uid}/avatar/`) tenía `read: if isOwner(uid)` pero se muestra en header
y comentarios (contenido público) → 403 para terceros.
- `storage.rules`: subruta avatar ahora `allow read: if true`; escritura sigue solo dueño.
- La regla específica `users/{uid}/avatar/**` gana por path más largo sobre `users/{uid}/**`.
- ⚠️ Requiere `firebase deploy --only storage` para aplicar.

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

**G5. `registerUser` (Cloud Function) nunca se invoca en el flujo vivo** — ✅ RESUELTO (2026-06-16)
Adoptado el patrón estándar de Firebase (más usado y fiable): alta de cuenta con el **SDK de
Auth en cliente** + provisión del perfil en servidor. No se envían contraseñas a funciones propias.
- Eliminada la función `registerUser` (creaba Auth+perfil con password en el servidor).
- `upsertUserProfile` ahora persiste `username` y el `role` en la creación (server-authoritative).
  → **Arregla el bug** por el que `username` nunca se guardaba en el alta (lo leen
  `addComment`/`publishPost` como nombre de autor preferente).
- Nuevo trigger `provisionUserProfile` (Auth `onCreate`, gen1 `us-central1`, simétrico a
  `cleanupOnUserDeleted`): red de seguridad que garantiza el perfil aunque el cliente falle →
  sin cuentas huérfanas.
- `entry.js` envía `username` al provisionar en el registro.
Build de functions (`tsc`) y front verificados.

**G6. `src/pages/api/posts.ts` escribe a JSON local** — ✅ RESUELTO (2026-06-16)
Endpoint legacy que hacía `fs.writeFile` sobre `src/data/posts.json`.
- Eliminados `src/pages/api/posts.ts` y `src/data/posts.json` (este último 241 KB, nadie
  lo leía salvo el endpoint). Directorio `src/pages/api/` vacío → borrado.
- `flowers.js` se mantiene: es fuente de verdad de las fichas estáticas de flores
  (lo usan `home-page.ts`, `sitemap.xml.ts`, `flores-de-bach/[slug].astro`).

**G7. Doble fuente del SDK de Firebase y versiones divergentes** — ✅ RESUELTO (2026-06-16)
`package.json` declaraba `firebase@^12.9.0`; los scripts vivos usan CDN `11.0.2`; los
type-decls fijaban `11.0.2` → divergencia.
- Runtime único: CDN `11.0.2` (vía `import()` dinámico). Confirmado que ningún script
  vivo importa el bundle npm (el código muerto que lo usaba se eliminó en G4).
- `firebase` movido a `devDependencies` y **pinneado exacto a `11.0.2`** (solo fuente de
  tipos para `firebase-cdn-modules.d.ts`). Cero divergencia runtime↔tipos.
- Migrar a bundle npm queda como mejora futura (elimina latencia CDN), no urgente.

### 🟡 Medios (robustez / escala / cumplimiento)

**G8. Funciones RGPD sin interfaz** — ✅ RESUELTO (2026-06-16)
`deleteUserData` (art. 17) y `exportUserData` (art. 20) no tenían UI.
- `/mi-perfil` (`_views/author/mi-perfil.astro`): nueva sección "Tus datos personales"
  con botones **Exportar mis datos** y **Eliminar mi cuenta** + zona de mensajes.
- `scripts/profile/settings.js`: exportar → llama `exportUserData`, descarga JSON
  (`mis-datos-{uid}.json`). Eliminar → `confirm` doble → `deleteUserData` → `signOut` +
  limpia `localStorage` → redirige a `/`. Botones deshabilitados si falta config Firebase.

**G9. Borrado por lotes sin paginación (límite 500)** — ✅ RESUELTO (2026-06-16)
`deleteCollection` (`functions/src/lib/firebase.ts`) ahora itera en lotes de 500
(`limit(500)` + bucle hasta `snapshot.empty`/página incompleta). Beneficia a
`deleteUserData` y `cleanupOnUserDeleted`. `deleteStorageFiles` ya pagina vía `getFiles`.

**G10. `year` fijo a 2026 al publicar** — ✅ RESUELTO (2026-06-16)
- `publishPost` deriva `year = new Date().getFullYear()` (server-authoritative), ignora
  cualquier `year` del cliente y lo devuelve en la respuesta.
- `editor.ts` ya no envía `year`; redirige a `/archivo/{year}` según la respuesta.
- Archivo dinámico: `_views/archive/Yearbook.astro` (vista reutilizable por año),
  `archivo/[year].astro` (SSR, años 2018..actual+1), `archivo/2026.astro` la reusa.
  Script `yearbook.ts` (antes `yearbook-2026.ts`) lee el año de `data-year`.
  `YearbookNav` incluye el año actual dinámicamente.

**G11. Sin App Check ni control de abuso en callables** — ⏳ PENDIENTE
`addComment`, `publishPost`, `toggleLike` no validan App Check ni rate limiting.
→ Requiere alta en consola (reCAPTCHA/App Check provider + clave) antes de tocar código.
No ejecutado: necesita acción en Firebase/GCP Console fuera del repo.

**G12. Sin tests** — ⏳ PENDIENTE
Cero cobertura. → Trabajo de mayor alcance (suite + emulador). No ejecutado en esta tanda;
candidato siguiente una vez estabilizado el resto.

### 🟢 Bajos (mantenimiento / docs)

- **G13.** ✅ RESUELTO (2026-06-16) — `README.md` reescrito: arquitectura, tabla de rutas,
  puesta en marcha, comandos, despliegue de reglas/funciones, nota de credenciales y migración.
- **G14.** ✅ RESUELTO (2026-06-16) — Añadido `.env.example` con las 6 claves `PUBLIC_FIREBASE_*`
  y nota de que el prefijo `PUBLIC_` las expone al cliente (no meter secretos de servidor).
- **G15.** ⏳ PENDIENTE — `tsconfig` excluye `functions` (OK, tienen su propio tsconfig). Falta
  `astro check`/lint en el front. (No bloqueante; el build verifica tipos de `.astro`/scripts.)
- **G16.** ⏳ PENDIENTE — Likes vía suscripción a toda la colección filtrada por `postId`
  (`snapshot.size`). No escala. Mejora: contador denormalizado `likeCount` en el post
  (transacción en `toggleLike` + backfill de posts existentes + cambiar lectura en
  `interactions.js`). No ejecutado: requiere migración de datos y decisión de diseño.
- **G17.** ✅ ACLARADO (2026-06-16) — Eliminado `posts.json` (legacy, ver G6). Fuentes de verdad:
  estático en `src/data/` (`flowers.js`, `home-page.ts`); dinámico en Firestore (`posts`,
  `comments`, `likes`, `users`). Documentado en README.
- **G18.** ✅ DOCUMENTADO (2026-06-16) — Región: `cleanupOnUserDeleted` y `provisionUserProfile`
  en `us-central1` (gen1, obligado para triggers Auth); el resto en `europe-west1`. Recogido
  en la sección de arquitectura del README.

---

## 3. Plan de trabajo propuesto (orden sugerido)

1. **Seguridad inmediata:** G1 (sacar/rotar service account), G2 (XSS comentarios), G3 (avatares).
2. **Limpieza arquitectónica:** G6 (borrar `api/posts`), G4 + G5 (decidir y unificar auth),
   G7 (unificar SDK).
3. **Cumplimiento RGPD:** G8 (UI export/delete) + G9 (paginar borrados).
4. **Robustez:** G10 (año), G11 (App Check), G16 (contador likes).
5. **Calidad/Docs:** G12 (tests con emulador), G13/G14 (README real + `.env.example`).

### Estado (2026-06-16)

- ✅ **Resueltos:** G1 (parcial — falta rotar clave), G2, G3, G4, G5, G6, G7, G8, G9, G10,
  G13, G14, G17, G18.
- ⏳ **Pendientes:** G11 (App Check — necesita consola), G12 (tests), G15 (lint/astro check),
  G16 (contador likes denormalizado — necesita migración de datos).
- ⚠️ **Acciones manuales fuera del repo:**
  - Rotar la clave de service account en GCP IAM (G1).
  - `firebase deploy --only storage` para aplicar avatares públicos (G3).
  - `firebase deploy --only functions` para publicar cambios de `addComment`/`publishPost`/
    `deleteCollection` (G2/G9/G10) — y eliminar `registerUser` ya retirado (G5).

Verificado: `tsc` de functions OK y `astro build` OK tras los cambios.

---

## 4. Decisiones tomadas (2026-06-16)

- **Rol `terapeuta`:** descartado. → Eliminar sistema de auth muerto (ver G4).
- **Avatares:** públicos (`read: if true`, escritura solo dueño). → ver G3.
- **Archivo histórico 2011–2017:** se mantiene como páginas estáticas en código.
  El script `migrate:legacy` queda sin uso por ahora (no borrar, pero no es prioridad).
- **Despliegue:** destino final Firebase Hosting, pero **aún no**. De momento solo entorno
  de desarrollo local. → G6/G7 siguen siendo limpieza válida, pero sin urgencia de deploy.
