/**
 * Cliente Firebase compartido.
 *
 * Todos los accesos a servicios Firebase pasan por este módulo para que App
 * Check se active una sola vez y siempre antes de crear clientes de Firestore,
 * Storage o Functions.
 */

import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

type FirebaseRuntimeConfig = FirebaseOptions & {
  appCheckSiteKey?: string;
};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseRuntimeConfig;
  }
}

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
  "appCheckSiteKey",
] as const;

let appCheckInitialized = false;

export const getFirebaseConfig = (): FirebaseRuntimeConfig => {
  if (typeof window === "undefined") return {};
  return window.__FIREBASE_CONFIG__ ?? {};
};

/**
 * App Check es un requisito de la configuración de cliente: si falta la clave,
 * no se inicializan servicios que terminarían enviando peticiones sin token.
 */
export const hasValidFirebaseConfig = (): boolean => {
  const config = getFirebaseConfig();
  return requiredConfigKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

export const getFirebaseApp = (): FirebaseApp => {
  if (!hasValidFirebaseConfig()) {
    throw new Error(
      "Falta configurar Firebase y App Check (PUBLIC_FIREBASE_* y PUBLIC_APPCHECK_SITE_KEY)."
    );
  }

  const config = getFirebaseConfig();
  const app = getApps().length > 0 ? getApp() : initializeApp(config);

  if (!appCheckInitialized) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(config.appCheckSiteKey!.trim()),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  return app;
};
