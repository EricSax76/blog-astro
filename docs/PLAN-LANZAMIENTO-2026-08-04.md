# Plan de lanzamiento — auditoría de seguridad y estabilidad (2026-08-04)

Objetivo: publicar con garantías de seguridad y estabilidad. Este documento es el
registro de seguimiento: cada ítem lleva checkbox, severidad y referencia exacta.

Fuentes: auditoría automatizada de 2026-08-04 en cuatro frentes: reglas
Firestore/Storage, cliente (XSS/auth), Cloud Functions e higiene de repo/operaciones.

Leyenda severidad: 🔴 bloqueante · 🟠 alta · 🟡 media · ⚪ baja

---

## Fase 0 — Bloqueantes de seguridad (antes de publicar)

- [ ] 🔴 **Rotar la clave de service account en GCP IAM.**
  Pendiente desde 2026-06-16 (`docs/ANALISIS-Y-GAPS.md:49`, G1). La clave
  `el-alma-de-las-flores-blog-cdb7d0a9e656.json` vivió en el root del repo en disco
  (nunca commiteada); se movió a `~/.firebase-keys/` pero no se rotó.
  Acción: GCP Console → IAM → Service Accounts → crear clave nueva, revocar antigua.

- [x] 🔴 **Endurecer reglas Firestore: escritura directa a `posts`, `comments` y `likes`.**
  ✅ Hecho 2026-08-04 en `firebase.rules` (sin desplegar aún). Verificado que el
  cliente no usa `addDoc`/`updateDoc`/`deleteDoc` directo en ninguna de las tres
  colecciones (solo lecturas) — cerrar no rompe funcionalidad. Cambios:
  `posts` create/update → `false`; `likes` create/delete → `false` (el contador
  `likeCount` solo es consistente si pasa por `toggleLike`); `comments` create →
  `false` (delete se mantiene, autoservicio del propio autor, sin riesgo de
  contenido sin sanear). Funciones auxiliares `isCreatingOwnPost` y
  `likeCountUntouchedOnUpdate` eliminadas por quedar sin uso. Sintaxis validada
  con `firebase emulators:exec --only firestore`.
  ✅ Desplegado 2026-08-04 (`firebase deploy --only firestore:rules`).
  **Pendiente: probar en la app real (publicar, comentar, dar like) antes de
  dar por cerrado.**
  `firebase.rules:53` (posts), `:74` (likes) y `:81` (comments) permiten a cualquier
  usuario autenticado crear documentos vía SDK, saltándose los callables por completo.
  Solo se valida `authorUid`/`authorId`/`userId`; `title`, `content`, `imageUrl`,
  `authorName` quedan sin límite ni validación. Toda la validación, `stripHtml` y
  rate-limit del backend son hoy **solo consultivos**. Consecuencias: spoofing de
  nombre de autor ("Admin"), `imageUrl` arbitraria (tracking pixels; solo la CSP
  `img-src` lo frena), flooding sin rate-limit ni App Check.
  Hoy no es XSS solo porque todo el render usa `textContent`.
  Acción recomendada: `allow create: if false` en las tres colecciones (los callables
  usan Admin SDK y no pasan por reglas). Aplicar lo mismo a `update` de posts, o
  replicar en reglas los límites de tamaño/tipo.

