import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "billbuddy-return",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "billbuddy-return.firebasestorage.app",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const storage = getStorage(app);

export function getStorageRef(path: string) {
  return ref(storage, path);
}

export default app;
