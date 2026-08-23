import { Download, Printer, User } from 'lucide-react'
import Disclaimer from '../components/Disclaimer'
import GradCAMViewer from '../components/GradCAMViewer'

export default function Reports({ latestResult }) {
  const result = latestResult || {
    prediction: 'No DR',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    patient: { name: 'Sample Patient', age: 48, gender: 'Male', patient_id: 'P-20260823' },
    originalImage: '/retina-placeholder.svg',
    overlayImage: '/gradcam-placeholder.svg',
  }

  const handleDownload = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Screening Report</h1>
          <p className="page-copy">Formal AI-assisted diabetic retinopathy screening summary report.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleDownload} className="btn-secondary text-xs">
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button onClick={() => window.print()} className="btn-primary text-xs">
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Main Report Bento Card */}
      <div className="bento-card space-y-6">
        {/* Report Metadata Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-surface-border/60 pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">
              Patient Name
            </span>
            <p className="text-sm font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <User className="h-4 w-4 text-primary" />
              {result.patient?.name || 'Anonymous Patient'}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">
              Patient ID / Code
            </span>
            <p className="text-xs font-mono font-semibold text-ink mt-1">
              {result.patient?.patient_id || 'P-001'}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">
              Screening Date
            </span>
            <p className="text-xs font-semibold text-ink mt-1">
              {result.date}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle block">
              AI Classification Stage
            </span>
            <p className="text-base font-bold text-primary-deep mt-0.5">
              {result.prediction}
            </p>
          </div>
        </div>

        {/* Grad-CAM Visual Inspection Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-ink">Explainable AI Visual Summary</h3>
          <GradCAMViewer
            originalImage={result.originalImage}
            heatmapImage={result.heatmapImage}
            overlayImage={result.overlayImage}
          />
        </div>

        {/* Disclaimer footer */}
        <div className="border-t border-surface-border/60 pt-4">
          <Disclaimer compact />
        </div>
      </div>
    </div>
  )
}
