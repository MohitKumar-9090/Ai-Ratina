import { Activity, ArrowRight, Eye, FileText, Layers, Plus, ScanLine, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboardStats, fetchDistribution, fetchRecentScreenings } from '../services/api'
import { isFirebaseConfigured } from '../firebase/firebase'
import { getFirestoreScreenings } from '../services/firestoreService'

export default function Dashboard() {
  const [stats, setStats] = useState({ total_patients: 0, total_screenings: 0, today_screenings: 0 })
  const [distribution, setDistribution] = useState({ "No DR": 0, "Mild DR": 0, "Moderate DR": 0, "Severe DR": 0, "Proliferative DR": 0 })
  const [recentScreenings, setRecentScreenings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        let recentData = []
        if (isFirebaseConfigured()) {
          const fbData = await getFirestoreScreenings()
          recentData = fbData.slice(0, 5)
        }

        const [statsData, distData, apiRecentData] = await Promise.all([
          fetchDashboardStats(),
          fetchDistribution(),
          fetchRecentScreenings(5),
        ])

        const finalRecent = recentData.length > 0 ? recentData : apiRecentData
        const totalScreenings = Math.max(statsData.total_screenings, finalRecent.length)
        const totalPatients = Math.max(statsData.total_patients, new Set(finalRecent.map(r => r.patient_name)).size)

        setStats({
          total_patients: totalPatients,
          total_screenings: totalScreenings,
          today_screenings: statsData.today_screenings || (finalRecent.length > 0 ? 1 : 0),
        })

        // Compute distribution if statsData distribution is 0
        if (Object.values(distData).every(v => v === 0) && finalRecent.length > 0) {
          const distCalc = { "No DR": 0, "Mild DR": 0, "Moderate DR": 0, "Severe DR": 0, "Proliferative DR": 0 }
          finalRecent.forEach(r => {
            if (distCalc[r.prediction] !== undefined) distCalc[r.prediction]++
          })
          setDistribution(distCalc)
        } else {
          setDistribution(distData)
        }

        setRecentScreenings(finalRecent)
      } catch (err) {
        console.error('Dashboard data load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const maxDistCount = Math.max(...Object.values(distribution), 1)

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="page-title">Screening Overview</h1>
        <p className="page-copy">Real-time diabetic retinopathy screening insights and patient activity.</p>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

        {/* A. Welcome Card (Spans 2 columns on lg) */}
        <div className="bento-card lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary-deep via-[#115C6F] to-primary text-white">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-surface-accent backdrop-blur-sm">
                  <Activity className="h-3.5 w-3.5" /> Explainable AI Screening
                </span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  AI-Assisted Retinal Screening
                </h2>
                <p className="mt-2 text-sm text-surface-accent/90 max-w-lg leading-relaxed">
                  Analyze retinal fundus images with real-time deep learning model inference and Grad-CAM region heatmaps.
                </p>
              </div>
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
                <Eye className="h-6 w-6 text-surface-accent" />
              </div>
            </div>

            <div>
              <Link to="/analyze" className="btn-teal inline-flex items-center gap-2">
                Start New Screening <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Subtle background graphic circle */}
          <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        </div>

        {/* B. Quick Scan Card (1 column) */}
        <div className="bento-card flex flex-col justify-between space-y-5 bg-surface-soft/60">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep text-white">
              <ScanLine className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">Start a Screening</h3>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              Upload a JPG or PNG retinal image to analyze immediately.
            </p>
          </div>

          <Link to="/analyze" className="btn-primary w-full text-center justify-center">
            <Plus className="h-4 w-4" /> Upload Retina Image
          </Link>
        </div>

        {/* C. Patient Statistics (3 Metric Bento Row) */}
        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Total Patients</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{loading ? '-' : stats.total_patients}</p>
          <span className="mt-1 text-[11px] text-ink-subtle">Registered patient records</span>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Total Screenings</span>
            <Layers className="h-4 w-4 text-primary-teal" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{loading ? '-' : stats.total_screenings}</p>
          <span className="mt-1 text-[11px] text-ink-subtle">Completed AI analyses</span>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Today's Screenings</span>
            <Activity className="h-4 w-4 text-status-success" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{loading ? '-' : stats.today_screenings}</p>
          <span className="mt-1 text-[11px] text-ink-subtle">Processed today</span>
        </div>

        {/* D. Recent Screenings (Spans 2 columns) */}
        <div className="bento-card lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-4">
              <div>
                <h3 className="text-base font-bold text-ink">Recent Screenings</h3>
                <p className="text-xs text-ink-muted">Latest patient screening activity</p>
              </div>
              <Link to="/history" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-ink-subtle">Loading recent screenings...</div>
            ) : recentScreenings.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-ink-muted">No screening records yet.</p>
                <p className="text-xs text-ink-subtle">Upload your first retina image on the Analyze page.</p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-surface-border/50">
                {recentScreenings.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-soft text-primary font-bold text-xs">
                        {item.patient_name ? item.patient_name.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.patient_name || 'Anonymous Patient'}</p>
                        <p className="text-[11px] text-ink-subtle">{item.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.class_id === 0
                            ? 'bg-emerald-50 text-status-success'
                            : item.class_id <= 2
                            ? 'bg-amber-50 text-status-warning'
                            : 'bg-rose-50 text-status-danger'
                        }`}
                      >
                        {item.prediction}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* E. AI Screening Overview (1 column) */}
        <div className="bento-card flex flex-col justify-between">
          <div>
            <div className="border-b border-surface-border/60 pb-3">
              <h3 className="text-base font-bold text-ink">AI Insights</h3>
              <p className="text-xs text-ink-muted">Screening stage distribution</p>
            </div>

            <div className="mt-4 space-y-3">
              {Object.entries(distribution).map(([stage, count]) => {
                const pct = Math.round((count / maxDistCount) * 100)
                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-ink">
                      <span>{stage}</span>
                      <span className="font-semibold text-ink-muted">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className="h-full rounded-full bg-primary-deep transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* F. Explainable AI Card */}
        <div className="bento-card lg:col-span-3 bg-surface-accent/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-primary-deep">Explainable AI (Grad-CAM)</h4>
              <p className="text-xs text-ink-muted max-w-2xl">
                Visualize retinal regions influencing the AI screening decision. Gradient-weighted Class Activation Mapping provides visual transparency for every analysis.
              </p>
            </div>
          </div>

          <Link to="/analyze" className="btn-secondary shrink-0 text-xs">
            Start Screening
          </Link>
        </div>

      </div>
    </div>
  )
}
