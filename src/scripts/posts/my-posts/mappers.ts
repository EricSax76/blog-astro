import type { LoadedPost, SnapshotLike } from "./types";

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

const resolveYear = (rawData: Record<string, unknown>): number | null => {
  const year = rawData.year;
  if (typeof year === "number" && Number.isFinite(year)) {
    return year;
  }
  return null;
};

export const mapSnapshotToPosts = (snapshot: SnapshotLike): LoadedPost[] => {
  const posts = snapshot.docs.map((docSnapshot) => {
    const rawData = docSnapshot.data() as Record<string, unknown>;

    return {
      id: docSnapshot.id,
      title: String(rawData.title ?? "").trim(),
      content: String(rawData.content ?? "").trim(),
      imageUrl: String(rawData.imageUrl ?? "").trim(),
      year: resolveYear(rawData),
      createdAt: resolvePostDate(rawData),
    };
  });

  return posts.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = b.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });
};

export const isMissingIndexError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "failed-precondition" &&
    typeof maybeError.message === "string" &&
    maybeError.message.toLowerCase().includes("requires an index")
  );
};
