// «El camino del cuaderno»: las últimas publicaciones dispuestas a lo largo
// de un sendero en profundidad. Las tarjetas son DOM real (texto
// seleccionable, enlaces, foco de teclado); Three.js solo las posiciona
// con CSS3DRenderer. El visor es un bloque de altura normal que se recorre
// por paradas (botones, flechas, deslizar o gesto horizontal del
// trackpad): el scroll vertical de la página nunca queda atrapado.
//
// Mejora progresiva:
//  1. Las tarjetas se pintan siempre primero en una rejilla 2D.
//  2. Si hay movimiento permitido, IntersectionObserver y al menos dos
//     entradas, se cargan Three.js + CSS3DRenderer y las mismas tarjetas
//     pasan a la escena. Cualquier fallo deja la rejilla tal cual.
//
// Las primeras entradas ya las enseña el hero: el camino empieza después.
import {
  HERO_STORY_COUNT,
  HOME_STORY_COUNT,
  formatDate,
  loadLatestStories,
  storyHref,
  type LoadedStory,
} from "./stories-feed";

const MIN_STORIES_FOR_PATH = 2;

// Geometría relativa a la distancia focal. La distancia focal se fija igual
// a la perspectiva del visor (depende de su alto), de modo que la tarjeta
// enfocada se pinta a escala 1: texto nítido y ancho en px predecible.
const CAMERA_FOV = 40;
const SPACING_RATIO = 0.76; // distancia entre paradas, en focales
const PASSED_RATIO = 0.3; // más cerca que esto, la tarjeta ya quedó atrás
const NEAR_FULL_RATIO = 0.9; // lado cercano: opaca solo cerca del foco
const FAR_START_RATIO = 1.32; // lado lejano: empieza a atenuarse
const FAR_END_RATIO = 2.8; // lado lejano: transparente
const CARD_MAX_WIDTH = 400; // px, a escala 1
const CARD_MARGIN = 24; // px, aire entre tarjeta y borde del visor
const LATERAL_MAX = 300; // px, amplitud máxima del serpenteo
const SWIPE_THRESHOLD = 48; // px de desplazamiento táctil para cambiar de parada
const WHEEL_STEP = 60; // deltaX acumulado del trackpad por parada
const WHEEL_COOLDOWN_MS = 450; // un gesto de inercia no salta varias paradas
const PARALLAX = 46; // desplazamiento máximo de cámara con el puntero
const EASE = 0.11;

const root = document.querySelector<HTMLElement>("[data-story-path]");
const grid = document.getElementById("story-path-grid");
const track = document.getElementById("story-path-track");
const stage = document.getElementById("story-path-stage");
const sceneHost = document.getElementById("story-path-scene");
const counter = document.getElementById("story-path-counter");
const hint = document.getElementById("story-path-hint");
const prevButton = document.getElementById("story-path-prev") as HTMLButtonElement | null;
const nextButton = document.getElementById("story-path-next") as HTMLButtonElement | null;
const loadingState = document.getElementById("story-path-loading");

const newestYear = Number(root?.dataset.newestYear) || new Date().getFullYear();

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// ---------------------------------------------------------------------------
// Tarjetas (idénticas en rejilla y en escena)
// ---------------------------------------------------------------------------

