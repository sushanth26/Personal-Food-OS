import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, setUserId, type Analytics } from "firebase/analytics";
import {
  GoogleAuthProvider,
  getAuth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
let analyticsInstance: Analytics | null = null;
let analyticsReadyPromise: Promise<Analytics | null> | null = null;

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export function getAnalyticsInstance() {
  if (!app || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (analyticsReadyPromise) {
    return analyticsReadyPromise;
  }

  analyticsReadyPromise = isSupported()
    .then((supported) => {
      if (!supported) {
        return null;
      }

      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    })
    .catch(() => null);

  return analyticsReadyPromise;
}

export async function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) {
    return;
  }

  const filteredParams = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== null && value !== undefined)
  );

  logEvent(analytics, eventName, filteredParams);
}

export async function setAnalyticsUser(uid: string | null) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) {
    return;
  }

  setUserId(analytics, uid ?? null);
}
