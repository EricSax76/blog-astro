import { getFirestore, doc, getDoc } from "firebase/firestore";
import { type User } from "firebase/auth";
import { getFirebaseApp } from "./init";

type AccountContext = {
  kind: "terapeuta" | "autor" | "usuario";
};

export const getMyAccountContext = async (user: User): Promise<AccountContext> => {
  const db = getFirestore(getFirebaseApp());
  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists()) {
    return { kind: "usuario" };
  }

  const data = userDoc.data();
  if (data.role === "terapeuta") {
    return { kind: "terapeuta" };
  }

  return { kind: "autor" };
};

export const getMyUserProfile = async (user: User) => {
  const db = getFirestore(getFirebaseApp());
  const userDoc = await getDoc(doc(db, "users", user.uid));
  return userDoc.exists() ? userDoc.data() : null;
};