const buildStoryCard = (story: LoadedStory, index: number): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "story-card group overflow-hidden rounded-3xl border border-moss/20 bg-paper shadow-lg shadow-ink/5";
  article.dataset.storyIndex = String(index);

  const link = document.createElement("a");
  link.href = storyHref(story);
  link.className = "block focus:outline-none";

  if (story.imageUrl) {
    const img = document.createElement("img");
    img.src = story.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "h-44 w-full object-cover md:h-48";
    link.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "space-y-3 p-6";

  const meta = document.createElement("p");
  meta.className =
    "flex items-baseline justify-between gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-moss-text";
  const number = document.createElement("span");
  // Numeración continua con el hero (01 destacada, 02–04 recientes).
  number.textContent = `Entrada ${String(index + 1 + HERO_STORY_COUNT).padStart(2, "0")}`;
  const date = document.createElement("span");
  date.textContent = formatDate(story.createdAt);
  meta.append(number, date);

  const title = document.createElement("h3");
  title.className = "font-serif text-2xl font-bold leading-tight text-ink";
  title.textContent = story.title;

  const excerpt = document.createElement("p");
  excerpt.className = "text-sm leading-relaxed text-ink/75";
  excerpt.textContent = story.excerpt;

  const footer = document.createElement("p");
  footer.className = "flex items-center justify-between pt-1 text-xs text-ink/60";
  const author = document.createElement("span");
  author.textContent = `${story.authorName} · ${story.readingMinutes} min`;
  const cta = document.createElement("span");
  cta.className = "font-semibold text-moss-text transition-colors group-hover:text-ink";
  cta.textContent = "Leer en el anuario →";
  footer.append(author, cta);

  body.append(meta, title, excerpt, footer);
  link.appendChild(body);
  article.appendChild(link);
  return article;
};

// Última parada del camino: salida hacia el anuario completo.
const buildEndCard = (): HTMLElement => {
  const article = document.createElement("article");
  article.className =
    "story-card story-card--end flex flex-col items-center gap-4 rounded-3xl border border-pollen/60 bg-ink p-8 text-center text-cream shadow-xl";

  const eyebrow = document.createElement("p");
  eyebrow.className = "text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-pollen";
  eyebrow.textContent = "Fin del camino";

  const title = document.createElement("p");
  title.className = "font-serif text-3xl font-bold leading-tight";
  title.textContent = "El cuaderno sigue en el anuario";

  const link = document.createElement("a");
  link.href = `/archivo/${newestYear}`;
  link.className =
    "rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-pollen";
  link.textContent = `Abrir el anuario ${newestYear}`;

  article.append(eyebrow, title, link);
  return article;
};

// ---------------------------------------------------------------------------
// Escena 3D
// ---------------------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Opacidad según la distancia por delante de la cámara, en focales.
// Asimétrica: por el lado cercano la tarjeta crece muy deprisa por la
// perspectiva, así que se desvanece en cuanto deja el foco; por el lejano
// se atenúa despacio.
const opacityForDistance = (aheadRatio: number): number => {
  if (aheadRatio < PASSED_RATIO) return 0;
  if (aheadRatio < NEAR_FULL_RATIO) {
    return smoothstep(PASSED_RATIO, NEAR_FULL_RATIO, aheadRatio) ** 1.5;
  }
  return 1 - smoothstep(FAR_START_RATIO, FAR_END_RATIO, aheadRatio);
};

