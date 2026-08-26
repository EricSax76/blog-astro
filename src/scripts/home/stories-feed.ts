// Carga de las últimas publicaciones desde Firestore para la portada.
// Compartido por la rejilla 2D (fallback) y el camino 3D: ambos pintan
// exactamente las mismas tarjetas; solo cambia quién las posiciona.
import { getFirebaseApp, hasValidFirebaseConfig } from "../core/firebase-client";

export type LoadedStory = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  authorName: string;
  createdAt: Date | null;
  year: number | null;
  readingMinutes: number;
};

const WORDS_PER_MINUTE = 200;

// Fecha corta («01 ene 2017»): cabe en una línea en las tarjetas del camino.
export const formatDate = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    .replace(".", "");
};

const resolvePostDate = (rawData: Record<string, unknown>): Date | null => {
  const createdAt = rawData.createdAt as { toDate?: () => Date } | undefined;
  if (createdAt && typeof createdAt.toDate === "function") {
    return createdAt.toDate();
  }

  const createdAtMs = rawData.createdAtMs;
  if (typeof createdAtMs === "number" && Number.isFinite(createdAtMs)) {
    return new Date(createdAtMs);
  }

  return null;
};

const buildExcerpt = (content: string): string => {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
};

const estimateReadingMinutes = (content: string): number => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
};

const mapSnapshotToStories = (snapshot: {
  docs: Array<{ id: string; data: () => unknown }>;
}): LoadedStory[] => {
  const stories = snapshot.docs.map((docSnapshot) => {
    const rawData = docSnapshot.data() as Record<string, unknown>;
    const content = String(rawData.content ?? "").trim();
    const year = Number(rawData.year);

    return {
      id: docSnapshot.id,
      title: String(rawData.title ?? "").trim() || "Entrada sin título",
      excerpt: buildExcerpt(content),
      imageUrl: String(rawData.imageUrl ?? "").trim(),
      authorName: String(rawData.authorName ?? "").trim() || "Autor",
      createdAt: resolvePostDate(rawData),
      year: Number.isFinite(year) ? year : null,
      readingMinutes: estimateReadingMinutes(content),
    };
  });

  return stories.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = b.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });
};

/** Enlace a la entrada dentro de su anuario (ancla `post-{id}`). */
export const storyHref = (story: LoadedStory): string =>
  story.year ? `/archivo/${story.year}#post-${story.id}` : "/archivo/2026";

/**
 * Devuelve las últimas `count` publicaciones ordenadas de más reciente a
 * más antigua. Lanza si Firebase no está configurado o falla la consulta.
 */
export const loadLatestStories = async (count: number): Promise<LoadedStory[]> => {
  if (!hasValidFirebaseConfig()) {
    throw new Error("Firebase no configurado");
  }

  const { getFirestore, collection, query, orderBy, limit, getDocs } =
    await import("firebase/firestore");

  const db = getFirestore(getFirebaseApp());
  const snapshot = await getDocs(
    query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(count))
  );

  return mapSnapshotToStories(snapshot);
};
