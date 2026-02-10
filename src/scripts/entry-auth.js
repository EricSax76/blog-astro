if (typeof window !== "undefined") {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const messageContainer = document.getElementById("auth-message");
  const configWarning = document.getElementById("auth-config-warning");
  const guestPanel = document.getElementById("auth-guest");
  const userPanel = document.getElementById("auth-user");
  const userEmail = document.getElementById("auth-user-email");

  const setMessage = (message, type = "error") => {
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
    if (!messageContainer) return;
    messageContainer.textContent = "";
    messageContainer.classList.add("hidden");
  };

  const formatError = (error) => {
    if (!error) return "Error desconocido.";
    const code = typeof error.code === "string" ? error.code : null;
    const message =
      typeof error.message === "string" ? error.message : String(error);
    return code ? `${code}: ${message}` : message;
  };

  const FIRESTORE_HELP =
    "Revisa Firestore (crear base de datos) y despliega reglas con `firebase deploy --only firestore`.";

  const readValue = (form, fieldName) => {
    if (!(form instanceof HTMLFormElement)) return "";
    const value = new FormData(form).get(fieldName);
    return String(value ?? "").trim();
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

  const setAuthState = (isAuthenticated, email = "") => {
    window.__BLOG_AUTH_STATE__ = {
      isAuthenticated,
      email: email || null,
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
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
    ])
      .then(([firebaseApp, firebaseAuth, firebaseFirestore]) => {
        const { initializeApp, getApp, getApps } = firebaseApp;
        const {
          getAuth,
          createUserWithEmailAndPassword,
          signInWithEmailAndPassword,
          signOut,
          onAuthStateChanged,
          updateProfile,
        } = firebaseAuth;
        const { getFirestore, doc, setDoc, serverTimestamp } = firebaseFirestore;

        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const upsertUserProfile = async (user, extraData = {}) => {
          if (!user?.uid) return;

          await setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              email: user.email ?? "",
              displayName: user.displayName ?? "",
              role: "autor",
              updatedAt: serverTimestamp(),
              ...extraData,
            },
            { merge: true }
          );
        };

        if (registerForm instanceof HTMLFormElement) {
          registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessage();

            const name = readValue(registerForm, "name");
            const email = readValue(registerForm, "email");
            const password = readValue(registerForm, "password");
            const confirmPassword = readValue(registerForm, "confirmPassword");

            if (!email || !password) {
              setMessage("Completa correo y contraseña para registrarte.");
              return;
            }

            if (password.length < 6) {
              setMessage("La contraseña debe tener al menos 6 caracteres.");
              return;
            }

            if (password !== confirmPassword) {
              setMessage("La confirmación de contraseña no coincide.");
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
                await upsertUserProfile(userCredential.user, {
                  createdAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp(),
                });
              } catch (profileError) {
                console.error("[firebase/register-profile] failed", profileError);
                setMessage(
                  `La cuenta se creó en Authentication, pero no se pudo crear tu perfil en Firestore. ${formatError(profileError)}. ${FIRESTORE_HELP}`
                );
                return;
              }

              registerForm.reset();
              setMessage("Cuenta creada correctamente. Redirigiendo al editor...", "success");
              window.setTimeout(() => {
                window.location.assign("/publicar");
              }, 300);
            } catch (error) {
              console.error("[firebase/register] failed", error);
              setMessage(`No se pudo completar el registro. ${formatError(error)}`);
            }
          });
        }

        if (loginForm instanceof HTMLFormElement) {
          loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessage();

            const email = readValue(loginForm, "email");
            const password = readValue(loginForm, "password");

            if (!email || !password) {
              setMessage("Completa correo y contraseña para iniciar sesión.");
              return;
            }

            try {
              const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
              );

              try {
                await upsertUserProfile(userCredential.user, {
                  lastLoginAt: serverTimestamp(),
                });
              } catch (profileError) {
                console.error("[firebase/login-profile] failed", profileError);
                setMessage(
                  `Iniciaste sesión, pero no se pudo sincronizar tu perfil en Firestore. ${formatError(profileError)}. ${FIRESTORE_HELP}`
                );
                return;
              }

              loginForm.reset();
              setMessage("Sesión iniciada. Redirigiendo al editor...", "success");
              window.setTimeout(() => {
                window.location.assign("/publicar");
              }, 300);
            } catch (error) {
              console.error("[firebase/login] failed", error);
              setMessage(`No fue posible iniciar sesión. ${formatError(error)}`);
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
          setAuthState(true, resolvedEmail);

          upsertUserProfile(user, { lastSeenAt: serverTimestamp() }).catch((error) => {
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