- [~] 🔴 **RGPD: `authorEmail` expuesto en colección pública.**
  `firebase.rules:52` hace `posts` de lectura pública; el campo llegaba también
  al navegador. ✅ Código arreglado 2026-08-04:
  - `functions/src/functions/publishPost.ts` ya no escribe `authorEmail`
    (`authorName` ya se calcula aparte, líneas 102-106 antes del cambio).
  - `functions/scripts/migrate-legacy-content.mjs` — quitado el campo, la opción
    y el flag `--author-email` del script de migración.
  - `src/scripts/home/latest-stories.ts` y `src/scripts/posts/archive/yearbook.ts`
    — quitado el fallback a `authorEmail` en `resolveAuthorName` (redundante,
    `authorName` nunca viene vacío desde el servidor).
  - `functions/` compila limpio (`npm run build`).
  **Pendiente (dato, no código):** purgar `authorEmail` de los posts ya
  existentes en Firestore de producción. Script listo:
  `functions/scripts/purge-author-email.mjs` (dry-run por defecto).
  `npm run purge:author-email:dry` para contar, `npm run purge:author-email`
  para aplicar.
  **Dry-run intentado 2026-08-04, bloqueado por credenciales:** ADC apunta a
  otro proyecto (`upsessions-31987` → "0 posts" engañoso) y la clave
  `~/.firebase-keys/el-alma-de-las-flores-blog-cdb7d0a9e656.json`
  (`el-alma-de-las-flores-blog@appspot.gserviceaccount.com`) autentica pero
  da `PERMISSION_DENIED`: el SA default de App Engine no tiene rol de
  Firestore. Desbloqueo (cualquiera de los dos):
  a) `gcloud auth application-default login` con la cuenta owner + rerun con
     `--project-id=el-alma-de-las-flores-blog`; o
  b) en la sesión de consola ya planificada: crear SA dedicado con
     `roles/datastore.user`, clave nueva, borrar la antigua (cierra también
     la rotación pendiente) y rerun con `--service-account=<clave-nueva>`.
  ✅ Functions desplegadas 2026-08-04 (las 9, incl. `publishPost`; verificado
  con `firebase functions:list`, runtime nodejs22).

- [x] 🔴 **Confirmar App Check ENFORCED en consola para Firestore y Storage.**
  ✅ Confirmado por Eric 2026-08-04: ENFORCED activado en consola para Firestore
  y Storage. El código ya estaba listo (los callables usan `enforceAppCheck: true`;
  cliente inicializa ReCaptchaV3 obligatorio en
  `src/scripts/core/firebase-client.ts:65-71`).

- [x] 🔴 **Runtime y dependencias de `functions/`: Node 20 EOL + CVE crítica.**
  - ✅ Node 22 hecho y desplegado 2026-08-04: `functions/package.json:15` ahora
    `"node": "22"`; las 9 functions corren nodejs22 (verificado con
    `firebase functions:list`).
  - ✅ `firebase-admin@14.2.0` instalado 2026-08-04. Crítica
    (`websocket-driver`) y las 2 altas resueltas; quedan 7 moderadas
    transitivas sin fix no-breaking. Migrado el código del namespace
    `admin.*` a imports modulares (`firebase-admin/app|firestore|storage|auth`)
    — v14 elimina los typings del namespace. `firebase-functions-test`
    desinstalado (sin uso; su peer exige admin ≤13 — reinstalar cuando soporte
    v14 si se montan tests de callables). Build + lint limpios; las 9 functions
    cargan en emulador.
  - ⚠️ El primer redeploy (2026-08-04) falló en las 9: regresión de empaquetado
    en `@firebase/database-compat@2.1.5` (su build standalone hace
    `require("@firebase/app")` sin declararlo; en local lo enmascara el
    `node_modules` del root, que trae el SDK cliente). Arreglado con
    `overrides: {"@firebase/database-compat": "2.1.4"}` en
    `functions/package.json`; verificado con `npm ci` + carga de `lib/index.js`
    en copia aislada (simulando GCF). Quitar el pin cuando salga 2.1.6
    corregida. ✅ Redeploy completado 2026-08-04 ~17:07 (verificado con
    `gcloud functions describe` → updateTime).
  - ✅ Root: `npm audit fix` 2026-08-04 → 0 vulnerabilidades.

- [ ] 🔴 **Activar backups / PITR de Firestore.**
  Cero menciones a backup en repo o docs. El contenido generado por usuarios
  (posts, comentarios, likes, perfiles) no tiene ruta de recuperación.
  Acción: GCP Console → Firestore → habilitar Point-in-Time Recovery y/o backups
  programados. Documentar procedimiento de restauración.
  **Verificado 2026-08-04: sigue pendiente** (`pointInTimeRecoveryEnablement:
  DISABLED`, 0 backup schedules). Con gcloud ya autenticado, comandos directos:
  `gcloud firestore databases update --database='(default)' --enable-pitr` y
  `gcloud firestore backups schedules create --database='(default)'
  --recurrence=daily --retention=7d` (PITR cobra almacenamiento extra por
  versiones de 7 días).

