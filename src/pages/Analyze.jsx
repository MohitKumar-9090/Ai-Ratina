import { AlertCircle, ArrowRight, LoaderCircle, ServerOff, User, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ImageUploader from '../components/ImageUploader'
import { analyzeImage, checkHealth } from '../services/api'
import { isFirebaseConfigured, saveScreeningToFirebase } from '../firebase/firebase'

export default function Analyze({ image, setImage, setLatestResult }) {
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState('')
  const [serverHealth, setServerHealth] = useState({ status: 'checking', model_loaded: true })
  const [patientData, setPatientData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    patientId: '',
    phone: '',
    notes: '',
  })

  const navigate = useNavigate()

  useEffect(() => {
    async function verifyBackend() {
      const health = await checkHealth()
      setServerHealth(health)
      if (health.status === 'offline') {
        setError('AI server is offline. Please start the backend on port 8001.')
      } else if (!health.model_loaded) {
        setError('AI model is not loaded. Place retinopathy_efficientnet_b0.pth inside backend/models/.')
      }
    }
    verifyBackend()
  }, [])

  const handleInputChange = (field, value) => {
    setPatientData((prev) => ({ ...prev, [field]: value }))
  }

  // Required fields validation: Name, Age, Gender, Patient/Case ID, and Image File
  const isFormValid = Boolean(
    patientData.name.trim() &&
      patientData.age &&
      patientData.gender &&
      patientData.patientId.trim() &&
      image?.file
  )

  const analyze = async () => {
    if (!isFormValid || loading) return
    setLoading(true)
    setError('')
    setStatusText('Analyzing retina...')

    let result = null

    // 1. Run real EfficientNet-B0 prediction via FastAPI
    try {
      result = await analyzeImage(image.file, {
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
        patientId: patientData.patientId,
        contact: patientData.phone,
      })
      result.originalImage = image.preview
    } catch (err) {
      console.error('[Analyze] AI Analysis Error:', err)
      setLoading(false)
      setError(err.message || 'Unable to analyze this image. Please try again.')
      return
    }

    // 2. Save to Firebase (Firestore + Storage) if configured
    if (isFirebaseConfigured()) {
      setStatusText('Saving screening to Firebase...')
      try {
        await saveScreeningToFirebase({
          patientData: {
            fullName: patientData.name,
            age: patientData.age,
            gender: patientData.gender,
            caseId: patientData.patientId,
            phone: patientData.phone,
            notes: patientData.notes,
          },
          result,
          originalFile: image.file,
        })
      } catch (fbErr) {
        console.error('[Analyze] Firebase Save Warning:', fbErr)
        // Per requirement 10: AI result succeeds, notify user about Firebase save failure without marking AI analysis failed
        setError('Analysis completed, but the record could not be saved to Firebase.')
      }
    }

    setLatestResult(result)
    setLoading(false)
    navigate('/result', { state: { result } })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Analyze Retina</h1>
        <p className="page-copy">Enter required patient information and upload a fundus image for AI screening.</p>
      </div>

      {/* Server Offline Warning Banner */}
      {serverHealth.status === 'offline' && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger flex items-center gap-3">
          <ServerOff className="h-5 w-5 shrink-0" />
          <div>
            <strong className="font-bold block text-sm">AI Server is Offline</strong>
            <span>Unable to reach backend at http://localhost:8001. Please run: <code className="font-mono bg-white/50 px-1 py-0.5 rounded">uvicorn main:app --port 8001</code> inside the backend folder.</span>
          </div>
        </div>
      )}

      {/* Bento Grid layout for Analyze */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* 1. Patient Information Card (Spans 1 column on lg) */}
        <div className="bento-card flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 border-b border-surface-border/60 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-soft text-primary-deep">
                <User className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-ink">Patient Details</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={patientData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Age *</label>
                  <input
                    type="number"
                    placeholder="e.g. 52"
                    min="1"
                    max="120"
                    value={patientData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Gender *</label>
                  <select
                    value={patientData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Patient / Case ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. RA-1001"
                    value={patientData.patientId}
                    onChange={(e) => handleInputChange('patientId', e.target.value)}
                    className="input-field text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    placeholder="Optional phone"
                    value={patientData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Clinical Notes</label>
                <textarea
                  rows="2"
                  placeholder="Optional medical notes..."
                  value={patientData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface-soft p-3 text-[11px] text-ink-subtle flex items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0 text-primary-teal" />
            Required fields (*): Full Name, Age, Gender, Case ID.
          </div>
        </div>

        {/* 2. Retina Image Upload Card (Spans 2 columns on lg) */}
        <div className="bento-card lg:col-span-2 flex flex-col justify-between space-y-4">
          <div>
            <div className="border-b border-surface-border/60 pb-3">
              <h3 className="text-base font-bold text-ink">Retina Image Upload</h3>
              <p className="text-xs text-ink-muted">High-resolution RGB retinal fundus scan</p>
            </div>

            <div className="mt-4">
              <ImageUploader image={image} onImageChange={setImage} />
            </div>
          </div>

          {/* Action bar */}
          <div className="border-t border-surface-border/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {error ? (
              <p className="flex items-center gap-2 text-xs font-semibold text-status-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : !isFormValid ? (
              <p className="text-xs text-ink-subtle italic">
                * Please fill in required patient fields (Name, Age, Gender, Case ID) and upload an image.
              </p>
            ) : null}

            <button
              disabled={!isFormValid || loading || serverHealth.status === 'offline'}
              onClick={analyze}
              className="btn-primary w-full sm:w-auto ml-auto"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {statusText || 'Processing...'}
                </>
              ) : (
                <>
                  Analyze Image <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
