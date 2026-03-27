if (typeof window !== "undefined") {
  const form = document.getElementById("profile-form");
  const configWarning = document.getElementById("profile-config-warning");
  const message = document.getElementById("profile-message");
  const displayNameInput = document.getElementById("profile-display-name");
  const emailInput = document.getElementById("profile-email");
  const roleElement = document.getElementById("profile-role");
  const createdAtElement = document.getElementById("profile-created-at");
  const photoInput = document.getElementById("profile-photo");
  const avatarPreview = document.getElementById("profile-avatar-preview");
  const avatarFallback = document.getElementById("profile-avatar-fallback");
  const saveButton = document.getElementById("profile-save-button");

  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];

  const setMessage = (text, type = "error") => {
    if (!message) return;

    message.textContent = text;
    message.classList.remove(
      "hidden",
      "border-red-200",
      "bg-red-50",
      "text-red-700",
      "border-green-200",
      "bg-green-50",
      "text-green-700"
    );

    if (type === "success") {
      message.classList.add("border-green-200", "bg-green-50", "text-green-700");
    } else {
      message.classList.add("border-red-200", "bg-red-50", "text-red-700");
    }
  };

  const clearMessage = () => {
    if (!message) return;
    message.textContent = "";
    message.classList.add("hidden");
  };

  const setSaving = (isSaving) => {
    if (!(saveButton instanceof HTMLButtonElement)) return;
    saveButton.disabled = isSaving;
    saveButton.textContent = isSaving ? "Guardando..." : "Guardar cambios";
  };

  const formatDate = (value) => {
    if (!value) return "No disponible";
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "No disponible";
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getInitial = (nameOrEmail) => {
    const safeValue = String(nameOrEmail || "").trim();
    return safeValue ? safeValue.charAt(0).toUpperCase() : "U";
  };

  const setAvatar = (photoURL, fallbackValue) => {
    if (!(avatarPreview instanceof HTMLImageElement) || !(avatarFallback instanceof HTMLElement)) {
      return;
    }

    avatarFallback.textContent = getInitial(fallbackValue);

    if (typeof photoURL === "string" && photoURL.trim().length > 0) {
      avatarPreview.src = photoURL;
      avatarPreview.classList.remove("hidden");
      avatarFallback.classList.add("hidden");
      return;
    }

    avatarPreview.removeAttribute("src");
    avatarPreview.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
  };

  const syncHeaderAuthState = ({ email, photoURL, displayName }) => {
    const state = {
      isAuthenticated: true,
      email: email || null,
      photoURL: photoURL || null,
      displayName: displayName || null,
    };

    window.__BLOG_AUTH_STATE__ = state;
    try {
      localStorage.setItem("blog-auth-state", JSON.stringify(state));
    } catch {}

    window.dispatchEvent(new CustomEvent("blog-auth-changed", { detail: state }));
  };

  const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
  const hasValidConfig = requiredKeys.every((key) => {
    const value = firebaseConfig[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (!hasValidConfig) {
    configWarning?.classList.remove("hidden");
    if (form instanceof HTMLFormElement) {
      Array.from(form.elements).forEach((element) => {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLButtonElement
        ) {
          element.disabled = true;
        }
      });
    }
  } else {
    configWarning?.classList.add("hidden");

    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
    ])
      .then(
        ([firebaseApp, firebaseAuth, firebaseFunctions, firebaseStorage, firebaseFirestore]) => {
          const { getApp, getApps, initializeApp } = firebaseApp;
          const { getAuth, onAuthStateChanged, updateProfile } = firebaseAuth;
          const { getFunctions, httpsCallable } = firebaseFunctions;
          const { getStorage, ref, uploadBytes, getDownloadURL } = firebaseStorage;
          const { getFirestore, doc, getDoc } = firebaseFirestore;

          const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
          const auth = getAuth(app);
          const functions = getFunctions(app, "europe-west1");
          const storage = getStorage(app);
          const firestore = getFirestore(app);

          let currentUser = null;

          const loadProfileData = async (user) => {
            const profileDoc = await getDoc(doc(firestore, "users", user.uid));
            const profile = profileDoc.exists() ? profileDoc.data() : {};

            const displayName =
              (typeof profile.displayName === "string" && profile.displayName.trim()) ||
              user.displayName ||
              "";

            if (displayNameInput instanceof HTMLInputElement) {
              displayNameInput.value = displayName;
            }

            if (emailInput instanceof HTMLInputElement) {
              emailInput.value = user.email || "";
            }

            if (roleElement instanceof HTMLElement) {
              roleElement.textContent =
                typeof profile.role === "string" && profile.role.trim().length > 0
                  ? profile.role
                  : "autor";
            }

            if (createdAtElement instanceof HTMLElement) {
              createdAtElement.textContent = formatDate(profile.createdAt);
            }

            setAvatar(user.photoURL || "", displayName || user.email || "");
            syncHeaderAuthState({
              email: user.email || displayName || "",
              photoURL: user.photoURL || "",
              displayName,
            });
          };

          onAuthStateChanged(auth, async (user) => {
            clearMessage();

            if (!user) {
              setMessage("Debes iniciar sesión para acceder a tu perfil.");
              window.setTimeout(() => {
                window.location.assign("/acceder");
              }, 800);
              return;
            }

            currentUser = user;

            try {
              await loadProfileData(user);
            } catch (error) {
              console.error("[profile/load] failed", error);
              setMessage("No se pudo cargar tu perfil. Inténtalo de nuevo.");
            }
          });

          if (form instanceof HTMLFormElement) {
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              clearMessage();

              if (!currentUser) {
                setMessage("Tu sesión no está activa. Vuelve a iniciar sesión.");
                return;
              }

              const displayName =
                displayNameInput instanceof HTMLInputElement
                  ? displayNameInput.value.trim().slice(0, 50)
                  : "";

              const file =
                photoInput instanceof HTMLInputElement ? photoInput.files?.[0] || null : null;

              if (file && file.type && !file.type.startsWith("image/")) {
                setMessage("El archivo seleccionado no es una imagen válida.");
                return;
              }

              if (file && file.size > 5 * 1024 * 1024) {
                setMessage("La imagen supera el límite de 5MB.");
                return;
              }

              setSaving(true);

              try {
                let photoURL = currentUser.photoURL || "";

                if (file) {
                  const sanitizedName = file.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "avatar";
                  const avatarRef = ref(
                    storage,
                    `users/${currentUser.uid}/avatar/${Date.now()}-${sanitizedName}`
                  );

                  await uploadBytes(avatarRef, file, {
                    contentType: file.type || "image/jpeg",
                  });
                  photoURL = await getDownloadURL(avatarRef);
                }

                await updateProfile(currentUser, {
                  displayName: displayName || null,
                  photoURL: photoURL || null,
                });

                await httpsCallable(functions, "upsertUserProfile")({
                  displayName: displayName || "",
                });

                setAvatar(photoURL, displayName || currentUser.email || "");
                if (photoInput instanceof HTMLInputElement) {
                  photoInput.value = "";
                }

                syncHeaderAuthState({
                  email: currentUser.email || displayName || "",
                  photoURL,
                  displayName,
                });

                setMessage("Perfil actualizado correctamente.", "success");
              } catch (error) {
                console.error("[profile/save] failed", error);
                setMessage("No se pudieron guardar los cambios. Inténtalo de nuevo.");
              } finally {
                setSaving(false);
              }
            });
          }
        }
      )
      .catch((error) => {
        console.error("[profile/init] failed", error);
        setMessage("No se pudo inicializar el perfil. Revisa la conexión e inténtalo de nuevo.");
      });
  }
}
