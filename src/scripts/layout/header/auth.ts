import { AUTH_CHANGED_EVENT, AUTH_STATE_STORAGE_KEY } from "./constants";

type AuthState = {
  isAuthenticated?: boolean;
  email?: string | null | undefined;
  photoURL?: string | null | undefined;
  displayName?: string | null | undefined;
} | null | undefined;

type AuthElements = {
  desktopMyPosts: HTMLElement | null;
  desktopLogin: HTMLElement | null;
  desktopRegister: HTMLElement | null;
  mobileMyPosts: HTMLElement | null;
  mobileLogin: HTMLElement | null;
  mobileRegister: HTMLElement | null;
  mobileAuthHr: HTMLElement | null;
  desktopProfileMenu: HTMLElement | null;
  desktopProfileButton: HTMLButtonElement | null;
  desktopProfileDropdown: HTMLElement | null;
  desktopProfileEmail: HTMLElement | null;
  desktopProfileAvatarImage: HTMLImageElement | null;
  desktopProfileAvatarFallback: HTMLElement | null;
  desktopLogoutButton: HTMLButtonElement | null;
  mobileProfileMenu: HTMLElement | null;
  mobileProfileEmail: HTMLElement | null;
  mobileLogoutButton: HTMLButtonElement | null;
};

const getAuthElements = (): AuthElements => ({
  desktopMyPosts: document.getElementById("desktop-my-posts"),
  desktopLogin: document.getElementById("desktop-login"),
  desktopRegister: document.getElementById("desktop-register"),
  mobileMyPosts: document.getElementById("mobile-my-posts"),
  mobileLogin: document.getElementById("mobile-login"),
  mobileRegister: document.getElementById("mobile-register"),
  mobileAuthHr: document.getElementById("mobile-auth-hr"),
  desktopProfileMenu: document.getElementById("desktop-profile-menu"),
  desktopProfileButton: document.getElementById(
    "desktop-profile-button"
  ) as HTMLButtonElement | null,
  desktopProfileDropdown: document.getElementById("desktop-profile-dropdown"),
  desktopProfileEmail: document.getElementById("desktop-profile-email"),
  desktopProfileAvatarImage: document.getElementById(
    "desktop-profile-avatar-image"
  ) as HTMLImageElement | null,
  desktopProfileAvatarFallback: document.getElementById(
    "desktop-profile-avatar-fallback"
  ),
  desktopLogoutButton: document.getElementById(
    "desktop-logout-button"
  ) as HTMLButtonElement | null,
  mobileProfileMenu: document.getElementById("mobile-profile-menu"),
  mobileProfileEmail: document.getElementById("mobile-profile-email"),
  mobileLogoutButton: document.getElementById(
    "mobile-logout-button"
  ) as HTMLButtonElement | null,
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
        photoURL: typeof state.photoURL === "string" ? state.photoURL : null,
        displayName:
          typeof state.displayName === "string" ? state.displayName : null,
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
  email: string | null,
  photoURL: string | null,
  elements: AuthElements
): void => {
  const isSignedIn = isAuthenticated === true;
  const hideGuestActions = isSignedIn;

  [elements.desktopMyPosts, elements.mobileMyPosts].forEach((element) => {
    element?.classList.toggle("hidden", !isSignedIn);
  });

  [
    elements.desktopLogin,
    elements.desktopRegister,
    elements.mobileLogin,
    elements.mobileRegister,
  ].forEach((element) => {
    element?.classList.toggle("hidden", hideGuestActions);
  });

  elements.mobileAuthHr?.classList.toggle("hidden", hideGuestActions);
  elements.desktopProfileMenu?.classList.toggle("hidden", !hideGuestActions);
  elements.mobileProfileMenu?.classList.toggle("hidden", !hideGuestActions);

  const safeEmail = email ?? "";
  if (elements.desktopProfileEmail) {
    elements.desktopProfileEmail.textContent = safeEmail || "Mi perfil";
  }
  if (elements.mobileProfileEmail) {
    elements.mobileProfileEmail.textContent = safeEmail || "Mi perfil";
  }

  const initial = safeEmail.trim().charAt(0).toUpperCase() || "U";
  if (elements.desktopProfileAvatarFallback) {
    elements.desktopProfileAvatarFallback.textContent = initial;
  }

  if (elements.desktopProfileAvatarImage) {
    if (photoURL) {
      elements.desktopProfileAvatarImage.src = photoURL;
      elements.desktopProfileAvatarImage.classList.remove("hidden");
      elements.desktopProfileAvatarFallback?.classList.add("hidden");
    } else {
      elements.desktopProfileAvatarImage.removeAttribute("src");
      elements.desktopProfileAvatarImage.classList.add("hidden");
      elements.desktopProfileAvatarFallback?.classList.remove("hidden");
    }
  }

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

const resolveStoredAuthDetails = (): {
  email: string | null;
  photoURL: string | null;
} => {
  try {
    const raw = localStorage.getItem(AUTH_STATE_STORAGE_KEY);
    if (!raw) return { email: null, photoURL: null };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === "string" ? parsed.email : null,
      photoURL: typeof parsed?.photoURL === "string" ? parsed.photoURL : null,
    };
  } catch {
    return { email: null, photoURL: null };
  }
};

const closeDesktopProfileDropdown = (elements: AuthElements): void => {
  if (!elements.desktopProfileButton || !elements.desktopProfileDropdown) return;

  elements.desktopProfileButton.setAttribute("aria-expanded", "false");
  elements.desktopProfileDropdown.classList.add("hidden");
};

const openDesktopProfileDropdown = (elements: AuthElements): void => {
  if (!elements.desktopProfileButton || !elements.desktopProfileDropdown) return;

  elements.desktopProfileButton.setAttribute("aria-expanded", "true");
  elements.desktopProfileDropdown.classList.remove("hidden");
};

const setAndBroadcastAuthState = (state: {
  isAuthenticated: boolean;
  email: string | null;
  photoURL: string | null;
  displayName: string | null;
}): void => {
  const runtimeWindow = window as Window & { __BLOG_AUTH_STATE__?: AuthState };
  runtimeWindow.__BLOG_AUTH_STATE__ = state;
  persistAuthState(state);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: state }));
};

