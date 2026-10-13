# Operaciones

Cómo desarrollar, desplegar, revertir y mantener el blog en producción.
Arquitectura y modelo de datos: [`ARQUITECTURA.md`](ARQUITECTURA.md).

- Proyecto Firebase/GCP: `el-alma-de-las-flores-blog` (plan Blaze).
- Sitio: <https://el-alma-de-las-flores-blog.web.app>.
- Despliegue: manual desde local con `firebase-tools`. No hay CD; CI solo
  verifica (`.github/workflows/ci.yml`).

---

## 1. Herramientas y credenciales

| Herramienta | Uso | Autenticación |
| :--- | :--- | :--- |
| Node 22 | Front y functions (`functions/package.json` exige `"node": "22"`). | — |
| `firebase-tools` (`npx firebase-tools …`) | Deploy, listar funciones, índices. | `firebase login` con la cuenta owner del proyecto. |
| `gcloud` | Monitorización, backups/PITR, presupuestos. | `gcloud auth login` con la cuenta owner. |
| ADC (Application Default Credentials) | Scripts Admin SDK de `functions/scripts/`. | `gcloud auth application-default login` con la cuenta owner. |

- **No hay claves de service account.** Se revocaron el 2026-08-20. Las
  functions usan el SA de runtime; los scripts locales, ADC. No crear claves
  nuevas salvo necesidad real. Si alguna vez existe una, va fuera del repo
  (`~/.firebase-keys/`, `chmod 600`) y se pasa por `--service-account` o
  `GOOGLE_APPLICATION_CREDENTIALS`.
- **Trampas conocidas:**
  - Si `gcloud` está logueado con otra cuenta, las órdenes contra el
    proyecto dan 403 aunque `firebase-tools` funcione.
  - ADC puede tener otro *quota project* por defecto. Pasa siempre
    `--project-id=el-alma-de-las-flores-blog` a los scripts Admin SDK: sin él
    pueden consultar otro proyecto y devolver un engañoso "0 documentos".
  - Las APIs de facturación (presupuestos) piden
    `--billing-project=el-alma-de-las-flores-blog`.
- `.env` solo contiene configuración **pública** (`PUBLIC_*`) y el token de
  depuración de App Check (solo desarrollo). Nunca secretos de servidor.

---

## 2. Desarrollo local

```bash
npm install
cp .env.example .env      # rellenar PUBLIC_FIREBASE_*, PUBLIC_APPCHECK_SITE_KEY
                          # y APPCHECK_DEBUG_TOKEN (ver .env.example)
npm run dev               # http://localhost:4321
```

> ⚠️ **El desarrollo local trabaja contra PRODUCCIÓN.** El cliente no se
> conecta a emuladores: lo que publiques, comentes o borres en `localhost`
> ocurre en la base de datos real. El CORS de los callables admite
> `http://localhost:*` precisamente para esto.

- Sin `APPCHECK_DEBUG_TOKEN` registrado, App Check rechaza las peticiones
  desde `localhost` (403). `astro preview` sirve un build de producción, que
  no inyecta el token: para probar contra Firebase usa `astro dev`.
- **Emuladores** (`firebase.json`: auth, functions, storage, hosting, UI):
  útiles para probar funciones y reglas de forma aislada, no para la web.
  Validar la sintaxis de las reglas de Firestore:
  `npx firebase-tools emulators:exec --only firestore "true"`.

---

## 3. Verificación antes de desplegar

```bash
npm run build                         # astro check + astro build
cd functions && npm run lint && npm run build && cd ..
```

CI ejecuta lo mismo en cada push a `main` y en cada PR, más
`npm audit --audit-level=high` (root con `--omit=dev`). El build de CI usa
valores placeholder; **el build que se despliega necesita el `.env` real**
(si falta alguna clave, `Layout.astro` aborta el build).

---

## 4. Despliegue

Orden por defecto: **backend antes que frontend**, para que el cliente nuevo
encuentre ya desplegado todo lo que usa.

```bash
# 1. Reglas e índices
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage

# 2. Cloud Functions
cd functions && npm ci && npm run build && cd ..
npx firebase-tools deploy --only functions

# 3. Hosting (el predeploy ejecuta npm run build con el .env local)
npx firebase-tools deploy --only hosting
```

Excepción: si un cambio de reglas **quita** algo que el cliente desplegado
todavía usa, despliega primero el hosting y después las reglas.

Despliega solo lo que cambió. Las funciones van todas juntas salvo que
indiques `--only functions:nombreFuncion`.

### Comprobación posterior

1. `npx firebase-tools functions:list`: aparecen las 9 funciones con runtime
   `nodejs22`.
2. En el sitio, con la consola del navegador abierta (sin errores de CSP ni
   de App Check), haz el **smoke test**: iniciar sesión, publicar con imagen,
   comentar, responder, borrar el comentario, dar y quitar like, editar el
   perfil y exportar datos.
3. Una URL inexistente devuelve 404 con la página propia.

---

## 5. Rollback

| Qué | Cómo |
| :--- | :--- |
| Hosting | Firebase Console → Hosting → historial de versiones → *Revertir* sobre la versión buena. (`firebase-tools` 15 no tiene comando de rollback.) |
| Functions | No hay rollback nativo: `git checkout <commit-bueno>`, `cd functions && npm ci && npm run build` y `deploy --only functions`. |
| Reglas / índices | Igual: restaurar el fichero desde el commit bueno (`git checkout <commit> -- firebase.rules`) y redesplegar solo esa parte. |
| App Check | Ver [`APP-CHECK-ENFORCEMENT.md`](APP-CHECK-ENFORCEMENT.md) § Desarrollo local y reversión. |

