const SVG_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
const SVG_HAMBURGER = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>`;

export const initHeaderMobileMenu = (): void => {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (!(menuBtn instanceof HTMLButtonElement)) return;
  if (!(mobileMenu instanceof HTMLElement)) return;

  let isMenuOpen = false;

  const openMenu = () => {
    isMenuOpen = true;
    mobileMenu.classList.remove("opacity-0", "pointer-events-none");
    document.body.style.overflow = "hidden";
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Cerrar menú de navegación");
    menuBtn.innerHTML = SVG_CLOSE;
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
    menuBtn.focus();
  };

  menuBtn.addEventListener("click", () => {
    isMenuOpen ? closeMenu() : openMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMenuOpen) {
      closeMenu();
    }
  });

  mobileMenu.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
};
