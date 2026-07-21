/**
 * publishPost — Publicación de entradas del blog (art. 5.1.f RGPD)
 *
 * Callable function que crea una entrada en la colección "posts".
 * El servidor fija authorUid desde el token de autenticación, impidiendo
 * que el cliente suplante la autoría de otro usuario.
 *
 * La imagen llega como ruta de Storage (imagePath), nunca como URL libre:
 * el servidor valida que pertenece al usuario (blog/posts/{uid}/...), que
 * existe en el bucket del proyecto y que es un raster permitido, y deriva
 * él mismo la URL pública. Así no se pueden inyectar URLs externas ni de
 * tracking en los posts.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDownloadURL } from "firebase-admin/storage";
import * as admin from "firebase-admin";
import { db, bucket } from "../lib/firebase";
import { requireAllowedKeys, cleanOptionalText } from "../lib/validation";
import { enforceRateLimit } from "../lib/rateLimit";

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 10000;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Valida la ruta de Storage de la imagen del post y devuelve su URL pública.
 * Requisitos: prefijo blog/posts/{uid}/, nombre de archivo saneado (sin
 * subdirectorios ni traversal), existencia en el bucket y contentType raster.
 */
async function resolveImageUrl(uid: string, imagePath: unknown): Promise<string> {
  if (imagePath === undefined || imagePath === null || imagePath === "") {
    return "";
  }
  if (typeof imagePath !== "string") {
    throw new HttpsError("invalid-argument", "imagePath debe ser texto.");
  }

  const pathPattern = new RegExp(`^blog/posts/${uid}/[A-Za-z0-9._-]{1,200}$`);
  if (!pathPattern.test(imagePath)) {
    throw new HttpsError(
      "invalid-argument",
      "La imagen debe estar en tu carpeta de Storage (blog/posts/{uid}/)."
    );
  }

  const file = bucket.file(imagePath);
  let contentType: string | undefined;
  try {
    const [metadata] = await file.getMetadata();
    contentType = metadata.contentType ?? undefined;
  } catch {
    throw new HttpsError("invalid-argument", "La imagen indicada no existe.");
  }

  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new HttpsError(
      "invalid-argument",
      "Formato de imagen no permitido. Usa JPEG, PNG, WebP o GIF."
    );
  }

  return getDownloadURL(file);
}

export const publishPost = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para publicar.");
  }

  await enforceRateLimit(uid, "publishPost");

  requireAllowedKeys(request.data, ["title", "content", "imagePath"]);

  const { title, content, imagePath } = (request.data ?? {}) as {
    title?: string;
    content?: string;
    imagePath?: string;
  };

  const cleanTitle = cleanOptionalText(title, "El título", MAX_TITLE_LENGTH);
  const cleanContent = cleanOptionalText(content, "El contenido", MAX_CONTENT_LENGTH);
  const imageUrl = await resolveImageUrl(uid, imagePath);

  if (!cleanTitle && !cleanContent && !imageUrl) {
    throw new HttpsError("invalid-argument", "Añade un título, contenido o imagen antes de publicar.");
  }

  // El año es server-authoritative: se deriva del reloj del servidor,
  // nunca del cliente, para que el archivo clasifique siempre bien.
  const year = new Date().getFullYear();

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() ?? {};
  const authorName =
    userData.username ||
    userData.displayName ||
    request.auth?.token?.email?.split("@")[0] ||
    "Autor";

  const docRef = await db.collection("posts").add({
    title: cleanTitle,
    content: cleanContent,
    imageUrl,
    authorUid: uid,
    authorEmail: request.auth?.token?.email ?? "",
    authorName,
    year,
    likeCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, postId: docRef.id, year };
});
