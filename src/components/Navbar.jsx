import { Activity } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-surface-border bg-surface-card/90 backdrop-blur-md px-4 sm:px-6 lg:ml-64 lg:px-8">
      <NavLink to="/" className="flex items-center gap-2.5 lg:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-deep text-white">
          <Activity className="h-4 w-4" />
        </span>
        <strong className="text-lg font-bold text-primary-deep">
          Retina<span className="text-primary">AI</span>
        </strong>
      </NavLink>
      <p className="hidden text-sm font-medium text-ink-muted lg:block">
        Explainable AI-Assisted Diabetic Retinopathy Screening System
      </p>
    </header>
  )
}
