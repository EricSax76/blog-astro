// Reacción de paralaje muy contenida al puntero para la variante 2.5D.
// Nunca es necesaria para comprender o navegar el hero, y se desactiva
// por completo con prefers-reduced-motion.

const container = document.querySelector<HTMLElement>("[data-hero-parallax]");
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (container && !prefersReducedMotion) {
  const layers = Array.from(
    container.querySelectorAll<HTMLElement>("[data-parallax-layer]")
  ).map((el) => ({
    el,
    strength: Number(el.dataset.parallaxLayer) || 0,
  }));

  let rafId: number | null = null;
  let pendingX = 0;
  let pendingY = 0;

  const applyTransform = () => {
    rafId = null;
    layers.forEach(({ el, strength }) => {
      const moveX = pendingX * strength * 40;
      const moveY = pendingY * strength * 40;
      el.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.1)`;
    });
  };

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    pendingX = (event.clientX - rect.left) / rect.width - 0.5;
    pendingY = (event.clientY - rect.top) / rect.height - 0.5;
    if (rafId === null) rafId = requestAnimationFrame(applyTransform);
  });

  container.addEventListener("pointerleave", () => {
    pendingX = 0;
    pendingY = 0;
    if (rafId === null) rafId = requestAnimationFrame(applyTransform);
  });
}

export {};
