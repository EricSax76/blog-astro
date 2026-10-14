// Hero de la portada: la última entrada como pieza destacada y las
// siguientes en un índice breve. Comparte la consulta con el camino del
// cuaderno (stories-feed), que pinta las entradas que vienen después.
//
// Muchas entradas no traen imagen: la pieza destacada tiene una variante
// tipográfica (el extracto como cita) que es tan válida como la ilustrada.
import {
  HERO_STORY_COUNT,
  HOME_STORY_COUNT,
  formatDate,
  loadLatestStories,
  storyHref,
  type LoadedStory,
} from "./stories-feed";

const featuredSlot = document.getElementById("hero-featured");
const recentBlock = document.getElementById("hero-recent-block");
const recentList = document.getElementById("hero-recent");
const fallbackTemplate = document.getElementById(
  "hero-featured-fallback"
) as HTMLTemplateElement | null;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const initialOf = (name: string): string =>
  name.trim().charAt(0).toLocaleUpperCase("es-ES") || "·";

const buildFeatured = (story: LoadedStory): HTMLElement => {
  const article = el(
    "article",
    "group relative flex min-h-[26rem] flex-col overflow-hidden rounded-[2rem] border border-moss/20 bg-paper shadow-xl shadow-ink/10 transition-shadow duration-[var(--duration-hover)] hover:shadow-2xl hover:shadow-ink/15"
  );

  const link = el(
    "a",
    "flex flex-1 flex-col rounded-[2rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pollen"
  );
  link.href = storyHref(story);

  if (story.imageUrl) {
    const img = el(
      "img",
      "aspect-[16/9] w-full object-cover transition-transform duration-700 ease-[var(--ease-garden)] group-hover:scale-[1.02]"
    );
    img.src = story.imageUrl;
    img.alt = "";
    img.decoding = "async";
    link.appendChild(img);
  } else {
    // Comilla de apertura como ornamento de la variante sin imagen.
    const mark = el(
      "span",
      "pointer-events-none absolute right-6 top-14 hidden select-none sm:block font-serif text-[11rem] font-bold leading-none text-pollen/25",
      "“"
    );
    mark.setAttribute("aria-hidden", "true");
    article.appendChild(mark);
  }

  const body = el("div", "relative flex flex-1 flex-col gap-5 p-8 md:p-10");

  const meta = el(
    "p",
    "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-moss-text"
  );
  const label = el("span", "flex items-center gap-2 whitespace-nowrap");
  const dot = el("span", "inline-block h-1.5 w-1.5 rounded-full bg-pollen");
  dot.setAttribute("aria-hidden", "true");
  label.append(dot, document.createTextNode("Lo último del cuaderno"));
  const date = el("span", "whitespace-nowrap", formatDate(story.createdAt));
  meta.append(label, date);

  const title = el(
    "h2",
    "font-serif text-3xl font-bold leading-tight text-ink md:text-4xl",
    story.title
  );

  const excerpt = story.imageUrl
    ? el("p", "leading-relaxed text-ink/75", story.excerpt)
    : el(
        "blockquote",
        "border-l-2 border-pollen pl-5 font-serif text-xl italic leading-snug text-ink/80 md:text-2xl",
        story.excerpt
      );

  const footer = el("div", "mt-auto flex items-center justify-between gap-4 pt-2");
  const byline = el("span", "flex items-center gap-3");
  const avatar = el(
    "span",
    "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-moss/20 font-serif text-lg font-bold text-ink",
    initialOf(story.authorName)
  );
  avatar.setAttribute("aria-hidden", "true");
  const who = el("span", "text-sm leading-tight");
  who.append(
    el("span", "block font-semibold text-ink", story.authorName),
    el("span", "text-ink/60", `${story.readingMinutes} min de lectura`)
  );
  byline.append(avatar, who);
  const cta = el(
    "span",
    "shrink-0 text-sm font-semibold text-moss-text transition-colors group-hover:text-ink",
    "Leer →"
  );
  footer.append(byline, cta);

  body.append(meta, title, excerpt, footer);
  link.appendChild(body);
  article.appendChild(link);
  return article;
};

const buildRecent = (story: LoadedStory, position: number): HTMLElement => {
  const item = el("li", "py-5 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0");

  const link = el(
    "a",
    "group block space-y-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-pollen focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
  );
  link.href = storyHref(story);

  const meta = el("p", "flex items-baseline gap-3");
  const number = el(
    "span",
    "font-serif text-3xl font-bold leading-none text-pollen",
    String(position).padStart(2, "0")
  );
  number.setAttribute("aria-hidden", "true");
  meta.append(
    number,
    el(
      "span",
      "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-moss-text",
      formatDate(story.createdAt)
    )
  );

  const title = el(
    "h3",
    "line-clamp-2 font-serif text-xl font-bold leading-snug text-ink transition-colors group-hover:text-moss-text",
    story.title
  );

  const byline = el(
    "p",
    "text-xs text-ink/60",
    `${story.authorName} · ${story.readingMinutes} min`
  );

  link.append(meta, title, byline);
  item.appendChild(link);
  return item;
};

const showFallback = () => {
  if (featuredSlot && fallbackTemplate) {
    featuredSlot.replaceChildren(fallbackTemplate.content.cloneNode(true));
  }
  recentBlock?.classList.add("hidden");
};

const init = async () => {
  if (!featuredSlot) return;

  let stories: LoadedStory[] = [];
  try {
    stories = (await loadLatestStories(HOME_STORY_COUNT)).slice(0, HERO_STORY_COUNT);
  } catch (error) {
    console.error("[home] no se pudo cargar la entrada destacada", error);
  }

  featuredSlot.setAttribute("aria-busy", "false");

  const [featured, ...recent] = stories;
  if (!featured) {
    showFallback();
    return;
  }

  featuredSlot.replaceChildren(buildFeatured(featured));

  if (recent.length === 0 || !recentList) {
    recentBlock?.classList.add("hidden");
    return;
  }
  recentList.replaceChildren(...recent.map((story, index) => buildRecent(story, index + 2)));
};

void init();
