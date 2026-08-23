import { Activity, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function Navbar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone ||
      document.referrer.includes('android-app://')

    if (isStandalone) {
      setIsInstalled(true)
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-surface-border bg-surface-card/90 backdrop-blur-md px-4 sm:px-6 lg:ml-64 lg:px-8">
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

      {/* PWA Compact Install Icon Button (Appears only when beforeinstallprompt is active) */}
      {deferredPrompt && !isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Install RetinaAI"
          aria-label="Install RetinaAI"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-primary-deep transition-all duration-150 hover:bg-surface-accent/80 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
        >
          <Download className="h-5 w-5" />
        </button>
      )}
    </header>
  )
}
