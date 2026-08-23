import { ShieldAlert } from 'lucide-react'

export default function Disclaimer({ compact = false }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-surface-border bg-surface-soft text-ink-muted ${
        compact ? 'p-3.5 text-xs' : 'p-4 text-sm leading-relaxed'
      }`}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" aria-hidden="true" />
      <p>
        AI-assisted screening only. This system provides automated screening insights to support clinical workflows, but does not replace professional ophthalmic evaluation.
      </p>
    </div>
  )
}
