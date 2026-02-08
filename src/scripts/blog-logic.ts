
export {};

type BlogPost = {
  id: number;
  title: string;
  content: string;
  image: string;
  createdAt: string;
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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result : "");
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });



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

const publishPost = async (): Promise<void> => {
  const title = titleInput?.value?.trim() ?? "";
  const content = contentInput?.value?.trim() ?? "";
  const file = imageInput?.files?.[0];
  let imageDataUrl = "";

  if (file) {
    if (preview && !preview.classList.contains("hidden") && preview.src) {
      imageDataUrl = preview.src;
    } else {
      try {
        imageDataUrl = await readFileAsDataUrl(file);
      } catch (error) {
        console.error(error);
      }
    }
  }

  if (!title && !content && !imageDataUrl) {
    alert("Añade un título, contenido o una imagen antes de publicar.");
    return;
  }

  const now = new Date();
  const newPost = {
    id: now.getTime(),
    title,
    content,
    image: imageDataUrl,
    createdAt: now.toISOString(),
  };

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPost),
    });

    if (!response.ok) {
      throw new Error("Error al publicar el post");
    }

    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";
    if (imageInput) imageInput.value = "";
    resetPreview();

    window.location.href = "/archivo/2026";
  } catch (error) {
    console.error(error);
    alert("No se pudo guardar el post. Inténtalo de nuevo.");
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
