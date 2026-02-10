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

  const setAuthState = (isAuthenticated, email = "") => {
    window.__BLOG_AUTH_STATE__ = {
      isAuthenticated,
      email: email || null,
    };
    try {
      localStorage.setItem("blog-auth-state", JSON.stringify(window.__BLOG_AUTH_STATE__));
    } catch {}

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

  const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  const isConfigValid = requiredKeys.every((key) => {
    const value = firebaseConfig[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (!isConfigValid) {
    if (configWarning) {
      configWarning.classList.remove("hidden");
    }
    setAuthState(false);
  } else {
    if (configWarning) {
      configWarning.classList.add("hidden");
    }

    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
    ])
      .then(([firebaseApp, firebaseAuth, firebaseFirestore]) => {
        const { initializeApp, getApp, getApps } = firebaseApp;
        const { getAuth, onAuthStateChanged, signOut } = firebaseAuth;
        const { getFirestore, doc, getDoc, setDoc, serverTimestamp } =
          firebaseFirestore;

        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const ensureUserProfile = async (user) => {
          const userRef = doc(db, "users", user.uid);
          const snapshot = await getDoc(userRef);

          const payload = {
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? "",
            role: "autor",
            updatedAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
          };

          if (!snapshot.exists()) {
            payload.createdAt = serverTimestamp();
            payload.lastLoginAt = serverTimestamp();
          }

          await setDoc(userRef, payload, { merge: true });
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

          ensureUserProfile(user)
            .then(() => {
              setAuthState(true, resolvedEmail);
            })
            .catch((error) => {
              console.error("[publish/profile-sync] failed", error);
              setAuthState(false);
              if (lockedMessage) {
                lockedMessage.innerHTML =
                  'Tu sesión está activa, pero no se pudo validar tu perfil en Firestore. Revisa reglas/DB y vuelve a intentar. <a href="/#login" class="underline font-semibold">Volver</a>';
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
