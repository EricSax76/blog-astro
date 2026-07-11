// Filtra el catálogo por grupo emocional. Lee `?grupo=<slug>` en la carga
// inicial (enlace desde la brújula del index) y sincroniza los botones.

const filterButtons = document.querySelectorAll<HTMLButtonElement>(
  "[data-group-filter]"
);
const flowerCards = document.querySelectorAll<HTMLAnchorElement>(
  "[data-flower-card]"
);

const applyFilter = (groupSlug: string) => {
  flowerCards.forEach((card) => {
    const matches = groupSlug === "all" || card.dataset.group === groupSlug;
    card.classList.toggle("hidden", !matches);
  });

  filterButtons.forEach((button) => {
    const isActive = button.dataset.groupFilter === groupSlug;
    button.dataset.active = String(isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyFilter(button.dataset.groupFilter ?? "all");
  });
});

const initialGroup = new URLSearchParams(window.location.search).get("grupo");
if (initialGroup) {
  applyFilter(initialGroup);
}
