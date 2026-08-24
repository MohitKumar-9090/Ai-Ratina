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

    // Do not block app/API startup on Firebase. Firestore operations can await this promise.
    authReady = signInAnonymously(auth)
      .then(() => {
        console.log('[Firebase] Anonymous authentication ready')
        return true
      })
      .catch((err) => {
        console.error('[Firebase] Anonymous authentication failed:', err)
        return false
      })

    console.log('[Firebase] Firestore initialized:', firebaseConfig.projectId)
  } catch (err) {
    console.error('[Firebase] Initialization error:', err)
    authReady = Promise.resolve(false)
  }
} else {
  console.info('[Firebase] Config not set. App will use backend API/SQLite.')
}

export { app, db, auth, authReady }
