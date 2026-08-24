const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim()

const API_URL = (
  import.meta.env.PROD
    ? ''
    : (configuredApiUrl || 'http://localhost:8001')
).replace(/\/$/, '')

const resolveImageUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`)
    if (!res.ok) return { status: 'offline', model_loaded: false, message: `Server returned status ${res.status}` }
    return await res.json()
  } catch (err) {
    console.warn('[API] Health check failed:', err)
    return { status: 'offline', model_loaded: false, message: 'AI server is offline.' }
  }
}

export async function analyzeImage(file, patientData = {}) {
  const analyzeUrl = `${API_URL}/api/analyze`
  const formData = new FormData()
  formData.append('file', file)
  if (patientData.name) formData.append('name', patientData.name)
  if (patientData.age) formData.append('age', patientData.age)
  if (patientData.gender) formData.append('gender', patientData.gender)
  if (patientData.patientId) formData.append('patient_id', patientData.patientId)
  if (patientData.contact) formData.append('contact', patientData.contact)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)
  let res
  try {
    res = await fetch(analyzeUrl, { method: 'POST', body: formData, signal: controller.signal })
  } catch (err) {
    console.error('[API] Error:', err)
    if (err.name === 'AbortError') throw new Error('Analysis is taking too long. Please try again.')
    throw new Error('Unable to connect to AI server.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    const message = errData.detail || errData.message || `Analysis request failed with HTTP ${res.status}`
    throw new Error(message)
  }

  const data = await res.json()
  const prediction = data.prediction || {}

  return {
    id: data.record_id,
    patient: data.patient,
    prediction: prediction.class_name,
    severity: prediction.class_name,
    class_id: prediction.class_id,
    confidence: prediction.confidence,
    originalImage: resolveImageUrl(data.image_url),
    overlayImage: resolveImageUrl(data.gradcam_url || data.explanation?.overlay_url),
    heatmapImage: resolveImageUrl(data.explanation?.heatmap_url),
    explanation: data.explanation?.message || 'Grad-CAM highlights image regions that influenced the model prediction.',
    logits: data.logits,
    probabilities: data.probabilities,
    date: data.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: prediction.class_id === 0 ? 'Screened' : 'Review recommended',
    image_url: data.image_url,
    gradcam_url: data.gradcam_url,
    assets_pending: data.assets_pending === true,
  }
}

export async function fetchDashboardStats() {
  try {
    const res = await fetch(`${API_URL}/api/stats`)
    if (!res.ok) throw new Error('Stats fetch failed')
    return await res.json()
  } catch (err) {
    console.warn('[API] Failed to fetch stats:', err)
    return { total_patients: 0, total_screenings: 0, today_screenings: 0 }
  }
}

export async function fetchDistribution() {
  try {
    const res = await fetch(`${API_URL}/api/stats/distribution`)
    if (!res.ok) throw new Error('Distribution fetch failed')
    return await res.json()
  } catch (err) {
    console.warn('[API] Failed to fetch distribution:', err)
    return { 'No DR': 0, 'Mild DR': 0, 'Moderate DR': 0, 'Severe DR': 0, 'Proliferative DR': 0 }
  }
}

export async function fetchRecentScreenings(limit = 5) {
  try {
    const res = await fetch(`${API_URL}/api/screenings/recent?limit=${limit}`)
    if (!res.ok) throw new Error('Recent screenings fetch failed')
    return await res.json()
  } catch (err) {
    console.warn('[API] Failed to fetch recent screenings:', err)
    return []
  }
}

export async function fetchAllScreenings() {
  try {
    const res = await fetch(`${API_URL}/api/screenings`)
    if (!res.ok) throw new Error('Screenings fetch failed')
    return await res.json()
  } catch (err) {
    console.warn('[API] Failed to fetch all screenings:', err)
    return []
  }
}
