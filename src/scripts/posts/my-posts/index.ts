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
    ui.setLoadMore(false);

    try {
      const firstPage = await fetchMyPosts(uid);
      if (currentSequence !== loadSequence) return;

      if (firstPage.posts.length === 0) {
        ui.showEmpty();
        return;
      }

      ui.showPosts(firstPage.posts);

      let cursor = firstPage.cursor;

      const loadNextPage = async (): Promise<void> => {
        try {
          const page = await fetchMyPosts(uid, cursor);
          if (currentSequence !== loadSequence) return;

          cursor = page.cursor;
          ui.appendPosts(page.posts);
          ui.setLoadMore(page.hasMore, () => void loadNextPage());
        } catch (error) {
          if (currentSequence !== loadSequence) return;
          console.error("[mis-publicaciones] failed to load more posts", error);
        }
      };

      ui.setLoadMore(firstPage.hasMore, () => void loadNextPage());
    } catch (error) {
      if (currentSequence !== loadSequence) return;
      console.error("[mis-publicaciones] failed to load posts", error);
      ui.showError("No se pudieron leer tus publicaciones desde Firestore.");
    }
  };

  try {
    await observeMyPostsAuth((uid) => {
      ui.clearCards();
      ui.setLoadMore(false);

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
