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
  const firebaseApp = await import("firebase/app");
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
    import("firebase/auth"),
    getOrInitFirebaseApp(),
  ]);

  const { getAuth, onAuthStateChanged } = firebaseAuth;
  const auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    onUserState(user?.uid ?? null);
  });
};

const PAGE_SIZE = 20;

export type MyPostsPage = {
  posts: LoadedPost[];
  /** Cursor opaco (último doc de la página) para pedir la siguiente. */
  cursor: unknown;
  hasMore: boolean;
};

export const fetchMyPosts = async (
  uid: string,
  cursor: unknown = null
): Promise<MyPostsPage> => {
  const [firebaseFirestore, app] = await Promise.all([
    import("firebase/firestore"),
    getOrInitFirebaseApp(),
  ]);

  const { getFirestore, collection, query, where, orderBy, getDocs, limit, startAfter } =
    firebaseFirestore;
  const db = getFirestore(app);
  const postsRef = collection(db, "posts");
  const orderedQuery = query(
    postsRef,
    where("authorUid", "==", uid),
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(PAGE_SIZE)
  );

  try {
    const snapshot = await getDocs(orderedQuery);
    return {
      posts: mapSnapshotToPosts(snapshot),
      cursor: snapshot.docs[snapshot.docs.length - 1] ?? cursor,
      hasMore: snapshot.docs.length === PAGE_SIZE,
    };
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    // Sin índice compuesto no hay orden estable para cursores: se degrada
    // a la carga completa (comportamiento previo).
    console.warn(
      "[mis-publicaciones] missing index for authorUid + createdAt, using fallback query"
    );

    const fallbackQuery = query(postsRef, where("authorUid", "==", uid));
    const fallbackSnapshot = await getDocs(fallbackQuery);
    return {
      posts: mapSnapshotToPosts(fallbackSnapshot),
      cursor: null,
      hasMore: false,
    };
  }
};