const activatePath = async (cards: HTMLElement[]): Promise<boolean> => {
  if (!grid || !track || !stage || !sceneHost) return false;

  // Imports dinámicos con desestructuración directa: Rollup solo conserva
  // lo usado (cámara, escena y el renderer CSS3D), no todo three.module.
  const { PerspectiveCamera, Scene } = await import("three");
  const { CSS3DObject, CSS3DRenderer } = await import(
    "three/addons/renderers/CSS3DRenderer.js"
  );

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 12000);
  const renderer = new CSS3DRenderer({ element: sceneHost });

  // Distancia focal = perspectiva CSS del visor (misma fórmula que usa
  // CSS3DRenderer): a esa distancia un elemento se ve a escala 1.
  let focus = 1000;
  let spacing = focus * SPACING_RATIO;

  const stops = [...cards, buildEndCard()];
  const lastIndex = stops.length - 1;

  const objects = stops.map((element) => {
    const object = new CSS3DObject(element);
    scene.add(object);
    return object;
  });

  // Sendero serpenteante: alterna izquierda/derecha con una leve elevación.
  // La amplitud es la que deja la tarjeta entera dentro del visor a escala 1.
  const layout = () => {
    const stageWidth = stage.clientWidth;
    const cardWidth = Math.min(CARD_MAX_WIDTH, stageWidth - CARD_MARGIN * 2);
    stage.style.setProperty("--story-card-width", `${cardWidth}px`);

    const room = (stageWidth - cardWidth) / 2 - CARD_MARGIN;
    const lateral = Math.max(0, Math.min(LATERAL_MAX, room));

    objects.forEach((object, index) => {
      const isEnd = index === lastIndex;
      const x = isEnd ? 0 : Math.sin(index * 1.9) * lateral;
      const y = isEnd ? 0 : Math.cos(index * 1.3) * 30;
      object.position.set(x, y, -index * spacing);
      object.rotation.y = isEnd || lateral === 0 ? 0 : (-x / lateral) * 0.14;
    });
  };

  // El visor debe estar visible antes de medirlo: con `hidden` mide 0.
  grid.classList.add("hidden");
  track.classList.remove("hidden");

  // --- Estado animado -------------------------------------------------------
  let targetIndex = 0; // parada hacia la que viaja la cámara
  let currentZ = focus;
  let pointerX = 0;
  let pointerY = 0;
  let cameraX = 0;
  let cameraY = 0;
  let focalIndex = -1;
  let running = false;
  let frame = 0;
  let dirty = true; // hay que volver a pintar (cámara o puntero en movimiento)

  const targetZ = () => focus - targetIndex * spacing;

  const measure = () => {
    const stageHeight = stage.clientHeight;
    const stageWidth = stage.clientWidth;
    focus = stageHeight / 2 / Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
    spacing = focus * SPACING_RATIO;
    renderer.setSize(stageWidth, stageHeight);
    camera.aspect = stageWidth / stageHeight;
    camera.updateProjectionMatrix();
    layout();
    // La geometría cambia con el tamaño: la cámara salta a su parada en vez
    // de viajar desde una posición que ya no significa nada.
    currentZ = targetZ();
    dirty = true;
  };

  const applyDepth = () => {
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    objects.forEach((object, index) => {
      const ahead = (camera.position.z - object.position.z) / focus; // >0: delante
      const element = object.element as HTMLElement;
      const opacity = opacityForDistance(ahead);

      element.style.opacity = opacity.toFixed(3);
      element.style.pointerEvents = opacity > 0.45 ? "auto" : "none";

      const distanceToFocus = Math.abs(ahead - 1);
      if (ahead >= PASSED_RATIO && distanceToFocus < nearestDistance) {
        nearestDistance = distanceToFocus;
        nearest = index;
      }
    });

    if (nearest !== focalIndex) {
      objects.forEach((object, index) => {
        (object.element as HTMLElement).classList.toggle("is-focal", index === nearest);
      });
      focalIndex = nearest;
      if (counter) {
        counter.textContent =
          nearest === lastIndex
            ? `${cards.length} / ${cards.length}`
            : `${Math.min(nearest + 1, cards.length)} / ${cards.length}`;
      }
    }
  };

  const render = () => {
    const goalZ = targetZ();
    const goalX = pointerX * PARALLAX;
    const goalY = -pointerY * PARALLAX * 0.6;
    const moving =
      Math.abs(goalZ - currentZ) > 0.05 ||
      Math.abs(goalX - cameraX) > 0.05 ||
      Math.abs(goalY - cameraY) > 0.05;

    if (moving || dirty) {
      currentZ += (goalZ - currentZ) * EASE;
      cameraX += (goalX - cameraX) * 0.06;
      cameraY += (goalY - cameraY) * 0.06;
      camera.position.set(cameraX, cameraY, currentZ);
      camera.rotation.y = -pointerX * 0.02;

      applyDepth();
      renderer.render(scene, camera);
      dirty = false;
    }

    frame = running ? requestAnimationFrame(render) : 0;
  };

  const start = () => {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(render);
  };

  const stop = () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  // --- Navegación -----------------------------------------------------------
  const updateControls = () => {
    if (prevButton) prevButton.disabled = targetIndex === 0;
    if (nextButton) nextButton.disabled = targetIndex === lastIndex;
  };

  const goTo = (index: number) => {
    const next = Math.min(lastIndex, Math.max(0, index));
    if (next === targetIndex) return;
    targetIndex = next;
    updateControls();
    hint?.classList.add("opacity-0");
    dirty = true;
  };

  prevButton?.addEventListener("click", () => goTo(targetIndex - 1));
  nextButton?.addEventListener("click", () => goTo(targetIndex + 1));

  // Flechas laterales con el foco dentro del visor. Las verticales no se
  // tocan: siguen desplazando la página.
  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") goTo(targetIndex + 1);
    else if (event.key === "ArrowLeft") goTo(targetIndex - 1);
    else return;
    event.preventDefault();
  });

  // Teclado: al enfocar una tarjeta, la cámara viaja hasta su parada.
  stops.forEach((element, index) => {
    element.addEventListener("focusin", () => goTo(index));
  });

  // Tras deslizar, el «clic» que genera el dedo al levantarse no cuenta.
  let suppressClick = false;

  // Una tarjeta del fondo no abre su entrada al primer clic: la acerca.
  sceneHost.addEventListener(
    "click",
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const card = (event.target as HTMLElement).closest<HTMLElement>(".story-card");
      const index = card ? stops.indexOf(card) : -1;
      if (index >= 0 && index !== targetIndex) {
        event.preventDefault();
        goTo(index);
      }
    },
    { capture: true }
  );

  // Deslizar en táctil (solo horizontal: el gesto vertical sigue siendo
  // scroll de página gracias a touch-action: pan-y en el visor).
  let swipeStart: { x: number; y: number } | null = null;
  stage.addEventListener("pointerdown", (event) => {
    swipeStart = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
  });
  stage.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick = true;
      goTo(targetIndex + (dx < 0 ? 1 : -1));
    }
  });
  stage.addEventListener("pointercancel", () => (swipeStart = null));

  // Gesto horizontal del trackpad: avanza por paradas. La rueda vertical no
  // se intercepta nunca, así que la página se recorre sin pasar por el camino.
  let wheelAccum = 0;
  let wheelLockedUntil = 0;
  stage.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now < wheelLockedUntil) return;
      wheelAccum += event.deltaX;
      if (Math.abs(wheelAccum) > WHEEL_STEP) {
        goTo(targetIndex + Math.sign(wheelAccum));
        wheelAccum = 0;
        wheelLockedUntil = now + WHEEL_COOLDOWN_MS;
      }
    },
    { passive: false }
  );

  // Solo anima mientras el visor está en pantalla.
  const visibility = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
    },
    { threshold: 0 }
  );
  visibility.observe(track);

  // Paralaje contenido con el puntero (desactivado en táctil por ruido).
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    });
    stage.addEventListener("pointerleave", () => {
      pointerX = 0;
      pointerY = 0;
    });
  }

  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { once: true });

  measure();
  updateControls();
  if (track.getBoundingClientRect().bottom > 0) start();
  else render();

  return true;
};

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

// Sin entradas más allá del hero (o si falla la carga) la sección sobra:
// el hero ya muestra lo último o su invitación al archivo.
const hideSection = () => {
  root?.classList.add("hidden");
};

const init = async () => {
  if (!root || !grid) return;

  let stories: LoadedStory[];
  try {
    stories = (await loadLatestStories(HOME_STORY_COUNT)).slice(HERO_STORY_COUNT);
  } catch (error) {
    console.error("[home] no se pudieron cargar las publicaciones", error);
    hideSection();
    return;
  }

  loadingState?.remove();

  if (stories.length === 0) {
    hideSection();
    return;
  }

  const cards = stories.map(buildStoryCard);
  grid.append(...cards);

  const canAnimate =
    !prefersReducedMotion &&
    "IntersectionObserver" in window &&
    stories.length >= MIN_STORIES_FOR_PATH;

  if (!canAnimate) return;

  try {
    await activatePath(cards);
  } catch (error) {
    // Cualquier fallo (import, render) deja la rejilla 2D tal cual.
    console.error("[home] camino 3D no disponible, se mantiene la rejilla", error);
    grid.classList.remove("hidden");
    track?.classList.add("hidden");
  }
};

init();

export {};
