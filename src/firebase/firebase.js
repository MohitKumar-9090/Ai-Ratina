import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY'
  )
}

let app = null
let db = null
let auth = null
let authReady = Promise.resolve(false)

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)

    // Firestore rules require an authenticated user. Anonymous Auth keeps
    // the app usable without adding a login screen.
    authReady = signInAnonymously(auth)
      .then(() => {
        console.log('[Firebase] Anonymous authentication ready')
        return true
      })
      .catch((err) => {
        console.error('[Firebase] Anonymous authentication failed:', err)
        return false
      })

    console.log('[Firebase] Firestore initialized successfully with project:', firebaseConfig.projectId)
  } catch (err) {
    console.error('[Firebase] Initialization error:', err)
    authReady = Promise.resolve(false)
  }
} else {
  console.info('[Firebase] Config environment variables not set. App running in API mode.')
}

export { app, db, auth, authReady }
