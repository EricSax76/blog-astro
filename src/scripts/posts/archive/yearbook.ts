import "../social/interactions.js";

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

// El año a consultar lo fija la página vía data-year; fallback al año actual.
const ARCHIVE_YEAR = (() => {
  const raw = postsGrid?.dataset.year;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
})();

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
  subtitle.textContent = `Aquí aparecerán los posts publicados en ${ARCHIVE_YEAR}.`;
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
    img.loading = "lazy";
    img.decoding = "async";
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

  // Social Interactions
  const social = document.createElement("blog-social-interactions");
  social.dataset.postId = post.id;
  social.dataset.postTitle = post.title;
  article.appendChild(social);

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

// Paginación por cursor: se piden páginas de PAGE_SIZE posts y un botón
// "Ver más" carga la siguiente. Evita descargar el año completo de golpe.
const PAGE_SIZE = 20;

const createLoadMoreButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "mx-auto block rounded-full border border-sage/30 bg-white px-6 py-2 text-sm font-semibold text-deep-green shadow-sm hover:bg-sage/10 transition-colors";
  button.textContent = "Ver más entradas";
  return button;
};

const loadPostsForYear = async () => {
  if (!postsGrid) return;

  if (!hasValidFirebaseConfig()) {
    showError("Falta configurar Firebase (`PUBLIC_FIREBASE_*`).");
    return;
  }

  try {
    const [firebaseApp, firebaseFirestore] = await Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
    ]);

    const { initializeApp, getApp, getApps } = firebaseApp;
    const {
      getFirestore,
      collection,
      query,
      where,
      orderBy,
      getDocs,
      limit,
      startAfter,
    } = firebaseFirestore;

    const config = window.__FIREBASE_CONFIG__ as Record<string, string>;
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const db = getFirestore(app);

    const postsRef = collection(db, "posts");
    const loadMoreButton = createLoadMoreButton();
    let cursor: unknown = null;
    let isFirstPage = true;

    const loadPage = async (): Promise<void> => {
      loadMoreButton.disabled = true;

      const constraints = [
        where("year", "==", ARCHIVE_YEAR),
        orderBy("createdAt", "desc"),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PAGE_SIZE),
      ];

      let loadedPosts: LoadedPost[] = [];
      let pageIsFull = false;

      try {
        const snapshot = await getDocs(query(postsRef, ...constraints));
        loadedPosts = mapSnapshotToPosts(snapshot);
        cursor = snapshot.docs[snapshot.docs.length - 1] ?? cursor;
        pageIsFull = snapshot.docs.length === PAGE_SIZE;
      } catch (error) {
        if (!isMissingIndexError(error)) {
          throw error;
        }

        // Sin índice compuesto no hay orden estable para cursores:
        // se degrada a la carga completa del año (comportamiento previo).
        console.warn(
          `[archivo/${ARCHIVE_YEAR}] missing index for year + createdAt, using fallback query`
        );
        const fallbackSnapshot = await getDocs(
          query(postsRef, where("year", "==", ARCHIVE_YEAR))
        );
        loadedPosts = mapSnapshotToPosts(fallbackSnapshot);
        pageIsFull = false;
      }

      if (isFirstPage) {
        clearRenderedPosts();
        removeLoadingAndError();

        if (loadedPosts.length === 0) {
          attachPostCard(createEmptyCard());
          return;
        }
        isFirstPage = false;
      }

      loadMoreButton.remove();
      loadedPosts.forEach((post) => {
        attachPostCard(createPostCard(post));
      });

      if (pageIsFull) {
        loadMoreButton.disabled = false;
        postsGrid.appendChild(loadMoreButton);
      }
    };

    loadMoreButton.addEventListener("click", () => {
      loadPage().catch((error) => {
        console.error(`[archivo/${ARCHIVE_YEAR}] failed to load more posts`, error);
        loadMoreButton.disabled = false;
      });
    });

    await loadPage();
  } catch (error) {
    console.error(`[archivo/${ARCHIVE_YEAR}] failed to load posts`, error);
    showError(
      "No se pudieron leer los posts desde Firestore. Revisa reglas e índice de consulta."
    );
  }
};

loadPostsForYear();