- [ ] 🔴 **Configurar alerta de presupuesto en GCP.**
  Plan Blaze + callables públicos + uploads a Storage sin techo de gasto definido.
  Acción: Billing → Budgets & alerts (p. ej. avisos a 10/25/50 €).
  **Verificado 2026-08-04: sigue pendiente** — la API `billingbudgets` nunca se
  usó en el proyecto. Por CLI
  hace falta `--billing-project=el-alma-de-las-flores-blog` (el quota project
  de ADC apunta a `upsessions-31987`); más simple hacerlo en consola.

## Fase 1 — Estabilidad operativa (semana de lanzamiento)

- [x] 🟠 **Página 404.**
  ✅ Hecha 2026-08-04: `src/pages/404.astro` (Hosting sirve `404.html`
  automáticamente con salida estática). Enlaza a inicio y al anuario más
  reciente (`NEWEST_ARCHIVE_YEAR` de `src/data/home-page.ts`).
  ✅ Desplegada 2026-08-04 (verificado: ruta inexistente devuelve HTTP 404).

- [x] 🟠 **Guardar el deploy contra `.env` vacío.**
  ✅ Hecho 2026-08-04: el frontmatter de `Layout.astro` valida en build de
  producción que las 7 claves Firebase no estén vacías y lanza error si falta
  alguna (verificado: build sin `.env` falla; con `.env` pasa). CI usa
  placeholders para el build de verificación.

- [x] 🟠 **TTL en la colección `rateLimits`.**
  ✅ Hecho 2026-08-04: no hizo falta consola — `firestore.indexes.json` ahora
  declara `fieldOverrides` con `ttl: true` sobre `rateLimits.expiresAt`
  (conservando los índices single-field por defecto) y se desplegó con
  `npx firebase-tools deploy --only firestore:indexes`. Verificado contra el
  servidor con `firestore:indexes` (devuelve `"ttl": true`). Nota: Firestore
  purga docs expirados en ~24 h tras `expiresAt`, suficiente para esta colección.

- [x] 🟠 **Monitorización mínima y alertas.**
  ✅ Hecho 2026-08-04 vía `scripts/setup-monitoring.sh` (tras autenticar gcloud
  con la cuenta owner del proyecto). Verificado con
  `gcloud alpha monitoring policies list`: 3 políticas activas —
  "Funciones gen1 con errores (Auth triggers)" (us-central1, cubre
  `provisionUserProfile`/`cleanupOnUserDeleted`), "Callables gen2 con 5xx"
  (europe-west1, Cloud Run) y "Hosting caído" — más el uptime check
  `hosting-el-alma-de-las-flores-blog.web.app`. Notificación por email al owner.
  Panel: https://console.cloud.google.com/monitoring/alerting

- [x] 🟠 **Limpiar archivos trackeados que no deben estarlo.**
  ✅ Hecho y commiteado 2026-08-04: `git rm --cached functions/firebase-debug.log
  .DS_Store` (ambos ya cubiertos por `.gitignore`).

- [x] 🟠 **CORS abierto en los callables.**
  ✅ Hecho 2026-08-04: `functions/src/lib/callableOptions.ts` centraliza
  `CALLABLE_OPTIONS` (`enforceAppCheck` + `cors`) y los 7 callables lo usan.
  Origins: hosting `*.web.app` y `*.firebaseapp.com` + `localhost:*` (el dev
  local llama a producción). **Pendiente: redeploy de functions.**

- [x] 🟠 **Operaciones sin límite en `exportUserData` / `deleteUserData`.**
  ✅ Hecho 2026-08-04:
  - `fetchCollection` pagina con cursor (`orderBy(documentId)` + `startAfter`,
    páginas de 500); `deleteStorageFiles` lista por páginas (`maxResults: 100`)
    y borra en lotes de 25 concurrentes.
  - `exportUserData`: `timeoutSeconds: 120` + techo de 9 MB con error claro
    (`resource-exhausted` → soporte). Con los límites de contenido actuales
    equivale a ~900 posts; si alguna cuenta lo alcanza, entrega manual.
  - `deleteUserData` rediseñado: solo borra la cuenta de Auth (1 operación,
    sin borrado parcial ni cuota bloqueante); TODA la limpieza vive en
    `cleanupOnUserDeleted` — se eliminó la duplicación de trabajo.
  - `cleanupOnUserDeleted`: **`failurePolicy: true`** (sin él un trigger gen1
    NO reintenta — el rethrow era solo un log) + `timeoutSeconds: 540` +
    borra también los docs `rateLimits` del usuario.
  - Verificado con test E2E contra emuladores (auth+functions+firestore+
    storage): export de 600 likes (fuerza paginación >500) + 3 posts +
    2 comments + perfil; tras `deleteUserData`, el trigger dejó a cero
    Firestore (5 colecciones), Storage y la cuenta de Auth en <2 s.
    Script: dry-run reproducible, no versionado (scratchpad).
  **Pendiente: redeploy de functions** (incluido en el redeploy ya pendiente).

