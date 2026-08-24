import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/firebase'

/**
 * Save or update Patient document and create a Screening record in Firestore.
 *
 * @param {object} params
 * @param {object} params.patientData - { fullName, age, gender, caseId, phone, notes }
 * @param {object} params.result - Backend AI prediction result
 * @param {string} [params.imageUrl] - Cloudinary retina image URL
 * @param {string} [params.gradcamUrl] - Cloudinary Grad-CAM image URL
 * @returns {Promise<{ patientDocId: string, screeningDocId: string }>}
 */
export async function saveScreeningToFirestore({ patientData, result, imageUrl, gradcamUrl }) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase Firestore is not configured in environment variables.')
  }

  const caseId = patientData.caseId || patientData.patientId || `RA-${Date.now()}`
  console.log('[Firestore] Save started for caseId:', caseId)
  const normalizedAge = patientData.age ? parseInt(patientData.age, 10) : null

  // 1. Patient Document Upsert: patients/{caseId}
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
    console.log('[Firestore] Updated patient:', caseId)
  } else {
    patientPayload.createdAt = serverTimestamp()
    await setDoc(patientRef, patientPayload)
    console.log('[Firestore] Created new patient:', caseId)
  }

  // 2. Screening Document Creation: screenings/{screeningId}
  const screeningsColRef = collection(db, 'screenings')
  const newScreeningRef = doc(screeningsColRef)
  const screeningId = newScreeningRef.id

  const finalImageUrl = imageUrl || result.image_url || result.originalImage || null
  const finalGradcamUrl = gradcamUrl || result.gradcam_url || result.overlayImage || null

  const screeningPayload = {
    patientId: caseId,
    caseId: caseId,
    prediction: result.prediction || result.severity || 'No DR',
    classId: result.prediction?.class_id ?? result.class_id ?? 0,
    imageUrl: finalImageUrl,
    gradcamUrl: finalGradcamUrl,
    aiExplanation: result.explanation || 'Grad-CAM highlights image regions that influenced the model prediction.',
    createdAt: serverTimestamp(),
  }

  await setDoc(newScreeningRef, screeningPayload)
  console.log('[Firestore] Save completed for screening record:', screeningId)

  return {
    patientDocId: caseId,
    screeningDocId: screeningId,
  }
}

/**
 * Fetch all screenings from Firestore joined with patient metadata.
 * @returns {Promise<Array>}
 */
export async function getFirestoreScreenings() {
  if (!isFirebaseConfigured() || !db) return []

  try {
    const q = query(collection(db, 'screenings'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)

    const list = []
    for (const d of snap.docs) {
      const data = d.data()
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
    console.error('[Firestore] Fetch error:', err)
    return []
  }
}
