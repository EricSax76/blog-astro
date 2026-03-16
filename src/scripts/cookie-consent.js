/**
 * cookie-consent.js
 * Gestión de consentimiento de cookies conforme a LOPDGDD/RGPD.
 * Almacena las preferencias en localStorage bajo la clave "blog-cookie-consent".
 */

const STORAGE_KEY = "blog-cookie-consent";
const CONSENT_VERSION = "1"; // Incrementar si cambia el propósito de las cookies

/**
 * @typedef {Object} ConsentPreferences
 * @property {string} version
 * @property {string} date         - ISO 8601
 * @property {boolean} necessary   - Siempre true (no se puede desactivar)
 * @property {boolean} functional  - Preferencias del usuario
 * @property {boolean} analytics   - Analítica (actualmente no activa)
 * @property {boolean} marketing   - Marketing (actualmente no activa)
 */

/**
 * Lee las preferencias guardadas. Devuelve null si no hay consentimiento previo.
 * @returns {ConsentPreferences|null}
 */
export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Si la versión no coincide, se considera caducado
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Guarda las preferencias de consentimiento.
 * @param {{ functional: boolean, analytics: boolean, marketing: boolean }} prefs
 * @returns {ConsentPreferences}
 */
export function saveConsent({ functional = false, analytics = false, marketing = false } = {}) {
  const consent = {
    version: CONSENT_VERSION,
    date: new Date().toISOString(),
    necessary: true,
    functional,
    analytics,
    marketing,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // localStorage no disponible (modo privado muy restrictivo)
  }
  applyConsent(consent);
  window.dispatchEvent(new CustomEvent("consent-updated", { detail: consent }));
  return consent;
}

/**
 * Acepta todas las cookies.
 * @returns {ConsentPreferences}
 */
export function acceptAll() {
  return saveConsent({ functional: true, analytics: true, marketing: true });
}

/**
 * Rechaza todas las opcionales (solo necesarias).
 * @returns {ConsentPreferences}
 */
export function rejectAll() {
  return saveConsent({ functional: false, analytics: false, marketing: false });
}

/**
 * Comprueba si el usuario ha tomado una decisión de consentimiento.
 * @returns {boolean}
 */
export function hasConsented() {
  return getConsent() !== null;
}

/**
 * Aplica las consecuencias del consentimiento (bloquear/activar servicios).
 * Ampliar aquí cuando se integren analíticas u otros servicios.
 * @param {ConsentPreferences} consent
 */
function applyConsent(consent) {
  // Analytics: solo activar si el usuario acepta y el servicio está integrado
  if (!consent.analytics) {
    // Deshabilitar Google Analytics / Tag Manager si existiese
    window["ga-disable"] = true;
  }
  // Aquí añadir lógica para otros servicios según consent.marketing, etc.
}

/**
 * Elimina el consentimiento guardado (útil para tests o al borrar cuenta).
 */
export function clearConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Aplicar consentimiento guardado al cargar la página
const existing = getConsent();
if (existing) {
  applyConsent(existing);
}
