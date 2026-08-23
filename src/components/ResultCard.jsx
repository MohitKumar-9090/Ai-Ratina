import { Activity, ShieldAlert } from 'lucide-react'

export default function ResultCard({ result }) {
  const isNormal = result?.prediction === 'No DR'

  return (
    <article className="bento-card relative overflow-hidden">
      <div className={`h-1.5 w-full absolute top-0 left-0 ${isNormal ? 'bg-status-success' : 'bg-status-warning'}`} />
      
      <div className="pt-2">
        <div className="flex items-center gap-2 text-primary-deep">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            AI Screening Result
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-bold text-ink">
          {result?.prediction || 'Screening Complete'}
        </h2>

        <p className="mt-1 text-xs text-ink-muted leading-relaxed">
          AI-assisted screening output. Clinical confirmation is recommended.
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-xl bg-surface-soft p-3 text-xs">
          <ShieldAlert className={`h-4 w-4 shrink-0 ${isNormal ? 'text-status-success' : 'text-status-warning'}`} />
          <span className="font-medium text-ink">
            Status: {result?.status || (isNormal ? 'Screened' : 'Review recommended')}
          </span>
        </div>
      </div>
    </article>
  )
}