- [x] 🟡 **CI: compilar y lintar `functions/`.**
  ✅ Hecho 2026-08-04: job `functions` en `.github/workflows/ci.yml`
  (npm ci + lint + build, Node 22). Lint de functions saneado para que pueda
  ser gate: `--fix` masivo + `max-len` 100 + `valid-jsdoc` off (regla
  deprecada) — 0 errores. Upgrade a ESLint 9 sigue como ítem aparte (⚪).

- [x] 🟡 **CI: paso de `npm audit` (root y functions).**
  ✅ Hecho 2026-08-04: `npm audit --audit-level=high` en ambos jobs
  (root con `--omit=dev`). Umbral high: las 7 moderadas transitivas de
  functions no bloquean; cualquier alta/crítica nueva sí.

## Fase 2 — Calidad y pruebas (post-lanzamiento inmediato)

- [ ] 🟠 **Tests: cobertura cero.**
  Sin runner, sin archivos de test (`docs/ANALISIS-Y-GAPS.md:140-142`, G12).
  `firebase-functions-test@^3.4.1` ya está en devDependencies sin usar.
  Prioridad de cobertura: 1) reglas Firestore/Storage con emulador
  (`@firebase/rules-unit-testing`) — es la superficie de seguridad crítica;
  2) `publishPost` y `addComment` (validación, rate-limit); 3) sanitización cliente.

- [ ] 🟠 **Sanitizar y validar campos de perfil.**
  `upsertUserProfile.ts:39` (`displayName`) y `:48-56` (`username`) solo hacen
  `trim().substring(0,50)`: sin `stripHtml`, sin validación de charset, sin
  `requireAllowedKeys`. `provisionUserProfile.ts:33` copia `user.displayName`
  del Auth (controlado por cliente) **sin límite de longitud**. Ambos fluyen a
  `authorName` de cada post/comment (`publishPost.ts:103`, `addComment.ts:85`).
  Añadir también unicidad de `username`: hoy dos usuarios pueden reclamar la
  misma identidad visible (suplantación en UI).

- [ ] 🟡 **Reemplazar `stripHtml` (regex débil).**
  `functions/src/lib/validation.ts:12-17`: `/<[^>]*>/g` exige `>` de cierre — un
  tag sin terminar (`<img src=x onerror=…`) se almacena intacto; tampoco cubre
  entidades numéricas y mutila texto legítimo. Hoy inocuo porque el render usa
  `textContent`, pero es vector de XSS almacenado si algún día se añade RSS,
  email digest o SSR. Usar sanitizador real o escapar en el consumidor.

- [ ] 🟡 **Validar IDs de documento contra `/^[A-Za-z0-9_-]{1,64}$/`.**
  `postId` (`addComment.ts:57`, `toggleLike.ts:27`), `parentId`
  (`addComment.ts:64-67`), `commentId` (`deleteComment.ts:27`) solo se comprueban
  no-vacíos. Un valor con `/` se interpreta como path en el Admin SDK
  (inyección de ruta; hoy sin fuga práctica, pero superficie sin manejar).

- [ ] 🟡 **Datos huérfanos y moderación.**
  - Borrar un post no borra sus `comments`, `likes` ni la imagen de Storage;
    `deleteComment.ts:38` borra un comentario padre sin sus replies;
    `deleteUserData`/`cleanupOnUserDeleted` no tocan comments/likes ajenos sobre
    posts borrados. Datos huérfanos públicos y coste acumulado.
  - No hay vía de moderación: el autor de un post no puede borrar comentarios
    abusivos en su propio post; no existe rol admin efectivo (el campo `role`
    escrito en `upsertUserProfile.ts:45` nunca se lee).

