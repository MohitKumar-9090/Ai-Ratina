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
import { db, isFirebaseConfigured, authReady } from '../firebase/firebase'

export async function saveScreeningToFirestore({ patientData, result, imageUrl, gradcamUrl }) {
  if (!isFirebaseConfigured() || !db) return null

  const authenticated = await authReady
  if (!authenticated) {
    console.warn('[Firestore] Authentication unavailable; skipping Firestore save.')
    return null
  }

  const caseId = patientData.caseId || patientData.patientId || `RA-${Date.now()}`
  const normalizedAge = patientData.age ? parseInt(patientData.age, 10) : null
  const patientRef = doc(db, 'patients', caseId)
  const patientSnap = await getDoc(patientRef)

  const patientPayload = {
    fullName: patientData.fullName || patientData.name || 'Anonymous Patient',
    age: normalizedAge,
    gender: patientData.gender || 'Unspecified',
    caseId,
    phone: patientData.phone || patientData.contact || null,
    notes: patientData.notes || null,
    updatedAt: serverTimestamp(),
  }

  if (!patientSnap.exists()) patientPayload.createdAt = serverTimestamp()
  await setDoc(patientRef, patientPayload, { merge: true })

  const screeningRef = doc(collection(db, 'screenings'))
  await setDoc(screeningRef, {
    patientId: caseId,
    caseId,
    prediction: result.prediction || result.severity || 'No DR',
    classId: result.class_id ?? 0,
    confidence: result.confidence ?? null,
    probabilities: result.probabilities || null,
    imageUrl: imageUrl || result.image_url || result.originalImage || null,
    gradcamUrl: gradcamUrl || result.gradcam_url || result.overlayImage || null,
    aiExplanation: result.explanation || 'Grad-CAM highlights image regions that influenced the model prediction.',
    createdAt: serverTimestamp(),
  })

  console.log('[Firestore] Saved screening:', screeningRef.id)
  return { patientDocId: caseId, screeningDocId: screeningRef.id }
}

export async function getFirestoreScreenings() {
  if (!isFirebaseConfigured() || !db) return []

  try {
    const authenticated = await authReady
    if (!authenticated) return []

    const q = query(collection(db, 'screenings'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    const list = []

    for (const d of snap.docs) {
      const data = d.data()
      let patientInfo = { fullName: 'Anonymous Patient', age: null, gender: '' }

      if (data.patientId) {
        const pSnap = await getDoc(doc(db, 'patients', data.patientId))
        if (pSnap.exists()) patientInfo = pSnap.data()
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
        confidence: data.confidence,
        probabilities: data.probabilities,
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
