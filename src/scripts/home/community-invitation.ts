import {
  AUTH_CHANGED_EVENT,
  AUTH_STATE_STORAGE_KEY,
} from "../layout/header/constants";

type AuthState = { isAuthenticated?: boolean } | null | undefined;

const ctaLink = document.getElementById(
  "community-cta"
) as HTMLAnchorElement | null;
const ctaLabel = document.getElementById("community-cta-label");

if (ctaLink && ctaLabel) {
  const applyState = (isAuthenticated: boolean) => {
    if (isAuthenticated) {
      ctaLink.href = "/publicar";
      ctaLabel.textContent = "Publicar una entrada";
    } else {
      ctaLink.href = "/registrate";
      ctaLabel.textContent = "Añade tu voz al cuaderno";
    }
  };

  const readStoredAuthState = (): boolean => {
    try {
      const raw = localStorage.getItem(AUTH_STATE_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.isAuthenticated === true;
    } catch {
      return false;
    }
  };

  applyState(readStoredAuthState());

  window.addEventListener(AUTH_CHANGED_EVENT, (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as AuthState;
    applyState(!!detail && detail.isAuthenticated === true);
  });
}
