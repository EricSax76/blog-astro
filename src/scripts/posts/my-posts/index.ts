import { fetchMyPosts, hasValidFirebaseConfig, observeMyPostsAuth } from "./firebase";
import { createMyPostsUi } from "./ui";

const initMyPosts = async (): Promise<void> => {
  const ui = createMyPostsUi();
  if (!ui) return;

  if (!hasValidFirebaseConfig()) {
    ui.showConfigWarning();
    return;
  }

  let loadSequence = 0;

  const loadPostsForUser = async (uid: string): Promise<void> => {
    const currentSequence = ++loadSequence;
    ui.showLoading();

    try {
      const posts = await fetchMyPosts(uid);
      if (currentSequence !== loadSequence) return;

      if (posts.length === 0) {
        ui.showEmpty();
        return;
      }

      ui.showPosts(posts);
    } catch (error) {
      if (currentSequence !== loadSequence) return;
      console.error("[mis-publicaciones] failed to load posts", error);
      ui.showError("No se pudieron leer tus publicaciones desde Firestore.");
    }
  };

  try {
    await observeMyPostsAuth((uid) => {
      ui.clearCards();

      if (!uid) {
        ui.showAuthRequired();
        return;
      }

      void loadPostsForUser(uid);
    });
  } catch (error) {
    console.error("[mis-publicaciones] failed to initialize", error);
    ui.showError("No se pudo inicializar la sesión de tu panel de publicaciones.");
  }
};

void initMyPosts();
