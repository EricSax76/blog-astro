// Contrato del espejo de sesión de la UI (ver auth.ts). Repiten estos
// literales el bloque inline de layouts/Layout.astro y los scripts .js
// (auth/entry.js, auth/guards/publish.js, profile/settings.js): si cambian
// aquí, hay que cambiarlos también allí.
export const AUTH_STATE_STORAGE_KEY = "blog-auth-state";
export const AUTH_CHANGED_EVENT = "blog-auth-changed";
