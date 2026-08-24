import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY')
}

let app = null
let db = null

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    console.log('[Firebase] Firestore initialized successfully with project:', firebaseConfig.projectId)
  } catch (err) {
    console.error('[Firebase] Initialization error:', err)
  }
} else {
  console.info('[Firebase] Config environment variables not set. App running in API mode.')
}

export { app, db }