- [ ] 🟡 **Exigir `email_verified` para publicar/comentar.**
  Ningún callable lo comprueba: una cuenta email/password sin verificar puede
  publicar posts y comentarios.

- [ ] 🟡 **Validar `photoURL` con esquema `https:` antes de asignar a `img.src`.**
  `src/scripts/layout/header/auth.ts:145-147` y `src/scripts/profile/settings.js:94-96`
  asignan sin validar esquema; `firebase.rules:19-23` solo limita longitud (≤2048).
  Hoy no explotable (CSP `img-src` acota orígenes; nunca va a `href`/CSS), pero es
  defensa en profundidad barata: `new URL()` + allowlist `https:` en cliente y regla.

- [ ] 🟡 **CSP: eliminar `script-src 'unsafe-inline'`.**
  `firebase.json:33`. Lo exige el bloque `is:inline` de `Layout.astro:89`.
  Es el mejor backstop contra cualquier inyección futura. Opciones: mover el config
  a script procesado con hash/nonce, o `sha256-…` del bloque inline en la CSP.

- [ ] 🟡 **Sitemap: años hardcodeados.**
  `src/pages/sitemap.xml.ts:6` fija `[2026, 2017, …]` mientras `archivo/[year].astro`
  genera años dinámicamente → 2027 quedará fuera y nadie lo recordará.
  Derivar años de la misma fuente. Añadir `<lastmod>`. Unificar la constante `SITE`
  (duplicada en `sitemap.xml.ts:4`, `astro.config.mjs:11`, `public/robots.txt:8`).

- [ ] ⚪ **Validar `result.data.year` antes de `window.location.href` en
  `src/scripts/posts/publish/editor.ts:260`** (tipado `number`, nunca comprobado).

- [ ] ⚪ **Refinamientos del rate-limit** (`functions/src/lib/rateLimit.ts`):
  ventana fija permite ráfaga de 2× en el borde de ventana (valorar token bucket);
  se cobra cuota antes de validar el payload (cliente con bug agota su propia cuota);
  `likes` es de lectura pública y expone el grafo de likes por usuario.

- [ ] ⚪ **Limitar profundidad de replies en `addComment`** (`addComment.ts:64-80`
  valida padre y post, no profundidad; la UI solo renderiza 2 niveles).

- [ ] ⚪ **Detalles de manejo de errores**: `validation.ts:34-39` refleja nombres
  de campos del atacante en el mensaje; `publishPost.ts:58` traga todos los errores
  de metadata como "imagen no existe" (enmascara fallos IAM/Storage en logs).

- [ ] ⚪ **ESLint de functions EOL**: `eslint@8` (EOL oct-2024) +
  `@typescript-eslint@5` (no soporta TS 5.9). Subir a ESLint 9 + typescript-eslint 8.

- [ ] ⚪ **Revisar dependencia `three`.**
  `package.json` mantiene `three` + `@types/three` aunque
  `docs/PLAN-REDISENO-CONCEPTUAL-INDEX.md:330` la da por desinstalada.
  Confirmar si `src/scripts/flowers/bach-garden.ts` la usa; si no, eliminar.

- [x] ⚪ **`functions/.gitignore`: cambiar `lib/**/*.js` por `lib/`.**
  ✅ Hecho 2026-08-04.

## Fase 3 — Proceso y documentación

- [ ] 🟡 **Runbook de deploy y rollback.**
  Hoy: deploy manual desde portátil (`README.md:76-78`), sin CD, sin checklist.
  Documentar: orden de deploy (rules → functions → hosting), verificación post-deploy,
  rollback (`firebase hosting:rollback`, redeploy de functions anterior).
  Valorar CD con GitHub Actions + Workload Identity Federation (sin tokens de larga vida).

- [ ] 🟡 **Corregir documentación obsoleta:**
  - `docs/AUDITORIA-GENERAL-2026-07-09.md:146-169` (M1, SSR) — resuelto por `astro.config.mjs:12`.
  - `docs/AUDITORIA-GENERAL-2026-07-09.md:171-181` (M2, sin CSP) — resuelto por `firebase.json:32-41`.
  - `docs/AUDITORIA-GENERAL-2026-07-09.md:130-142` (A5) — conteos de vulns desfasados.
  - `docs/ANALISIS-Y-GAPS.md:182-192` — resumen de estado contradice el cuerpo (G11/G15/G16).

