const SVG_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
const SVG_HAMBURGER = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>`;

export const initHeaderMobileMenu = (): void => {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (!(menuBtn instanceof HTMLButtonElement)) return;
  if (!(mobileMenu instanceof HTMLElement)) return;

  let isMenuOpen = false;

  // Contenido de fondo que debe quedar inerte mientras el dialog está
  // abierto (el menú es un overlay fixed que tapa toda la página).
  const getBackgroundRegions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>("main, footer"));

  const getFocusableInMenu = (): HTMLElement[] =>
    Array.from(
      mobileMenu.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((element) => element.offsetParent !== null);

  const openMenu = () => {
    isMenuOpen = true;
    mobileMenu.classList.remove("opacity-0", "pointer-events-none");
    document.body.style.overflow = "hidden";
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Cerrar menú de navegación");
    menuBtn.innerHTML = SVG_CLOSE;
    getBackgroundRegions().forEach((region) => {
      region.setAttribute("inert", "");
      region.setAttribute("aria-hidden", "true");
    });
    const firstLink = mobileMenu.querySelector<HTMLElement>("a, button");
    firstLink?.focus();
  };

  const closeMenu = () => {
    isMenuOpen = false;
    mobileMenu.classList.add("opacity-0", "pointer-events-none");
    document.body.style.overflow = "";
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menú de navegación");
    menuBtn.innerHTML = SVG_HAMBURGER;
    getBackgroundRegions().forEach((region) => {
      region.removeAttribute("inert");
      region.removeAttribute("aria-hidden");
    });
    menuBtn.focus();
  };

  menuBtn.addEventListener("click", () => {
    isMenuOpen ? closeMenu() : openMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (!isMenuOpen) return;

    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    // Focus trap: Tab circula entre el botón de cierre (en el header) y los
    // elementos del menú; nunca sale al contenido de fondo.
    if (event.key === "Tab") {
      const cycle = [menuBtn, ...getFocusableInMenu()];
      if (cycle.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? cycle.indexOf(active) : -1;

      let nextIndex: number;
      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? cycle.length - 1 : currentIndex - 1;
      } else {
        nextIndex =
          currentIndex === -1 || currentIndex === cycle.length - 1
            ? 0
            : currentIndex + 1;
      }

      event.preventDefault();
      cycle[nextIndex]?.focus();
    }
  });

  mobileMenu.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
};
