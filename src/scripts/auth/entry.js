if (typeof window !== "undefined") {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const messageContainer = document.getElementById("auth-message");
  const announcer = document.getElementById("auth-announcer");
  const configWarning = document.getElementById("auth-config-warning");
  const guestPanel = document.getElementById("auth-guest");
  const userPanel = document.getElementById("auth-user");
  const userEmail = document.getElementById("auth-user-email");

  const setMessage = (message, type = "error") => {
    // 1. Anunciador silencioso: siempre en el DOM, nunca display:none.
    //    Los lectores de pantalla lo leen porque estaba registrado al cargar la página.
    if (announcer) {
      announcer.textContent = "";
      // El pequeño timeout fuerza a los AT a percibir el cambio como una
      // mutación nueva, incluso si el mensaje anterior era idéntico.
      requestAnimationFrame(() => {
        announcer.textContent = message;
      });
    }

    // 2. Contenedor visual (solo para usuarios videntes)
    if (!messageContainer) return;
    messageContainer.textContent = message;
    messageContainer.classList.remove(
      "hidden",
      "border-red-200",
      "bg-red-50",
      "text-red-700",
      "border-green-200",
      "bg-green-50",
      "text-green-700"
    );

    if (type === "success") {
      messageContainer.classList.add(
        "border-green-200",
        "bg-green-50",
        "text-green-700"
      );
    } else {
      messageContainer.classList.add("border-red-200", "bg-red-50", "text-red-700");
    }
  };

  const clearMessage = () => {
    if (announcer) announcer.textContent = "";
    if (!messageContainer) return;
    messageContainer.textContent = "";
    messageContainer.classList.add("hidden");
  };

  // Mapeo de códigos Firebase a mensajes en español comprensibles por humanos.
  // Nunca exponer códigos técnicos como "auth/wrong-password" al usuario.
  const FIREBASE_ERROR_MESSAGES = {
    "auth/invalid-email":          "El formato del correo no es válido.",
    "auth/user-not-found":         "No existe una cuenta con ese correo.",
    "auth/wrong-password":         "La contraseña no es correcta.",
    "auth/invalid-credential":     "El correo o la contraseña no son correctos.",
    "auth/email-already-in-use":   "Ya existe una cuenta con ese correo.",
    "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests":      "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
    "auth/network-request-failed": "Error de conexión. Comprueba tu red e inténtalo de nuevo.",
    "auth/user-disabled":          "Esta cuenta ha sido deshabilitada.",
    "auth/operation-not-allowed":  "Este método de acceso no está habilitado.",
  };

  const formatError = (error) => {
    if (!error) return "Error desconocido.";
    const code = typeof error.code === "string" ? error.code : null;
    return FIREBASE_ERROR_MESSAGES[code] ?? "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
  };

  const readValue = (form, fieldName) => {
    if (!(form instanceof HTMLFormElement)) return "";
    const value = new FormData(form).get(fieldName);
    return String(value ?? "").trim();
  };

  // Marca un campo como inválido, escribe el error bajo él y mueve el foco.
  const setFieldError = (inputId, message) => {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}-error`);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
    if (errorEl) errorEl.textContent = message;
  };

  // Limpia todos los estados de error de los campos de ambos formularios.
  const clearFieldErrors = () => {
    const inputIds = [
      "login-email", "login-password",
      "register-name", "register-email", "register-password", "register-confirm-password",
    ];
    inputIds.forEach((id) => {
      const input = document.getElementById(id);
      const errorEl = document.getElementById(`${id}-error`);
      if (input) input.setAttribute("aria-invalid", "false");
      if (errorEl) errorEl.textContent = "";
    });
  };

  const blockSubmitsWithMessage = (message) => {
    [registerForm, loginForm].forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        setMessage(message);
      });
    });
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

    if (guestPanel) {
      guestPanel.classList.toggle("hidden", isAuthenticated);
    }

    if (userPanel) {
      userPanel.classList.toggle("hidden", !isAuthenticated);
    }

    if (userEmail) {
      userEmail.textContent = email || "usuario sin correo";
    }

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
    blockSubmitsWithMessage(
      "Falta configurar Firebase (`PUBLIC_FIREBASE_*`). Puedes escribir en los campos, pero no enviar todavía."
    );
  } else {
    if (configWarning) {
      configWarning.classList.add("hidden");
    }

    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js"),
    ])
      .then(([firebaseApp, firebaseAuth, firebaseFunctions]) => {
        const { initializeApp, getApp, getApps } = firebaseApp;
        const {
          getAuth,
          createUserWithEmailAndPassword,
          signInWithEmailAndPassword,
          signOut,
          onAuthStateChanged,
          updateProfile,
        } = firebaseAuth;
        const { getFunctions, httpsCallable } = firebaseFunctions;

        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const functions = getFunctions(app, "europe-west1");

        const callUpsertUserProfile = async (user) => {
          if (!user?.uid) return;
          await httpsCallable(functions, "upsertUserProfile")({
            displayName: user.displayName ?? "",
          });
        };

        if (registerForm instanceof HTMLFormElement) {
          registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessage();
            clearFieldErrors();

            const name = readValue(registerForm, "name");
            const email = readValue(registerForm, "email");
            const password = readValue(registerForm, "password");
            const confirmPassword = readValue(registerForm, "confirmPassword");

            if (!email) {
              setFieldError("register-email", "El correo es obligatorio.");
              return;
            }

            if (!password) {
              setFieldError("register-password", "La contraseña es obligatoria.");
              return;
            }

            if (password.length < 6) {
              setFieldError("register-password", "La contraseña debe tener al menos 6 caracteres.");
              return;
            }

            if (password !== confirmPassword) {
              setFieldError("register-confirm-password", "Las contraseñas no coinciden.");
              return;
            }

            try {
              const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );
              if (name) {
                await updateProfile(userCredential.user, { displayName: name });
              }

              try {
                await callUpsertUserProfile(userCredential.user);
              } catch (profileError) {
                console.error("[firebase/register-profile] failed", profileError);
                setMessage(
                  `La cuenta se creó en Authentication, pero no se pudo crear tu perfil. ${formatError(profileError)}.`
                );
                return;
              }

              registerForm.reset();
              clearFieldErrors();
              setMessage("Cuenta creada correctamente. Redirigiendo al editor...", "success");
              // 1500ms: tiempo suficiente para que los lectores de pantalla lean el mensaje
              window.setTimeout(() => {
                window.location.assign("/publicar");
              }, 1500);
            } catch (error) {
              console.error("[firebase/register] failed", error);
              const code = typeof error?.code === "string" ? error.code : "";
              if (code === "auth/email-already-in-use" || code === "auth/invalid-email") {
                setFieldError("register-email", formatError(error));
              } else if (code === "auth/weak-password") {
                setFieldError("register-password", formatError(error));
              } else {
                setMessage(formatError(error));
              }
            }
          });
        }

        if (loginForm instanceof HTMLFormElement) {
          loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessage();
            clearFieldErrors();

            const email = readValue(loginForm, "email");
            const password = readValue(loginForm, "password");

            if (!email) {
              setFieldError("login-email", "El correo es obligatorio.");
              return;
            }

            if (!password) {
              setFieldError("login-password", "La contraseña es obligatoria.");
              return;
            }

            try {
              const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
              );

              try {
                await callUpsertUserProfile(userCredential.user);
              } catch (profileError) {
                console.error("[firebase/login-profile] failed", profileError);
                setMessage(
                  `Iniciaste sesión, pero no se pudo sincronizar tu perfil. ${formatError(profileError)}.`
                );
                return;
              }

              loginForm.reset();
              clearFieldErrors();
              setMessage("Sesión iniciada. Redirigiendo al editor...", "success");
              // 1500ms: tiempo suficiente para que los lectores de pantalla lean el mensaje
              window.setTimeout(() => {
                window.location.assign("/publicar");
              }, 1500);
            } catch (error) {
              console.error("[firebase/login] failed", error);
              const code = typeof error?.code === "string" ? error.code : "";
              if (code === "auth/user-not-found" || code === "auth/invalid-email") {
                setFieldError("login-email", formatError(error));
              } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setFieldError("login-password", formatError(error));
              } else {
                setMessage(formatError(error));
              }
            }
          });
        }

        if (logoutButton instanceof HTMLButtonElement) {
          logoutButton.addEventListener("click", async () => {
            clearMessage();
            try {
              await signOut(auth);
              setMessage("Sesión cerrada.", "success");
            } catch (error) {
              console.error("[firebase/logout] failed", error);
              setMessage(`No se pudo cerrar sesión. ${formatError(error)}`);
            }
          });
        }

        onAuthStateChanged(auth, (user) => {
          if (!user) {
            setAuthState(false);
            return;
          }

          const resolvedEmail = user.email || user.displayName || "";
          setAuthState(
            true,
            resolvedEmail,
            user.photoURL || "",
            user.displayName || ""
          );

          callUpsertUserProfile(user).catch((error) => {
            console.error("[firebase/profile-upsert] failed", error);
          });
        });
      })
      .catch((error) => {
        console.error("[firebase/init] failed", error);
        setAuthState(false);
        blockSubmitsWithMessage(
          "No se pudo inicializar Firebase Auth. Revisa la configuración e intenta de nuevo."
        );
        setMessage(
          "No se pudo cargar Firebase Auth. Revisa la conexión y la configuración."
        );
      });
  }
}
