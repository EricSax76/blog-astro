import { getFirebaseApp, hasValidFirebaseConfig } from "../../core/firebase-client";

if (typeof window !== "undefined") {
  const form = document.getElementById("blog-form");
  const controls = Array.from(document.querySelectorAll("[data-publish-control]"));
  const lockedMessage = document.getElementById("publish-locked-message");
  const authEmail = document.getElementById("publish-auth-email");
  const logoutButton = document.getElementById("publish-logout-button");
  const configWarning = document.getElementById("publish-auth-config-warning");

  const setEditorAccess = (enabled) => {
    controls.forEach((element) => {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLButtonElement
      ) {
        element.disabled = !enabled;
      }
    });

    if (form) {
      form.classList.toggle("opacity-60", !enabled);
      form.classList.toggle("opacity-100", enabled);
    }

    if (lockedMessage) {
      lockedMessage.classList.toggle("hidden", enabled);
    }
  };

  const setAuthState = (
    isAuthenticated,
    email = "",
    photoURL = "",
    displayName = ""
  ) => {
    window.__BLOG_AUTH_STATE__ = {
      isAuthenticated,
      email: email || null,
      photoURL: photoURL || null,
      displayName: displayName || null,
    };
    try {
      localStorage.setItem("blog-auth-state", JSON.stringify(window.__BLOG_AUTH_STATE__));
    } catch {}

    if (lockedMessage && !isAuthenticated) {
      lockedMessage.innerHTML =
        'Inicia sesión para escribir y publicar en el cuaderno. <a href="/#login" class="font-semibold underline underline-offset-2">Acceder</a>';
    }

    if (authEmail) {
      authEmail.textContent = isAuthenticated
        ? email || "usuario autenticado"
        : "sin sesión";
    }

    setEditorAccess(isAuthenticated);
    window.dispatchEvent(
      new CustomEvent("blog-auth-changed", { detail: window.__BLOG_AUTH_STATE__ })
    );
  };

  const isConfigValid = hasValidFirebaseConfig();

  if (!isConfigValid) {
    if (configWarning) {
      configWarning.classList.remove("hidden");
    }
    setAuthState(false);
  } else {
    if (configWarning) {
      configWarning.classList.add("hidden");
    }

    Promise.all([import("firebase/auth"), import("firebase/functions")])
      .then(([firebaseAuth, firebaseFunctions]) => {
        const { getAuth, onAuthStateChanged, signOut } = firebaseAuth;
        const { getFunctions, httpsCallable } = firebaseFunctions;

        const app = getFirebaseApp();
        const auth = getAuth(app);
        const functions = getFunctions(app, "europe-west1");

        const callUpsertUserProfile = async (user) => {
          if (!user?.uid) return;
          await httpsCallable(functions, "upsertUserProfile")({
            displayName: user.displayName ?? "",
          });
        };

        if (logoutButton instanceof HTMLButtonElement) {
          logoutButton.addEventListener("click", async () => {
            await signOut(auth).catch((error) => {
              console.error("[publish/logout] failed", error);
            });
            window.location.assign("/#login");
          });
        }

        onAuthStateChanged(auth, (user) => {
          if (!user) {
            setAuthState(false);
            return;
          }

          const resolvedEmail = user.email || user.displayName || "";

          callUpsertUserProfile(user)
            .then(() => {
              setAuthState(
                true,
                resolvedEmail,
                user.photoURL || "",
                user.displayName || ""
              );
            })
            .catch((error) => {
              console.error("[publish/profile-sync] failed", error);
              setAuthState(false);
              if (lockedMessage) {
                lockedMessage.innerHTML =
                  'Tu sesión está activa, pero no se pudo validar tu perfil. Vuelve a intentar. <a href="/#login" class="underline font-semibold">Volver</a>';
              }
            });
        });
      })
      .catch((error) => {
        console.error("[publish/init] failed", error);
        setAuthState(false);
      });
  }
}
