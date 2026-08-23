import { navigation } from './Sidebar'
import { NavLink } from 'react-router-dom'

export default function MobileNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-surface-border bg-surface-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden shadow-lg"
    >
      {navigation.map(([path, label, Icon]) => (
        <NavLink
          end={path === '/'}
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? 'text-primary-deep' : 'text-ink-subtle hover:text-ink'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
