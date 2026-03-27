import { isMissingIndexError, mapSnapshotToPosts } from "./mappers";
import type { LoadedPost } from "./types";

declare global {
  interface Window {
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

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;

const getFirebaseConfig = (): Record<string, string> => {
  return (window.__FIREBASE_CONFIG__ as Record<string, string>) || {};
};

const getOrInitFirebaseApp = async () => {
  const firebaseApp = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
  const { initializeApp, getApp, getApps } = firebaseApp;
  const config = getFirebaseConfig();
  return getApps().length > 0 ? getApp() : initializeApp(config);
};

export const hasValidFirebaseConfig = (): boolean => {
  const config = getFirebaseConfig();
  return requiredConfigKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

export const observeMyPostsAuth = async (
  onUserState: (uid: string | null) => void
): Promise<void> => {
  const [firebaseAuth, app] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
    getOrInitFirebaseApp(),
  ]);

  const { getAuth, onAuthStateChanged } = firebaseAuth;
  const auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    onUserState(user?.uid ?? null);
  });
};

export const fetchMyPosts = async (uid: string): Promise<LoadedPost[]> => {
  const [firebaseFirestore, app] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
    getOrInitFirebaseApp(),
  ]);

  const { getFirestore, collection, query, where, orderBy, getDocs } =
    firebaseFirestore;
  const db = getFirestore(app);
  const postsRef = collection(db, "posts");
  const orderedQuery = query(
    postsRef,
    where("authorUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  try {
    const snapshot = await getDocs(orderedQuery);
    return mapSnapshotToPosts(snapshot);
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    console.warn(
      "[mis-publicaciones] missing index for authorUid + createdAt, using fallback query"
    );

    const fallbackQuery = query(postsRef, where("authorUid", "==", uid));
    const fallbackSnapshot = await getDocs(fallbackQuery);
    return mapSnapshotToPosts(fallbackSnapshot);
  }
};
