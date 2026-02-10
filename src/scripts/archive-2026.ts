export {};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: {
      apiKey?: string;
      authDomain?: string;
      projectId?: string;
      storageBucket?: string;
      messagingSenderId?: string;
      appId?: string;
    };
  }
}

const postsGrid = document.getElementById("posts-grid");
const loadingCard = document.getElementById("posts-loading");
const errorCard = document.getElementById("posts-error");

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;

const hasValidFirebaseConfig = (): boolean => {
  const config = window.__FIREBASE_CONFIG__ || {};
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

type LoadedPost = {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  authorName: string;
  createdAt: Date | null;
};

const createEmptyCard = (): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-sage/5 border border-sage/10";

  const header = document.createElement("header");
  header.className = "mb-6 text-center";
  const title = document.createElement("h2");
  title.className = "font-serif text-3xl md:text-4xl font-bold text-deep-green";
  title.textContent = "Próximamente";
  const subtitle = document.createElement("p");
  subtitle.className = "text-sm text-deep-green/60 italic font-serif";
  subtitle.textContent = "Aquí aparecerán los posts publicados en 2026.";
  header.append(title, subtitle);

  const content = document.createElement("div");
  content.className =
    "prose prose-lg prose-headings:font-serif prose-headings:text-deep-green text-deep-green/80 leading-relaxed max-w-none";
  const p1 = document.createElement("p");
  p1.textContent =
    "Este espacio está listo para recibir tus nuevos textos, reflexiones y fotografías.";
  const p2 = document.createElement("p");
  p2.textContent =
    "Cuando publiques desde el panel, las entradas aparecerán automáticamente aquí.";
  content.append(p1, p2);

  article.append(header, content);
  return article;
};

const createPostCard = (post: LoadedPost): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-sage/5 border border-sage/10";

  const header = document.createElement("header");
  header.className = "mb-6 text-center";

  const title = document.createElement("h2");
  title.className = "font-serif text-3xl md:text-4xl font-bold text-deep-green";
  title.textContent = post.title || "Entrada sin título";
  header.appendChild(title);

  const metaLabelParts = [`Por ${post.authorName}`];
  const dateLabel = formatDate(post.createdAt);
  if (dateLabel) metaLabelParts.push(dateLabel);

  if (metaLabelParts.length > 0) {
    const meta = document.createElement("p");
    meta.className = "text-sm text-deep-green/60 italic font-serif";
    meta.textContent = metaLabelParts.join(" · ");
    header.appendChild(meta);
  }

  article.appendChild(header);

  if (post.imageUrl) {
    const figure = document.createElement("div");
    figure.className =
      "mb-8 overflow-hidden rounded-2xl border border-sage/10 shadow-lg";
    const img = document.createElement("img");
    img.src = post.imageUrl;
    img.alt = post.title || "Imagen del post";
    img.className = "h-64 md:h-80 w-full object-cover";
    figure.appendChild(img);
    article.appendChild(figure);
  }

  const content = document.createElement("div");
  content.className =
    "prose prose-lg prose-headings:font-serif prose-headings:text-deep-green text-deep-green/80 leading-relaxed max-w-none";

  const paragraphs = post.content
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Este post no tiene contenido escrito.";
    content.appendChild(p);
  } else {
    paragraphs.forEach((paragraphText) => {
      const p = document.createElement("p");
      p.textContent = paragraphText;
      content.appendChild(p);
    });
  }

  article.appendChild(content);
  return article;
};

const removeLoadingAndError = () => {
  loadingCard?.remove();
  if (errorCard) {
    errorCard.classList.add("hidden");
  }
};

const showError = (message: string) => {
  if (!errorCard) return;

  const text = errorCard.querySelector("p");
  if (text) {
    text.textContent = message;
  }

  removeLoadingAndError();
  errorCard.classList.remove("hidden");
};

const clearRenderedPosts = () => {
  if (!postsGrid) return;
  const cards = postsGrid.querySelectorAll("[data-post-card='true']");
  cards.forEach((card) => card.remove());
};

const attachPostCard = (card: HTMLElement) => {
  card.setAttribute("data-post-card", "true");
  postsGrid?.appendChild(card);
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

const isMissingIndexError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "failed-precondition" &&
    typeof maybeError.message === "string" &&
    maybeError.message.toLowerCase().includes("requires an index")
  );
};

const mapSnapshotToPosts = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }): LoadedPost[] => {
  const loadedPosts = snapshot.docs.map((docSnapshot) => {
    const rawData = docSnapshot.data() as Record<string, unknown>;

    return {
      id: docSnapshot.id,
      title: String(rawData.title ?? "").trim(),
      content: String(rawData.content ?? "").trim(),
      imageUrl: String(rawData.imageUrl ?? "").trim(),
      authorName: resolveAuthorName(rawData),
      createdAt: resolvePostDate(rawData),
    };
  });

  return loadedPosts.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = b.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });
};

const loadPosts2026 = async () => {
  if (!postsGrid) return;

  if (!hasValidFirebaseConfig()) {
    showError("Falta configurar Firebase (`PUBLIC_FIREBASE_*`).");
    return;
  }

  try {
    const [firebaseApp, firebaseFirestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
    ]);

    const { initializeApp, getApp, getApps } = firebaseApp;
    const { getFirestore, collection, query, where, orderBy, getDocs } =
      firebaseFirestore;

    const config = window.__FIREBASE_CONFIG__ as Record<string, string>;
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const db = getFirestore(app);

    const postsRef = collection(db, "posts");
    const postsQuery = query(
      postsRef,
      where("year", "==", 2026),
      orderBy("createdAt", "desc")
    );

    let loadedPosts: LoadedPost[] = [];

    try {
      const snapshot = await getDocs(postsQuery);
      loadedPosts = mapSnapshotToPosts(snapshot);
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      console.warn(
        "[archivo/2026] missing index for year + createdAt, using fallback query"
      );
      const fallbackQuery = query(postsRef, where("year", "==", 2026));
      const fallbackSnapshot = await getDocs(fallbackQuery);
      loadedPosts = mapSnapshotToPosts(fallbackSnapshot);
    }

    clearRenderedPosts();
    removeLoadingAndError();

    if (loadedPosts.length === 0) {
      attachPostCard(createEmptyCard());
      return;
    }

    loadedPosts.forEach((post) => {
      attachPostCard(createPostCard(post));
    });
  } catch (error) {
    console.error("[archivo/2026] failed to load posts", error);
    showError(
      "No se pudieron leer los posts desde Firestore. Revisa reglas e índice de consulta."
    );
  }
};

loadPosts2026();
