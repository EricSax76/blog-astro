# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Firebase auth (entrada)

La portada (`/`) incluye registro e inicio de sesión con Firebase Authentication.
Al registrar/iniciar sesión se crea/actualiza el perfil en Firestore (`users/{uid}`) y el acceso de escritura se realiza en `/publicar`.

1. Copia `.env.example` a `.env`.
2. Completa los valores `PUBLIC_FIREBASE_*` desde **Firebase Console > Project settings > Your apps > SDK setup and configuration**.
3. Asegúrate de tener habilitado **Authentication > Sign-in method > Email/Password**.

## Firebase Storage (reglas)

- Reglas en `storage.rules`.
- Ruta pública para imágenes del blog: `blog/posts/{uid}/{archivo}`.
- Solo el `uid` propietario puede crear/actualizar/eliminar su archivo.
- Límite de subida: 10 MB y tipo `image/*`.
- El editor `/publicar` sube aquí las imágenes destacadas.

Deploy de reglas:

```bash
firebase deploy --only storage
```

## Firestore (rules + indexes)

- Reglas en `firebase.rules`.
- Índices en `firestore.indexes.json`.
- El editor `/publicar` guarda posts en la colección `posts`.
- La página `/archivo/2026` lee posts desde Firestore (query por `year` y `createdAt`).

Deploy de Firestore:

```bash
firebase deploy --only firestore
```

## Migración legacy (2011-2017)

Script para migrar contenido histórico (`src/pages/archivo/2011..2017`) a Firestore y subir imágenes asociadas a Storage:

1. Revisa qué se va a migrar:

```bash
npm run migrate:legacy:dry
```

2. Ejecuta migración real:

```bash
npm run migrate:legacy
```

Opciones útiles:

- `--overwrite`: sobrescribe documentos `posts/{postId}` ya existentes.
- `--years=2011,2012`: migra años específicos.
- `--service-account=./ruta/service-account.json`: usa credenciales explícitas.
- `--bucket=<tu-storage-bucket>`: define bucket manualmente.
- `--author-uid`, `--author-name`, `--author-email`: autor a guardar en posts legacy.

Ejemplo:

```bash
node functions/scripts/migrate-legacy-content.mjs \
  --years=2011,2012,2013,2014,2015,2016,2017 \
  --service-account=./service-account.json \
  --bucket=tu-proyecto.appspot.com
```

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
