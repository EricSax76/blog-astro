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
const emptyCard = document.getElementById("posts-empty");
const isSupplementalGrid = postsGrid?.dataset.mode === "supplement";

// Plantilla del pliego renderizada por YearbookEntry.astro (modo template):
// clonar su markup mantiene una sola fuente de verdad para el diseño.
const entryTemplate = document.getElementById(
  "yearbook-entry-template"
) as HTMLTemplateElement | null;

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

const showEmptyState = () => {
  if (isSupplementalGrid) {
    emptyCard?.classList.add("hidden");
    return;
  }
  emptyCard?.classList.remove("hidden");
};

const createPostCard = (post: LoadedPost): HTMLElement | null => {
  const fragment = entryTemplate?.content.cloneNode(true) as
    | DocumentFragment
    | undefined;
  const article = fragment?.querySelector("article");
  if (!article) return null;
  article.removeAttribute("data-reveal");
  article.classList.add("is-revealed");

  const title = article.querySelector("[data-field='title']");
  if (title) title.textContent = post.title || "Entrada sin título";

  const metaLabelParts = [`Por ${post.authorName}`];
  const dateLabel = formatDate(post.createdAt);
  if (dateLabel) metaLabelParts.push(dateLabel);

  const meta = article.querySelector("[data-field='meta']");
  if (meta) meta.textContent = metaLabelParts.join(" · ");

  const figure = article.querySelector("[data-field='figure']");
  const image = article.querySelector<HTMLImageElement>(
    "[data-field='image']"
  );
  if (post.imageUrl && figure && image) {
    image.src = post.imageUrl;
    image.alt = post.title || "Imagen del post";
    figure.classList.remove("hidden");
  } else {
    figure?.remove();
  }

  const body = article.querySelector("[data-field='body']");
  if (body) {
    const paragraphs = post.content
      .split(/\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Este post no tiene contenido escrito.";
      body.appendChild(p);
    } else {
      paragraphs.forEach((paragraphText) => {
        const p = document.createElement("p");
        p.textContent = paragraphText;
        body.appendChild(p);
      });
    }
  }

  // Social Interactions: el hueco del template se sustituye por el web component.
  const socialSlot = article.querySelector("[data-field='social']");
  if (socialSlot) {
    const social = document.createElement("blog-social-interactions");
    social.dataset.postId = post.id;
    social.dataset.postTitle = post.title;
    socialSlot.replaceWith(social);
  }

  return article;
};

const removeLoadingAndError = () => {
  loadingCard?.remove();
  if (errorCard) {
    errorCard.classList.add("hidden");
  }
};

const showError = (message: string) => {
  if (isSupplementalGrid) {
    removeLoadingAndError();
    return;
  }

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

const getExistingPostIds = (): Set<string> => {
  const existing = new Set<string>();
  document.querySelectorAll<HTMLElement>("[data-post-id]").forEach((element) => {
    const postId = element.dataset.postId?.trim();
    if (postId) existing.add(postId);
  });
  return existing;
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
    "mx-auto block rounded-full border border-moss/30 px-6 py-2 text-sm font-semibold text-ink transition-colors hover:bg-moss/10";
  button.textContent = "Ver más entradas";
  return button;
};

const loadPostsForYear = async () => {
  if (!postsGrid) return;

  if (!entryTemplate) {
    showError("Falta la plantilla del pliego (#yearbook-entry-template).");
    return;
  }

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
        const existingPostIds = getExistingPostIds();
        loadedPosts = mapSnapshotToPosts(snapshot).filter(
          (post) => !existingPostIds.has(post.id)
        );
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
        const existingPostIds = getExistingPostIds();
        loadedPosts = mapSnapshotToPosts(fallbackSnapshot).filter(
          (post) => !existingPostIds.has(post.id)
        );
        pageIsFull = false;
      }

      if (isFirstPage) {
        clearRenderedPosts();
        removeLoadingAndError();

        if (loadedPosts.length === 0) {
          showEmptyState();
          return;
        }
        isFirstPage = false;
      }

      loadMoreButton.remove();
      loadedPosts.forEach((post) => {
        const card = createPostCard(post);
        if (card) attachPostCard(card);
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
