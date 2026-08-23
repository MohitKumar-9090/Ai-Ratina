import { Activity, FileText, History, House, ScanLine } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export const navigation = [
  ['/', 'Dashboard', House],
  ['/analyze', 'Analyze', ScanLine],
  ['/history', 'History', History],
  ['/reports', 'Reports', FileText],
]

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-surface-border bg-surface-card p-5 lg:block">
      {/* Brand logo */}
      <NavLink to="/" className="flex items-center gap-3 px-2 py-2 transition hover:opacity-90">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-deep text-white shadow-sm">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <strong className="block text-xl tracking-tight text-primary-deep">
            Retina<span className="text-primary">AI</span>
          </strong>
          <small className="block text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Screening System
          </small>
        </div>
      </NavLink>

      {/* Navigation list */}
      <nav aria-label="Main navigation" className="mt-8 space-y-1.5">
        {navigation.map(([path, label, Icon]) => (
          <NavLink
            end={path === '/'}
            key={path}
            to={path}
            className={({ isActive }) =>
              `relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-surface-accent/70 text-primary-deep before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-primary-deep'
                  : 'text-ink-muted hover:bg-surface-soft hover:text-primary-deep'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
