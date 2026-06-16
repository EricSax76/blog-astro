# El Alma de las Flores — Blog

Blog en **Astro 6** (SSR, adapter `@astrojs/node`) con backend **Firebase**
(Auth, Firestore, Storage, Cloud Functions). Tailwind v4 para estilos.

> Proyecto Firebase: `el-alma-de-las-flores-blog`. Estado: desarrollo local;
> destino de despliegue previsto Firebase Hosting (aún no desplegado).

## Arquitectura

- **Frontend:** Astro `output: "server"` + `@astrojs/node` (standalone). Las
  páginas cargan el SDK de Firebase vía CDN (`gstatic 11.0.2`) con `import()`
  dinámico. El paquete npm `firebase` está pinneado a `11.0.2` solo como fuente
  de tipos (ver `src/types/firebase-cdn-modules.d.ts`).
- **Auth:** Email/Password. El alta la hace el cliente con el SDK de Auth; el
  servidor provisiona el perfil (`upsertUserProfile` callable + trigger de
  respaldo `provisionUserProfile`). No se envían contraseñas a funciones propias.
- **Firestore:** colecciones `users`, `posts`, `comments`, `likes`.
- **Storage:** imágenes de posts (`blog/posts/{uid}/`, lectura pública) y
  avatares (`users/{uid}/avatar/`, lectura pública, escritura solo dueño).
- **Cloud Functions** (gen2, `europe-west1`, salvo triggers Auth gen1 en
  `us-central1`): `upsertUserProfile`, `provisionUserProfile`, `publishPost`,
  `addComment`, `deleteComment`, `toggleLike`, `deleteUserData`,
  `exportUserData`, `cleanupOnUserDeleted`.

### Rutas principales

| Ruta | Función |
| :--- | :--- |
| `/` | Portada |
| `/acceder`, `/registrate` | Login y registro (`scripts/auth/entry.js`) |
| `/publicar` | Editor: sube imagen a Storage + `publishPost` |
| `/mis-publicaciones` | Posts del autor actual (`authorUid`) |
| `/mi-perfil` | Editar perfil/avatar + exportar/eliminar datos (RGPD) |
| `/archivo/2011`–`/archivo/2017` | Histórico estático |
| `/archivo/2026` y `/archivo/[year]` | Posts del año desde Firestore |
| `/flores-de-bach/[slug]` | Fichas estáticas (`src/data/flowers.js`) |

El **año de un post lo fija el servidor** (`publishPost`,
`new Date().getFullYear()`); el archivo por año es dinámico (`[year].astro`)
para años ≥ 2018 sin página propia.

## Puesta en marcha

```bash
npm install            # deps del front
cp .env.example .env   # rellena los valores PUBLIC_FIREBASE_*
npm run dev            # http://localhost:4321
```

Valores `PUBLIC_FIREBASE_*`: **Firebase Console > Project settings > Your apps >
SDK setup and configuration**. Habilita **Authentication > Sign-in method >
Email/Password**.

### Comandos

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Dev server en `localhost:4321` |
| `npm run build` | Build de producción en `./dist/` |
| `npm run preview` | Sirve el build local |
| `npm run migrate:legacy:dry` | Simula migración de contenido legacy |
| `npm run migrate:legacy` | Migración real (ver abajo) |

### Cloud Functions

```bash
cd functions
npm install
npm run build          # tsc
```

## Despliegue de reglas y funciones

```bash
firebase deploy --only storage     # storage.rules
firebase deploy --only firestore   # firebase.rules + firestore.indexes.json
firebase deploy --only functions   # Cloud Functions
```

> Las credenciales de service account **no viven en el repo**. Referéncialas por
> `GOOGLE_APPLICATION_CREDENTIALS` o por ruta absoluta (p.ej.
> `~/.firebase-keys/<archivo>.json`).

## Migración legacy (2011–2017)

Migra el histórico (`src/pages/archivo/2011..2017`) a Firestore y sube las
imágenes a Storage:

```bash
npm run migrate:legacy:dry         # revisa qué se migraría
npm run migrate:legacy             # ejecuta
```

Opciones: `--overwrite`, `--years=2011,2012`,
`--service-account=/ruta/abs/clave.json`, `--bucket=<storage-bucket>`,
`--author-uid`, `--author-name`, `--author-email`.

## Más

- Análisis y gaps pendientes: [`docs/ANALISIS-Y-GAPS.md`](docs/ANALISIS-Y-GAPS.md).
- Docs de Astro: <https://docs.astro.build>.
