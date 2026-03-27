import { AUTH_CHANGED_EVENT, AUTH_STATE_STORAGE_KEY } from "./constants";

type AuthState = {
  isAuthenticated?: boolean;
  email?: string | null | undefined;
} | null | undefined;

type AuthElements = {
  desktopLogin: HTMLElement | null;
  desktopRegister: HTMLElement | null;
  mobileLogin: HTMLElement | null;
  mobileRegister: HTMLElement | null;
  mobileAuthHr: HTMLElement | null;
};

const getAuthElements = (): AuthElements => ({
  desktopLogin: document.getElementById("desktop-login"),
  desktopRegister: document.getElementById("desktop-register"),
  mobileLogin: document.getElementById("mobile-login"),
  mobileRegister: document.getElementById("mobile-register"),
  mobileAuthHr: document.getElementById("mobile-auth-hr"),
});

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

const persistAuthState = (state: AuthState): void => {
  if (!state || typeof state !== "object") return;

  try {
    localStorage.setItem(
      AUTH_STATE_STORAGE_KEY,
      JSON.stringify({
        isAuthenticated: state.isAuthenticated === true,
        email: typeof state.email === "string" ? state.email : null,
      })
    );
  } catch {
    // Silenciar errores de localStorage (modo privado, cuota, etc.)
  }
};

const announceAuthStatus = (isAuthenticated: boolean): void => {
  const announcer = document.getElementById("auth-status-announcer");
  if (!announcer) return;

  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = isAuthenticated
      ? "Sesión iniciada."
      : "Sesión cerrada.";
    setTimeout(() => {
      announcer.textContent = "";
    }, 4000);
  });
};

const applyAuthUiState = (
  isAuthenticated: boolean,
  elements: AuthElements
): void => {
  const hideGuestActions = isAuthenticated === true;
  [
    elements.desktopLogin,
    elements.desktopRegister,
    elements.mobileLogin,
    elements.mobileRegister,
  ].forEach((element) => {
    element?.classList.toggle("hidden", hideGuestActions);
  });

  elements.mobileAuthHr?.classList.toggle("hidden", hideGuestActions);
  announceAuthStatus(isAuthenticated);
};

const resolveInitialAuthState = (): boolean => {
  const runtimeState = (
    window as Window & { __BLOG_AUTH_STATE__?: AuthState }
  ).__BLOG_AUTH_STATE__;

  if (
    runtimeState &&
    typeof runtimeState === "object" &&
    runtimeState.isAuthenticated === true
  ) {
    return true;
  }

  return readStoredAuthState();
};

export const initHeaderAuth = (): void => {
  const elements = getAuthElements();
  applyAuthUiState(resolveInitialAuthState(), elements);

  window.addEventListener(AUTH_CHANGED_EVENT, (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const detail = event.detail as AuthState;
    const isAuthenticated =
      detail && typeof detail === "object" && detail.isAuthenticated === true;

    persistAuthState(detail);
    applyAuthUiState(isAuthenticated, elements);
  });

  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== AUTH_STATE_STORAGE_KEY) return;
    applyAuthUiState(readStoredAuthState(), elements);
  });
};
