// Revela por scroll los elementos [data-reveal] mediante opacidad y un
// desplazamiento corto. Sin scroll secuestrado: solo añade una clase.
// Con `prefers-reduced-motion: reduce` los elementos aparecen ya visibles.

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const revealTargets = document.querySelectorAll<HTMLElement>("[data-reveal]");

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealTargets.forEach((el) => el.classList.add("is-revealed"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
}

export {};