---

## 6. Backups y restauración de Firestore

Configurado el 2026-08-20:

- **PITR** (point-in-time recovery) con 7 días de retención.
- **Backup diario** con 7 días de retención.
- **Protección contra borrado** de la base de datos activada.

Restaurar:

- **Documentos puntuales (PITR):** leer con `read_time` desde el SDK de
  servidor y reescribir lo necesario.
- **Base de datos completa desde PITR:**
  `gcloud firestore databases clone --source-database=… --snapshot-time=… --destination-database=<nueva>`.
  Alternativa: `gcloud firestore export gs://… --snapshot-time=…`.
- **Base de datos completa desde backup:** `gcloud firestore backups list` y
  después
  `gcloud firestore databases restore --source-backup=… --destination-database=<nueva>`.
- En ambos casos se restaura **a una base de datos nueva**, nunca sobre la
  actual.

Storage **no** tiene backup: las imágenes borradas no se recuperan.

Referencia: <https://cloud.google.com/firestore/docs/backups>.

---

## 7. Monitorización y costes

- **Alertas** (creadas con `scripts/setup-monitoring.sh`, aviso por email):
  - errores en las funciones gen1 de `us-central1` (`provisionUserProfile`,
    `cleanupOnUserDeleted`);
  - respuestas 5xx en los callables gen2 de `europe-west1`;
  - uptime check del hosting y alerta si falla.

  Panel: <https://console.cloud.google.com/monitoring/alerting>.
  El script exige `MONITORING_EMAIL` y **no es idempotente**: ejecutarlo dos
  veces duplica recursos.
- **Presupuesto:** 20 €/mes sobre el proyecto, con avisos al 50/90/100 %.
  Solo avisa, no corta el servicio.
- **Topes de gasto en código:** `maxInstances: 10` por función y rate limits
  por usuario (ver ARQUITECTURA §3).
- **Logs:** `cd functions && npm run logs`, o Cloud Logging en la consola.

---

## 8. Scripts de datos

Todos usan el Admin SDK con ADC (ver §1) y tienen modo simulación.

| Script | Para qué | Uso |
| :--- | :--- | :--- |
| `functions/scripts/purge-author-email.mjs` | Quitar `authorEmail` de los posts existentes (RGPD). **Pendiente de ejecutar.** | `cd functions && npm run purge:author-email:dry` y después `npm run purge:author-email`. |
| `functions/scripts/migrate-legacy-content.mjs` | Migrar el histórico 2011–2017 a Firestore y Storage. Hoy sin uso: el histórico se mantiene estático. | `npm run migrate:legacy:dry` y después `npm run migrate:legacy`. |

- Usa los `purge:*` de `functions/`: llevan `--project-id`. Los alias del
  `package.json` raíz no lo pasan y dependen del proyecto por defecto de ADC.
- Opciones de `migrate-legacy-content.mjs`: `--years=2011,2012`,
  `--overwrite`, `--project-id`, `--bucket`, `--service-account`,
  `--author-uid`, `--author-name` (o `MIGRATION_AUTHOR_UID` /
  `MIGRATION_AUTHOR_NAME`). Si no se indica, toma el proyecto de
  `PUBLIC_FIREBASE_PROJECT_ID` del `.env`.

---

## 9. Tareas periódicas y cambios coordinados

### Cada cambio de año

`publishPost` fija el año con el reloj del servidor y `[year].astro`
genera la página del año siguiente al del build. Aun así, conviene:

1. Añadir el año nuevo a `ARCHIVE_YEARS` en `src/data/archive.ts`. Si no, el
   header, la portada, el sitemap y la 404 siguen apuntando al año anterior.
2. Reconstruir y desplegar el hosting (genera la página del año siguiente).

### Si se adopta un dominio propio

Actualizar a la vez:

- `astro.config.mjs` (`site`), `src/pages/sitemap.xml.ts` (`SITE`) y
  `public/robots.txt`;
- la lista CORS de `functions/src/lib/callableOptions.ts` (y redesplegar
  functions);
- los dominios de la clave reCAPTCHA v3 (App Check) y los dominios
  autorizados de Firebase Auth;
- `HOST` en `scripts/setup-monitoring.sh` (uptime check).

### Sitio hermano `flores-de-bach`

Las fichas y la biografía se movieron a otro repositorio. Cuando tenga
dominio: definir `PUBLIC_BACH_SITE_URL` (activa el enlace del header) y
añadir a `firebase.json` redirects 301 de `/flores-de-bach/**` y
`/biografia` a su dominio (siguen indexadas en el blog).

---

## 10. Pendientes operativos

Fuente de verdad: [`PLAN-LANZAMIENTO`](PLAN-LANZAMIENTO-2026-08-04.md).
A fecha de este documento:

- Purga de `authorEmail` (requiere ADC con la cuenta owner).
- Smoke test de las reglas endurecidas en la app real (§4).
- Redirects 301 del sitio Bach (§9).
- Runbook automatizado / CD: no existe; este documento es el procedimiento
  manual.
