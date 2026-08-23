import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// 1. Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Check if Firebase environment variables are configured.
 */
export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY'
  )
}

// 2. Initialize Firebase App, Firestore, and Storage
let app = null
let db = null
let storage = null

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    storage = getStorage(app)
    console.log('[Firebase] Initialized successfully with project:', firebaseConfig.projectId)
  } catch (err) {
    console.error('[Firebase] Initialization error:', err)
  }
} else {
  console.info('[Firebase] Config environment variables not set. App running in local API mode.')
}

export { app, db, storage }

/**
 * Helper: Convert a blob/data URL or remote image URL into a Blob object for Firebase Storage upload.
 */
async function fetchImageBlob(src) {
  if (!src) return null
  if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('http')) {
    const res = await fetch(src)
    return await res.blob()
  }
  return null
}

/**
 * Upsert Patient & Save Screening Record to Firebase (Firestore + Storage).
 *
 * @param {object} patientData - { fullName, age, gender, caseId, phone, notes }
 * @param {object} result - AI screening result object from backend
 * @param {File} originalFile - Raw File object uploaded by user
 * @returns {Promise<{ patientDocId: string, screeningDocId: string, imageUrl: string, gradcamUrl: string }>}
 */
export async function saveScreeningToFirebase({ patientData, result, originalFile }) {
  if (!isFirebaseConfigured() || !db || !storage) {
    throw new Error('Firebase is not configured in environment variables.')
  }

  const caseId = patientData.caseId || patientData.patientId || `CASE-${Date.now()}`
  const normalizedAge = patientData.age ? parseInt(patientData.age, 10) : null

  // ── Step A: Upsert Patient Document ──
  let patientDocId = caseId
  const patientRef = doc(db, 'patients', caseId)
  const patientSnap = await getDoc(patientRef)

  const patientPayload = {
    fullName: patientData.fullName || patientData.name || 'Anonymous Patient',
    age: normalizedAge,
    gender: patientData.gender || 'Unspecified',
    caseId: caseId,
    phone: patientData.phone || patientData.contact || null,
    notes: patientData.notes || null,
    updatedAt: serverTimestamp(),
  }

  if (patientSnap.exists()) {
    await setDoc(patientRef, patientPayload, { merge: true })
    console.log('[Firebase] Updated existing patient:', caseId)
  } else {
    patientPayload.createdAt = serverTimestamp()
    await setDoc(patientRef, patientPayload)
    console.log('[Firebase] Created new patient:', caseId)
  }

  // ── Step B: Generate Screening Document Ref for ID ──
  const screeningsCollectionRef = collection(db, 'screenings')
  const newScreeningRef = doc(screeningsCollectionRef)
  const screeningId = newScreeningRef.id

  // ── Step C: Upload Images to Firebase Storage ──
  let imageUrl = ''
  let gradcamUrl = ''

  // 1. Upload original retina image under: retina-images/{caseId}/{screeningId}/original
  if (originalFile) {
    const origRef = ref(storage, `retina-images/${caseId}/${screeningId}/original`)
    await uploadBytes(origRef, originalFile)
    imageUrl = await getDownloadURL(origRef)
    console.log('[Firebase Storage] Uploaded original retina image:', imageUrl)
  }

  // 2. Upload Grad-CAM image under: gradcam-images/{caseId}/{screeningId}/gradcam
  if (result?.overlayImage || result?.heatmapImage) {
    const gradcamSrc = result.overlayImage || result.heatmapImage
    const gradcamBlob = await fetchImageBlob(gradcamSrc)
    if (gradcamBlob) {
      const gradcamRef = ref(storage, `gradcam-images/${caseId}/${screeningId}/gradcam`)
      await uploadBytes(gradcamRef, gradcamBlob)
      gradcamUrl = await getDownloadURL(gradcamRef)
      console.log('[Firebase Storage] Uploaded Grad-CAM image:', gradcamUrl)
    }
  }

  // ── Step D: Save Screening Document to Firestore ──
  const screeningPayload = {
    patientId: patientDocId,
    caseId: caseId,
    prediction: result.prediction || result.severity || 'No DR',
    classId: result.class_id ?? 0,
    confidence: result.confidence ?? null,
    imageUrl: imageUrl || result.originalImage || '',
    gradcamUrl: gradcamUrl || result.overlayImage || '',
    createdAt: serverTimestamp(),
  }

  await setDoc(newScreeningRef, screeningPayload)
  console.log('[Firebase Firestore] Saved screening record:', screeningId)

  return {
    patientDocId,
    screeningDocId: screeningId,
    imageUrl,
    gradcamUrl,
  }
}

/**
 * Fetch all screenings from Firestore with patient details.
 */
export async function getFirebaseScreenings() {
  if (!isFirebaseConfigured() || !db) return []

  try {
    const q = query(collection(db, 'screenings'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)

    const list = []
    for (const d of snap.docs) {
      const data = d.data()
      // Fetch patient details if patientId is present
      let patientInfo = { fullName: 'Anonymous Patient', age: null, gender: '' }
      if (data.patientId) {
        const pSnap = await getDoc(doc(db, 'patients', data.patientId))
        if (pSnap.exists()) {
          patientInfo = pSnap.data()
        }
      }

      const dateStr = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

      list.push({
        id: d.id,
        patient_name: patientInfo.fullName || data.caseId || 'Anonymous Patient',
        patient_age: patientInfo.age,
        patient_gender: patientInfo.gender,
        patient_id: data.caseId || data.patientId,
        prediction: data.prediction,
        class_id: data.classId ?? 0,
        imageUrl: data.imageUrl,
        gradcamUrl: data.gradcamUrl,
        date: dateStr,
        status: data.classId === 0 ? 'Screened' : 'Review recommended',
      })
    }
    return list
  } catch (err) {
    console.error('[Firebase] Failed to fetch screenings:', err)
    return []
  }
}
