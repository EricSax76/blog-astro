type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

const getFirebaseConfig = (): FirebaseConfig =>
  (window as Window & { __FIREBASE_CONFIG__?: FirebaseConfig })
    .__FIREBASE_CONFIG__ || {};

type LoadedStory = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  authorName: string;
  createdAt: Date | null;
  year: number | null;
  readingMinutes: number;
};

const container = document.getElementById("latest-stories");
const loadingState = document.getElementById("latest-stories-loading");
const emptyState = document.getElementById("latest-stories-empty");

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;

const hasValidFirebaseConfig = (): boolean => {
  const config = getFirebaseConfig();
  return requiredConfigKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

const formatDate = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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

const resolveAuthorName = (rawData: Record<string, unknown>): string => {
  const authorName = String(rawData.authorName ?? "").trim();
  if (authorName) return authorName;

  const authorEmail = String(rawData.authorEmail ?? "").trim();
  if (authorEmail) {
    const emailName = authorEmail.split("@")[0]?.trim();
    if (emailName) return emailName;
  }

  return "Autor";
};

const WORDS_PER_MINUTE = 200;

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
      authorName: resolveAuthorName(rawData),
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

const storyHref = (story: LoadedStory): string =>
  story.year ? `/archivo/${story.year}` : "/archivo";

const renderMainStory = (story: LoadedStory): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "group lg:col-span-2 relative overflow-hidden rounded-[2rem] border border-moss/15 bg-paper-dim/60";

  const link = document.createElement("a");
  link.href = storyHref(story);
  link.className = "block";

  if (story.imageUrl) {
    const img = document.createElement("img");
    img.src = story.imageUrl;
    img.alt = story.title;
    img.loading = "lazy";
    img.className =
      "h-56 w-full object-cover transition-transform duration-700 group-hover:scale-105 md:h-72";
    link.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "space-y-3 p-6 md:p-8";

  const meta = document.createElement("p");
  meta.className = "text-xs font-semibold uppercase tracking-[0.2em] text-moss-text";
  const metaParts = [story.authorName, formatDate(story.createdAt), `${story.readingMinutes} min de lectura`].filter(
    Boolean
  );
  meta.textContent = metaParts.join(" · ");

  const title = document.createElement("h3");
  title.className = "font-serif text-2xl font-bold text-ink md:text-3xl";
  title.textContent = story.title;

  const excerpt = document.createElement("p");
  excerpt.className = "text-sm leading-relaxed text-ink/75 md:text-base";
  excerpt.textContent = story.excerpt;

  body.append(meta, title, excerpt);
  link.appendChild(body);
  article.appendChild(link);
  return article;
};

const renderSecondaryStory = (story: LoadedStory): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "group overflow-hidden rounded-3xl border border-moss/15 bg-paper-dim/60";

  const link = document.createElement("a");
  link.href = storyHref(story);
  link.className = "block";

  if (story.imageUrl) {
    const img = document.createElement("img");
    img.src = story.imageUrl;
    img.alt = story.title;
    img.loading = "lazy";
    img.className =
      "h-36 w-full object-cover transition-transform duration-700 group-hover:scale-105";
    link.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "space-y-2 p-5";

  const meta = document.createElement("p");
  meta.className = "text-xs font-semibold uppercase tracking-[0.2em] text-moss-text";
  meta.textContent = [story.authorName, formatDate(story.createdAt)].filter(Boolean).join(" · ");

  const title = document.createElement("h3");
  title.className = "font-serif text-xl font-bold text-ink";
  title.textContent = story.title;

  body.append(meta, title);
  link.appendChild(body);
  article.appendChild(link);
  return article;
};

const renderStories = (stories: LoadedStory[]) => {
  if (!container) return;
  container.innerHTML = "";

  const [main, ...rest] = stories;
  if (main) container.appendChild(renderMainStory(main));
  rest.slice(0, 2).forEach((story) => {
    container.appendChild(renderSecondaryStory(story));
  });
};

const showEmptyState = () => {
  loadingState?.remove();
  emptyState?.classList.remove("hidden");
};

const loadLatestStories = async () => {
  if (!container) return;

  if (!hasValidFirebaseConfig()) {
    showEmptyState();
    return;
  }

  try {
    const [firebaseApp, firebaseFirestore] = await Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
    ]);

    const { initializeApp, getApp, getApps } = firebaseApp;
    const { getFirestore, collection, query, orderBy, limit, getDocs } =
      firebaseFirestore;

    const config = getFirebaseConfig() as Record<string, string>;
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const db = getFirestore(app);

    const postsRef = collection(db, "posts");
    const snapshot = await getDocs(
      query(postsRef, orderBy("createdAt", "desc"), limit(3))
    );
    const stories = mapSnapshotToStories(snapshot);

    loadingState?.remove();

    if (stories.length === 0) {
      showEmptyState();
      return;
    }

    renderStories(stories);
  } catch (error) {
    console.error("[home] failed to load latest stories", error);
    showEmptyState();
  }
};

loadLatestStories();
