import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./init";
import { getMyAccountContext } from "./profiles";

const REGION = "europe-west1";

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  locale?: string;
};

export const registerUser = async (payload: RegisterPayload): Promise<void> => {
  const functions = getFunctions(getFirebaseApp(), REGION);
  await httpsCallable(functions, "registerUser")(payload);
};

export const loginAndResolveContext = async (email: string, password: string) => {
  const auth = getAuth(getFirebaseApp());
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const context = await getMyAccountContext(credential.user);
  return { user: credential.user, context };
};

export const logout = async (): Promise<void> => {
  await firebaseSignOut(getAuth(getFirebaseApp()));
};

export const observeAuth = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(getAuth(getFirebaseApp()), callback);
};
