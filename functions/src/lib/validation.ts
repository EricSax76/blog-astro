/**
 * Validación compartida de entrada de usuario para callables.
 */

import {HttpsError} from "firebase-functions/v2/https";

/**
 * Neutraliza HTML en texto libre del usuario. Defensa en profundidad:
 * el cliente ya renderiza con textContent, pero el servidor no debe
 * almacenar markup ejecutable (otros consumidores podrían no escapar).
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;|&gt;/g, "")
    .trim();
}

/**
 * Rechaza payloads con campos no esperados. Evita que el cliente cuele
 * claves arbitrarias que acaben persistidas o alteren el comportamiento.
 */
export function requireAllowedKeys(
  data: unknown,
  allowed: readonly string[]
): void {
  if (data === null || data === undefined) return;
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Payload inválido.");
  }
  const extra = Object.keys(data as Record<string, unknown>).filter(
    (key) => !allowed.includes(key)
  );
  if (extra.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `Campos no permitidos: ${extra.join(", ")}.`
    );
  }
}

/**
 * Valida un campo de texto opcional: tipo, longitud máxima y saneado HTML.
 * Devuelve cadena vacía si no viene.
 */
export function cleanOptionalText(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} debe ser texto.`);
  }
  if (value.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} no puede superar ${maxLength} caracteres.`
    );
  }
  return stripHtml(value);
}