- [ ] ⚪ **Dominio propio (si se adopta):** actualizar coordinadamente
  `astro.config.mjs:11`, `sitemap.xml.ts:4` y `robots.txt:8` (hoy `*.web.app`).

---

## Lo que ya está bien (no tocar)

- **Render de UGC seguro**: los 10 usos de `innerHTML` del proyecto son literales
  estáticos o limpieza (`= ""`); posts y comentarios se construyen con
  `createElement` + `textContent`. Sin `document.write`, `insertAdjacentHTML`,
  `eval` ni `srcdoc`.
- **Sin open redirect**: toda navegación es a literales hardcodeados.
- **Sin tokens en storage inseguro**: `blog-auth-state` en localStorage es espejo
  de UI (sin ID/refresh tokens); el SDK gestiona su propia persistencia.
- **Sin secretos en el repo**: histórico completo verificado; solo config
  `PUBLIC_*` (pública por diseño); debug token de App Check gateado por `DEV`.
- **Storage rules sólidas**: raster-only (sin SVG), límites de tamaño, nombres
  seguros, paths por propietario.
- **Headers**: CSP completa (salvo `unsafe-inline`), nosniff, X-Frame-Options DENY,
  Referrer-Policy, Permissions-Policy, cache immutable en `/_astro/**`.
- **Callables**: los 7 verifican `request.auth` y `enforceAppCheck: true`;
  rate-limit transaccional aplicado antes de la lógica en los 7;
  `maxInstances: 10` capa el gasto (nota: también es cuello de botella global único).
- **Identidad servidor-autoritativa en callables**: `authorUid`/`authorId`/`userId`
  siempre del token, nunca del payload; `requireAllowedKeys` bloquea
  mass-assignment en `publishPost` y `addComment`; límites de longitud
  (título 120, contenido 10000, comentario 1000).
- **Imagen de post bien resuelta**: path regex-pinned a `blog/posts/{uid}/`,
  verificación de existencia + contentType raster en bucket, URL derivada en
  servidor (`publishPost.ts:37-69`).
- **Ownership en borrados**: `deleteComment` compara `authorId` con el token;
  like keyed `${postId}_${uid}` con contador en la misma transacción (sin drift).
- **Errores sin fugas**: `HttpsError` con texto seguro en castellano; lo demás
  se convierte en `INTERNAL` genérico y se loguea en servidor.
  `cleanupOnUserDeleted` usa `allSettled` + rethrow + `failurePolicy: true`
  para que GCF reintente (ojo: sin `failurePolicy` el rethrow NO reintenta
  en gen1 — corregido 2026-08-04).
- **Regiones coherentes**: `europe-west1` global, cliente y CSP `connect-src`
  alineados; triggers Auth gen1 en `us-central1` (obligatorio).
- **`rateLimits` inaccesible desde cliente** (deny-all en `firebase.rules:86-88`).
- **Sin supuestos de emulador en código shipped.**
- **robots.txt, sitemap y legales** (aviso legal, privacidad, cookies) presentes.

---

## Orden de ataque sugerido

1. ✅ Reglas Firestore (`allow create: if false` en posts/comments/likes) —
   desplegadas 2026-08-04. Falta smoke test en app real.
2. Quitar `authorEmail` de posts (✅ código desplegado) + purga de documentos
   existentes (RGPD) — **pendiente, requiere confirmación**.
3. ✅ Node 22 (desplegado) + `firebase-admin@14.2.0` + `npm audit fix` en ambos
   package.json — crítica y altas resueltas; falta redeploy de functions.
4. Consola GCP en una sesión: rotar clave SA · App Check enforce (Firestore+Storage)
   · PITR/backups · budget alert · TTL de `rateLimits`.
5. Fase 1 código: ✅ 404 · ✅ guard de `.env` · ✅ CORS · ✅ CI functions+audit.
   Falta: límites en export/delete (único 🟠 de código abierto en Fase 1).
6. Fase 2 y 3 según ritmo, empezando por tests de reglas con emulador.
