# El Alma de las Flores — Blog

Blog y cuaderno de campo sobre las Flores de Bach: publicaciones de la
comunidad y anuarios desde 2011.

**En producción:** <https://el-alma-de-las-flores-blog.web.app> (Firebase
Hosting, proyecto `el-alma-de-las-flores-blog`). Pendientes de lanzamiento en
[`docs/PLAN-LANZAMIENTO-2026-08-04.md`](docs/PLAN-LANZAMIENTO-2026-08-04.md).

## Stack

- **Astro 7** con salida **estática** (`output: "static"`, sin SSR). Todo el
  contenido dinámico se carga en el navegador contra Firebase.
- **Firebase:** Auth (email/contraseña y Google), Firestore y Storage (en
  `europe-southwest1`, Madrid) y Cloud Functions (todas en `europe-west1`:
  7 callables gen2 y 2 triggers de Auth gen1). **App Check** (reCAPTCHA v3)
  obligatorio.
- **Tailwind v4** (`@tailwindcss/vite`), fuentes autoalojadas con `@fontsource`.
- **Three.js** (`CSS3DRenderer`), solo para el camino 3D de la portada; se
  carga bajo demanda.

Regla de oro: el cliente **lee** de Firestore pero **no escribe** contenido.
Toda escritura pasa por un callable que autentica, limita la frecuencia,
valida y fija la autoría desde el token. Detalle en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Puesta en marcha

Requisitos: Node 22.

```bash
npm install
cp .env.example .env   # ver abajo
npm run dev            # http://localhost:4321
```

Variables de `.env` (explicadas en [`.env.example`](.env.example)):

- `PUBLIC_FIREBASE_*`: Firebase Console > Project settings > Your apps.
- `PUBLIC_APPCHECK_SITE_KEY`: clave pública de reCAPTCHA v3. **Obligatoria**:
  sin ella el cliente no inicializa Firebase y el build de producción falla.
- `APPCHECK_DEBUG_TOKEN`: token de depuración de App Check, **necesario en
  local** (sin él, 403).
- `PUBLIC_BACH_SITE_URL` (opcional): enlace al sitio hermano `flores-de-bach`.

En Authentication > Sign-in method deben estar activos **Email/Password** y
**Google**.

> ⚠️ `npm run dev` trabaja contra **producción**: no hay emuladores
> conectados al cliente. Lo que publiques o borres en local es real.

## Comandos

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo en `localhost:4321`. |
| `npm run check` | Comprobación de tipos (`astro check`). |
| `npm run build` | `astro check` + build de producción en `dist/`. Falla si falta alguna clave del `.env`. |
| `npm run preview` | Sirve `dist/`. No inyecta el token de App Check: Firebase responderá 403 en local. |
| `npm run migrate:legacy:dry` / `migrate:legacy` | Migración del histórico 2011–2017 a Firestore (hoy sin uso). |

En `functions/`:

| Comando | Acción |
| :--- | :--- |
| `npm ci && npm run build` | Compila TypeScript a `functions/lib/`. |
| `npm run lint` | ESLint. |
| `npm run serve` | Build + emulador de functions. |
| `npm run logs` | Logs de las funciones desplegadas. |
| `npm run purge:author-email:dry` / `purge:author-email` | Quita `authorEmail` de los posts (RGPD). También disponibles desde la raíz. |

## Estructura

```text
src/
  pages/          rutas (envoltorios finos) → pages/_views/ (vistas reales)
  components/     home/, archive/, auth/, layout/
  layouts/        Layout.astro: SEO, header/footer, config de Firebase
  scripts/        JS/TS de cliente por área; core/firebase-client.ts es el único acceso al SDK
  data/archive.ts años del anuario (fuente única)
  styles/         global.css (Tailwind v4 + tokens @theme)
functions/src/    Cloud Functions (functions/ y lib/)
firebase.rules    reglas de Firestore     storage.rules   reglas de Storage
firestore.indexes.json  índices + TTL de rateLimits
firebase.json     hosting (cabeceras CSP y cache), emuladores
scripts/setup-monitoring.sh  alertas de Cloud Monitoring
```

## Despliegue

Manual, con `firebase-tools`, en este orden:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
cd functions && npm ci && npm run build && cd .. && npx firebase-tools deploy --only functions
npx firebase-tools deploy --only hosting   # ejecuta npm run build con el .env real
```

Smoke test, rollback, backups, monitorización y credenciales:
[`docs/OPERACIONES.md`](docs/OPERACIONES.md). No hay claves de service
account: los scripts locales usan ADC (`gcloud auth application-default login`).

CI (`.github/workflows/ci.yml`), en cada push a `main` y en cada PR:
`astro check` + build + `npm audit` en el front; lint + build + `npm audit`
en `functions/`.

## Sitio hermano

Las 38 flores y la biografía de Edward Bach viven desde 2026-08 en el
repositorio `flores-de-bach` (estático, sin Firebase). El blog lo enlaza
solo si `PUBLIC_BACH_SITE_URL` está definida. Pendiente: redirects 301 en
`firebase.json` cuando tenga dominio (ver `docs/OPERACIONES.md` §9).

## Documentación

Índice: [`docs/README.md`](docs/README.md).

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): rutas, modelo de datos,
  funciones, flujos y seguridad.
- [`docs/OPERACIONES.md`](docs/OPERACIONES.md): desarrollo, despliegue,
  rollback, backups y monitorización.
- [`docs/PLAN-LANZAMIENTO-2026-08-04.md`](docs/PLAN-LANZAMIENTO-2026-08-04.md):
  checklist vivo de pendientes.
- [`docs/APP-CHECK-ENFORCEMENT.md`](docs/APP-CHECK-ENFORCEMENT.md): App Check.
