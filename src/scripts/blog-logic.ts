
export {};

declare global {
  interface Window {
    __BLOG_AUTH_STATE__?: {
      isAuthenticated?: boolean;
      email?: string | null;
    };
    __FIREBASE_CONFIG__?: {
      apiKey?: string;
      authDomain?: string;
      projectId?: string;
      storageBucket?: string;
      messagingSenderId?: string;
      appId?: string;
    };
  }
}

const isAuthenticatedUser = (): boolean =>
  typeof window !== "undefined" &&
  window.__BLOG_AUTH_STATE__?.isAuthenticated === true;

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;

const hasValidFirebaseConfig = (): boolean => {
  const config = window.__FIREBASE_CONFIG__ || {};
  return requiredConfigKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

const form = document.getElementById("blog-form") as HTMLFormElement | null;
const titleInput = document.getElementById(
  "blog-title"
) as HTMLInputElement | null;
const contentInput = document.getElementById(
  "blog-content"
) as HTMLTextAreaElement | null;
const imageInput = document.getElementById(
  "blog-image-input"
) as HTMLInputElement | null;
const preview = document.getElementById(
  "blog-image-preview"
) as HTMLImageElement | null;
const placeholder = document.getElementById(
  "blog-image-placeholder"
) as HTMLParagraphElement | null;
const publishButton = document.getElementById(
  "blog-publish-button"
) as HTMLButtonElement | null;
const goButton = document.getElementById(
  "blog-go-2026"
) as HTMLButtonElement | null;

type FirebaseClients = {
  auth: {
    currentUser: { uid: string; email: string | null; displayName?: string | null } | null;
  };
  storage: any;
  ref: (...args: any[]) => any;
  uploadBytes: (...args: any[]) => Promise<any>;
  getDownloadURL: (...args: any[]) => Promise<string>;
  functions: any;
  httpsCallable: (...args: any[]) => any;
};

const getFirebaseClients = async (): Promise<FirebaseClients> => {
  if (!hasValidFirebaseConfig()) {
    throw new Error("Falta configuración Firebase (`PUBLIC_FIREBASE_*`).");
  }

  const [firebaseApp, firebaseAuth, firebaseStorage, firebaseFunctions] =
    await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js"),
      // @ts-ignore — CDN module, tipos no disponibles en tsconfig
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js"),
    ]);

  const { getApp, getApps, initializeApp } = firebaseApp;
  const { getAuth } = firebaseAuth;
  const { getStorage, ref, uploadBytes, getDownloadURL } = firebaseStorage;
  const { getFunctions, httpsCallable } = firebaseFunctions;

  const config = window.__FIREBASE_CONFIG__ as Record<string, string>;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);

  return {
    auth: getAuth(app) as FirebaseClients["auth"],
    storage: getStorage(app),
    ref,
    uploadBytes,
    getDownloadURL,
    functions: getFunctions(app, "europe-west1"),
    httpsCallable,
  };
};

const sanitizeFileName = (name: string): string => {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return cleaned.length > 0 ? cleaned : "imagen";
};

const uploadImageToStorage = async (
  clients: FirebaseClients,
  uid: string,
  file: File
): Promise<string> => {
  const safeName = sanitizeFileName(file.name);
  const storagePath = `blog/posts/${uid}/${Date.now()}-${safeName}`;
  const fileRef = clients.ref(clients.storage, storagePath);
  const contentType =
    typeof file.type === "string" && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";

  await clients.uploadBytes(fileRef, file, {
    contentType,
  });

  return clients.getDownloadURL(fileRef);
};

const resetPreview = () => {
  if (!preview || !placeholder) return;
  preview.classList.add("hidden");
  placeholder.classList.remove("hidden");
  preview.removeAttribute("src");
};

const handleImageChange = (event: Event): void => {
  if (!preview || !placeholder) return;
  const imgPreview = preview;
  const imgPlaceholder = placeholder;

  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.[0];
  if (!file) {
    resetPreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imgPreview.src = typeof reader.result === "string" ? reader.result : "";
    imgPreview.classList.remove("hidden");
    imgPlaceholder.classList.add("hidden");
  };
  reader.readAsDataURL(file);
};

const setPublishingState = (isPublishing: boolean) => {
  if (!publishButton) return;
  publishButton.disabled = isPublishing;
  publishButton.textContent = isPublishing ? "Publicando..." : "Publicar";
};

const publishPost = async (): Promise<void> => {
  if (!isAuthenticatedUser()) {
    alert("Debes iniciar sesión para publicar en el blog.");
    return;
  }

  if (!hasValidFirebaseConfig()) {
    alert("Falta configurar Firebase (`PUBLIC_FIREBASE_*`).");
    return;
  }

  const title = titleInput?.value?.trim() ?? "";
  const content = contentInput?.value?.trim() ?? "";
  const file = imageInput?.files?.[0];

  if (file && file.type && !file.type.startsWith("image/")) {
    alert("El archivo seleccionado no es una imagen válida.");
    return;
  }

  if (!title && !content && !file) {
    alert("Añade un título, contenido o una imagen antes de publicar.");
    return;
  }

  setPublishingState(true);

  try {
    const clients = await getFirebaseClients();
    const user = clients.auth.currentUser;

    if (!user?.uid) {
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }

    let imageUrl = "";
    if (file) {
      imageUrl = await uploadImageToStorage(clients, user.uid, file);
    }

    const publishPost = clients.httpsCallable(clients.functions, "publishPost");
    await publishPost({ title, content, imageUrl, year: 2026 });

    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";
    if (imageInput) imageInput.value = "";
    resetPreview();

    window.location.href = "/archivo/2026";
  } catch (error) {
    console.error(error);
    alert("No se pudo publicar en Firebase. Revisa reglas/configuración e inténtalo de nuevo.");
  } finally {
    setPublishingState(false);
  }
};

if (form) {
  form.addEventListener("submit", (event) => event.preventDefault());
}

if (imageInput && preview && placeholder) {
  imageInput.addEventListener("change", handleImageChange);
}

if (publishButton) {
  publishButton.addEventListener("click", () => {
    publishPost();
  });
}

if (goButton) {
  goButton.addEventListener("click", () => {
    window.location.href = "/archivo/2026";
  });
}
