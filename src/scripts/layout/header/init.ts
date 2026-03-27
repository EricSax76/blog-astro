import { initHeaderAuth } from "./auth";
import { initHeaderContentDropdown } from "./content-dropdown";
import { initHeaderMobileMenu } from "./mobile-menu";

export const initHeader = (): void => {
  initHeaderAuth();
  initHeaderMobileMenu();
  initHeaderContentDropdown();
};
