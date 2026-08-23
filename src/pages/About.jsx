import { drClasses } from '../data/mockData'
import Disclaimer from '../components/Disclaimer'

export default function About() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">About RetinaAI</h1>
        <p className="page-copy">
          RetinaAI is an Explainable AI system for automated diabetic retinopathy screening using deep convolutional neural networks.
        </p>
      </div>

      <div className="bento-card space-y-5">
        <h2 className="text-base font-bold text-ink border-b border-surface-border/60 pb-3">
          Diabetic Retinopathy Classification Scale (APTOS 2019 Standard)
        </h2>

        <div className="divide-y divide-surface-border/50">
          {drClasses.map(([number, title, desc]) => (
            <div key={number} className="py-3 flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-soft font-bold text-primary-deep text-xs">
                {number}
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">{title}</h3>
                <p className="text-xs text-ink-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}
