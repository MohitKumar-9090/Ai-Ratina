import { ArrowRight, History as HistoryIcon, Search, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllScreenings } from '../services/api'
import { isFirebaseConfigured } from '../firebase/firebase'
import { getFirestoreScreenings } from '../services/firestoreService'

export default function History() {
  const [records, setRecords] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadHistory() {
      try {
        let data = []
        if (isFirebaseConfigured()) {
          data = await getFirestoreScreenings()
        }
        if (!data || data.length === 0) {
          data = await fetchAllScreenings()
        }
        setRecords(data)
      } catch (err) {
        console.error('Failed to load history:', err)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const filtered = records.filter(
    (item) =>
      item.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.prediction?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.patient_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleViewDetail = (item) => {
    const resultObj = {
      prediction: item.prediction,
      severity: item.prediction,
      originalImage: item.imageUrl || item.originalImage || '/retina-placeholder.svg',
      overlayImage: item.gradcamUrl || item.overlay_url || '/gradcam-placeholder.svg',
      heatmapImage: item.heatmap_url,
      date: item.date,
      status: item.status,
      patient: {
        name: item.patient_name,
        age: item.patient_age,
        gender: item.patient_gender,
        patient_id: item.patient_id,
        contact: item.patient_contact,
      },
    }
    navigate('/result', { state: { result: resultObj } })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Screening History</h1>
          <p className="page-copy">Persisted patient screening records and AI analysis logs.</p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-subtle" />
          <input
            type="text"
            placeholder="Search name, Case ID, DR stage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bento-card py-12 text-center text-xs text-ink-subtle">
          Loading screening history...
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="bento-card py-12 text-center space-y-3 max-w-md mx-auto my-8">
          <HistoryIcon className="h-10 w-10 text-ink-subtle mx-auto" />
          <h3 className="text-base font-bold text-ink">No Screenings Found</h3>
          <p className="text-xs text-ink-muted">
            {searchQuery ? 'No records match your search query.' : 'No patient screening records have been saved yet.'}
          </p>
        </div>
      ) : (
        /* Bento Card Grid */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const isNormal = item.prediction === 'No DR'
            const thumbnail = item.imageUrl || item.overlay_url
            return (
              <div
                key={item.id}
                className="bento-card flex flex-col justify-between space-y-4 hover:border-primary/40 transition"
              >
                <div>
                  {/* Patient Info */}
                  <div className="flex items-start justify-between gap-3 border-b border-surface-border/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt="Retina thumbnail"
                          className="h-10 w-10 rounded-xl object-cover border border-surface-border bg-slate-900 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft text-primary-deep font-bold text-xs shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-ink">{item.patient_name || 'Anonymous Patient'}</h4>
                        <p className="text-[11px] text-ink-subtle">
                          {item.patient_age ? `${item.patient_age} yrs` : ''}{' '}
                          {item.patient_gender ? `• ${item.patient_gender}` : ''}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-ink-subtle bg-surface-soft px-2 py-0.5 rounded-md shrink-0">
                      {item.patient_id || `#${item.id}`}
                    </span>
                  </div>

                  {/* Prediction result */}
                  <div className="mt-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      Screening Class
                    </span>
                    <p
                      className={`text-lg font-bold ${
                        isNormal
                          ? 'text-status-success'
                          : item.class_id <= 2
                          ? 'text-status-warning'
                          : 'text-status-danger'
                      }`}
                    >
                      {item.prediction}
                    </p>
                    <p className="text-[11px] text-ink-subtle">Date: {item.date}</p>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="border-t border-surface-border/60 pt-3">
                  <button
                    onClick={() => handleViewDetail(item)}
                    className="w-full inline-flex items-center justify-between text-xs font-semibold text-primary hover:text-primary-deep transition"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