const hasValidFirebaseConfig = (): boolean => {
  const config = (
    window as Window & { __FIREBASE_CONFIG__?: Record<string, string> }
  ).__FIREBASE_CONFIG__ || {};

  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

const logoutFromHeader = async (elements: AuthElements): Promise<void> => {
  closeDesktopProfileDropdown(elements);

  elements.desktopLogoutButton?.setAttribute("disabled", "true");
  elements.mobileLogoutButton?.setAttribute("disabled", "true");

  try {
    if (hasValidFirebaseConfig()) {
      const firebaseConfig = (
        window as Window & { __FIREBASE_CONFIG__?: Record<string, string> }
      ).__FIREBASE_CONFIG__ || {};

      const [firebaseApp, firebaseAuth] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      ]);

      const { getApp, getApps, initializeApp } = firebaseApp;
      const { getAuth, signOut } = firebaseAuth;
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    }

    setAndBroadcastAuthState({
      isAuthenticated: false,
      email: null,
      photoURL: null,
      displayName: null,
    });
    window.location.assign("/acceder");
  } catch {
    elements.desktopLogoutButton?.removeAttribute("disabled");
    elements.mobileLogoutButton?.removeAttribute("disabled");
  }
};

const initDesktopProfileDropdown = (elements: AuthElements): void => {
  if (!elements.desktopProfileButton || !elements.desktopProfileDropdown) return;

  elements.desktopProfileButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen =
      elements.desktopProfileButton?.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      closeDesktopProfileDropdown(elements);
    } else {
      openDesktopProfileDropdown(elements);
    }
  });

  elements.desktopProfileDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeDesktopProfileDropdown(elements);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDesktopProfileDropdown(elements);
    }
  });
};

export const initHeaderAuth = (): void => {
  const elements = getAuthElements();
  const initialDetails = resolveStoredAuthDetails();

  applyAuthUiState(
    resolveInitialAuthState(),
    initialDetails.email,
    initialDetails.photoURL,
    elements
  );

  initDesktopProfileDropdown(elements);

  elements.desktopLogoutButton?.addEventListener("click", () => {
    logoutFromHeader(elements);
  });

  elements.mobileLogoutButton?.addEventListener("click", () => {
    logoutFromHeader(elements);
  });

  window.addEventListener(AUTH_CHANGED_EVENT, (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const detail = event.detail as AuthState;
    const isAuthenticated =
      detail && typeof detail === "object" && detail.isAuthenticated === true;
    const email =
      detail && typeof detail === "object" && typeof detail.email === "string"
        ? detail.email
        : null;
    const photoURL =
      detail &&
      typeof detail === "object" &&
      typeof detail.photoURL === "string"
        ? detail.photoURL
        : null;

    persistAuthState(detail);
    applyAuthUiState(isAuthenticated, email, photoURL, elements);
  });

  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== AUTH_STATE_STORAGE_KEY) return;
    const details = resolveStoredAuthDetails();
    applyAuthUiState(
      readStoredAuthState(),
      details.email,
      details.photoURL,
      elements
    );
  });
};
