const MENU_ITEM_SELECTOR = '[role="menuitem"]';

export const initHeaderContentDropdown = (): void => {
  const contenidoBtn = document.getElementById("contenido-btn");
  const contenidoDropdown = document.getElementById("contenido-dropdown");

  if (!(contenidoBtn instanceof HTMLButtonElement)) return;
  if (!(contenidoDropdown instanceof HTMLElement)) return;

  const getMenuItems = () =>
    Array.from(
      contenidoDropdown.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
    );

  const openDropdown = () => {
    contenidoBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => getMenuItems()[0]?.focus());
  };

  const closeDropdown = (returnFocus = true) => {
    contenidoBtn.setAttribute("aria-expanded", "false");
    if (returnFocus) contenidoBtn.focus();
  };

  contenidoBtn.addEventListener("click", () => {
    contenidoBtn.getAttribute("aria-expanded") === "true"
      ? closeDropdown()
      : openDropdown();
  });

  contenidoDropdown.addEventListener("keydown", (event) => {
    const items = getMenuItems();
    if (items.length === 0) return;

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const currentIndex = activeElement ? items.indexOf(activeElement) : -1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      closeDropdown();
    } else if (event.key === "Tab") {
      closeDropdown(false);
    }
  });

  contenidoDropdown.addEventListener("focusout", (event) => {
    const relatedTarget = event.relatedTarget;
    const isNode = relatedTarget instanceof Node;

    if (!isNode) {
      contenidoBtn.setAttribute("aria-expanded", "false");
      return;
    }

    if (
      !contenidoDropdown.contains(relatedTarget) &&
      relatedTarget !== contenidoBtn
    ) {
      contenidoBtn.setAttribute("aria-expanded", "false");
    }
  });

  const dropdownWrapper = contenidoBtn.closest(".group");
  dropdownWrapper?.addEventListener("mouseenter", () =>
    contenidoBtn.setAttribute("aria-expanded", "true")
  );
  dropdownWrapper?.addEventListener("mouseleave", () =>
    contenidoBtn.setAttribute("aria-expanded", "false")
  );
};
