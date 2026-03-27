import type { LoadedPost } from "./types";

type UiElements = {
  grid: HTMLElement;
  configWarning: HTMLElement | null;
  authRequired: HTMLElement | null;
  loadingCard: HTMLElement | null;
  errorCard: HTMLElement | null;
  errorText: HTMLElement | null;
  emptyCard: HTMLElement | null;
};

type MyPostsUi = {
  clearCards: () => void;
  showConfigWarning: () => void;
  showAuthRequired: () => void;
  showLoading: () => void;
  showError: (message: string) => void;
  showEmpty: () => void;
  showPosts: (posts: LoadedPost[]) => void;
};

const formatDate = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const setVisible = (element: HTMLElement | null, visible: boolean): void => {
  if (!element) return;
  element.classList.toggle("hidden", !visible);
};

const createPostCard = (post: LoadedPost): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "rounded-[2rem] border border-sage/20 bg-white p-6 shadow-xl shadow-sage/5 md:p-8";

  const top = document.createElement("div");
  top.className = "flex flex-wrap items-center justify-between gap-3";

  const yearBadge = document.createElement("p");
  yearBadge.className =
    "inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-deep-green/70";
  yearBadge.textContent =
    typeof post.year === "number" ? `Anuario ${post.year}` : "Año no definido";
  top.appendChild(yearBadge);

  if (typeof post.year === "number") {
    const yearLink = document.createElement("a");
    yearLink.href = `/archivo/${post.year}`;
    yearLink.className =
      "text-sm font-semibold text-deep-green underline decoration-sage/50 underline-offset-4 hover:decoration-sage";
    yearLink.textContent = "Ir al anuario";
    top.appendChild(yearLink);
  }

  article.appendChild(top);

  const title = document.createElement("h3");
  title.className = "mt-4 font-serif text-2xl font-semibold text-deep-green";
  title.textContent = post.title || "Entrada sin título";
  article.appendChild(title);

  const dateLabel = formatDate(post.createdAt);
  if (dateLabel) {
    const meta = document.createElement("p");
    meta.className = "mt-1 text-sm italic text-deep-green/60";
    meta.textContent = dateLabel;
    article.appendChild(meta);
  }

  if (post.imageUrl) {
    const figure = document.createElement("div");
    figure.className =
      "mt-5 overflow-hidden rounded-2xl border border-sage/10 shadow-md";
    const image = document.createElement("img");
    image.src = post.imageUrl;
    image.alt = post.title || "Imagen de la publicación";
    image.className = "h-56 w-full object-cover md:h-64";
    figure.appendChild(image);
    article.appendChild(figure);
  }

  const content = document.createElement("div");
  content.className =
    "prose mt-5 max-w-none text-deep-green/80 prose-p:my-2 prose-p:leading-7";

  const paragraphs = post.content
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "Esta publicación no tiene contenido escrito.";
    content.appendChild(placeholder);
  } else {
    paragraphs.forEach((paragraphText) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = paragraphText;
      content.appendChild(paragraph);
    });
  }

  article.appendChild(content);
  return article;
};

const getUiElements = (): UiElements | null => {
  const grid = document.getElementById("my-posts-grid");
  if (!(grid instanceof HTMLElement)) return null;

  return {
    grid,
    configWarning: document.getElementById("my-posts-config-warning"),
    authRequired: document.getElementById("my-posts-auth-required"),
    loadingCard: document.getElementById("my-posts-loading"),
    errorCard: document.getElementById("my-posts-error"),
    errorText: document.getElementById("my-posts-error-text"),
    emptyCard: document.getElementById("my-posts-empty"),
  };
};

export const createMyPostsUi = (): MyPostsUi | null => {
  const elements = getUiElements();
  if (!elements) return null;

  const clearCards = (): void => {
    elements.grid.innerHTML = "";
  };

  const hideStatusCards = (): void => {
    setVisible(elements.configWarning, false);
    setVisible(elements.authRequired, false);
    setVisible(elements.loadingCard, false);
    setVisible(elements.errorCard, false);
    setVisible(elements.emptyCard, false);
  };

  return {
    clearCards,
    showConfigWarning: (): void => {
      clearCards();
      hideStatusCards();
      setVisible(elements.configWarning, true);
    },
    showAuthRequired: (): void => {
      clearCards();
      hideStatusCards();
      setVisible(elements.authRequired, true);
    },
    showLoading: (): void => {
      clearCards();
      hideStatusCards();
      setVisible(elements.loadingCard, true);
    },
    showError: (message: string): void => {
      clearCards();
      hideStatusCards();
      if (elements.errorText) {
        elements.errorText.textContent = message;
      }
      setVisible(elements.errorCard, true);
    },
    showEmpty: (): void => {
      clearCards();
      hideStatusCards();
      setVisible(elements.emptyCard, true);
    },
    showPosts: (posts: LoadedPost[]): void => {
      clearCards();
      hideStatusCards();
      posts.forEach((post) => {
        elements.grid.appendChild(createPostCard(post));
      });
    },
  };
};
