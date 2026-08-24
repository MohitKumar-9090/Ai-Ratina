import { Activity, ArrowLeft, CheckCircle2, AlertTriangle, FileText, User, LoaderCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Disclaimer from '../components/Disclaimer'
import GradCAMViewer from '../components/GradCAMViewer'
import { fetchAllScreenings } from '../services/api'

export default function Result({ latestResult, setLatestResult }) {
  const location = useLocation()
  const locationResult = location.state?.result
  const result = latestResult || locationResult
  const [camPending, setCamPending] = useState(Boolean(result?.id && !result?.overlayImage))

  useEffect(() => {
    if (!result?.id || result?.overlayImage) {
      setCamPending(false)
      return undefined
    }

    let cancelled = false
    let timer = null
    const startedAt = Date.now()
    const MAX_WAIT = 60000

    const poll = async () => {
      try {
        const records = await fetchAllScreenings()
        if (cancelled) return

        const record = records.find((item) => String(item.id) === String(result.id))
        const overlay = record?.overlay_url || ''
        const heatmap = record?.heatmap_url || ''

        if (overlay || heatmap) {
          setLatestResult?.((previous) => ({
            ...(previous || result),
            overlayImage: overlay || previous?.overlayImage || '',
            heatmapImage: heatmap || previous?.heatmapImage || '',
            gradcam_url: overlay || previous?.gradcam_url || '',
            explanation: record?.explanation || previous?.explanation,
          }))
          setCamPending(false)
          return
        }

        if (Date.now() - startedAt < MAX_WAIT) {
          timer = window.setTimeout(poll, 2500)
        } else {
          setCamPending(false)
        }
      } catch (error) {
        console.warn('[Result] Grad-CAM polling warning:', error)
        if (!cancelled && Date.now() - startedAt < MAX_WAIT) {
          timer = window.setTimeout(poll, 3000)
        } else if (!cancelled) {
          setCamPending(false)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [result?.id, result?.overlayImage, setLatestResult])

  if (!result) {
    return (
      <div className="bento-card py-12 text-center space-y-4 max-w-lg mx-auto my-12">
        <Activity className="h-10 w-10 text-ink-subtle mx-auto" />
        <h2 className="text-xl font-bold text-ink">No Recent Screening</h2>
        <p className="text-xs text-ink-muted">Upload a retinal image on the Analyze page to view screening results.</p>
        <Link to="/analyze" className="btn-primary inline-flex">
          Go to Analyze Page
        </Link>
      </div>
    )
  }

  const isNormal = result.prediction === 'No DR'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Screening Result</h1>
          <p className="page-copy">AI-assisted diabetic retinopathy analysis output.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/analyze" className="btn-secondary text-xs">
            <ArrowLeft className="h-4 w-4" /> New Screening
          </Link>
          <Link to="/reports" className="btn-primary text-xs">
            <FileText className="h-4 w-4" /> View Full Report
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bento-card lg:col-span-2 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                AI Screening Classification
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {result.prediction}
              </h2>
              <p className="mt-2 text-xs text-ink-muted max-w-md">
                AI-assisted screening result. Clinical confirmation is recommended.
              </p>
            </div>

            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isNormal ? 'bg-emerald-50 text-status-success' : 'bg-amber-50 text-status-warning'
              }`}
            >
              {isNormal ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-surface-border/60 pt-4">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isNormal
                  ? 'bg-emerald-50 text-status-success border border-emerald-200'
                  : 'bg-amber-50 text-status-warning border border-amber-200'
              }`}
            >
              Status: {result.status || (isNormal ? 'Screened' : 'Review recommended')}
            </span>

            <span className="text-xs text-ink-subtle">Screening Date: {result.date}</span>
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b border-surface-border/60 pb-3">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-ink">Patient Details</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">Patient Name</span>
                <p className="text-sm font-bold text-ink">{result.patient?.name || 'Anonymous Patient'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">Age</span>
                  <p className="font-semibold text-ink">{result.patient?.age || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">Gender</span>
                  <p className="font-semibold text-ink">{result.patient?.gender || 'N/A'}</p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">Patient Code</span>
                <p className="text-xs font-mono font-medium text-ink-muted">{result.patient?.patient_id || 'P-001'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bento-card lg:col-span-3 space-y-5">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-4">
            <div>
              <h3 className="text-base font-bold text-ink">Explainable AI Visual Inspection</h3>
              <p className="text-xs text-ink-muted">
                Highlighted regions indicate areas that influenced the model's prediction.
              </p>
            </div>
            {camPending && (
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1.5 text-[11px] font-semibold text-ink-muted">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Generating Grad-CAM…
              </span>
            )}
          </div>

          <GradCAMViewer
            originalImage={result.originalImage}
            heatmapImage={result.heatmapImage}
            overlayImage={result.overlayImage}
          />

          <p className="text-xs text-ink-subtle border-t border-surface-border/60 pt-3">
            Grad-CAM (Gradient-weighted Class Activation Mapping) highlights features in the retinal fundus image that contributed most to the AI model's output. It is an explainability tool and does not replace confirmed ophthalmic diagnosis.
          </p>
        </div>

        <div className="lg:col-span-3">
          <Disclaimer />
        </div>
      </div>
    </div>
  )
}
