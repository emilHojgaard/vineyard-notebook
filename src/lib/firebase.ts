import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  clearIndexedDbPersistence,
  terminate,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Auth emulator wiring must happen before persistence initializes the Auth
// instance. Other emulators are connected after their services are created.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}

// Keep the normal browser session persistent across reloads. Login waits for
// this configuration so an auth switch cannot race persistence initialization.
// Some privacy-restricted clients reject local persistence; authentication must
// still work in that case, using Firebase's in-memory fallback.
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
  console.warn('Firebase Auth local persistence is unavailable; using session-only auth', {
    code: getFirebaseErrorCode(error),
  });
});

function getFirebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

// User-entered optional fields can be absent; omit undefined values rather than
// failing an entire season write.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

/**
 * Clear a damaged or stale local Firestore cache. Termination is required by
 * the SDK before IndexedDB can be deleted; callers should reload immediately
 * afterwards so a fresh Firestore instance is created. This only affects the
 * local cache and never changes Firestore rules or server data.
 */
export async function resetFirestoreCache(): Promise<void> {
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

// Connect to emulators in development if needed
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
