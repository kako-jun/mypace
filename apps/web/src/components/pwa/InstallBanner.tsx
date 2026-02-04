import { usePWAInstall } from '../../hooks/ui/usePWAInstall'

export function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = usePWAInstall()

  if (!canInstall) return null

  const handleInstall = async () => {
    const outcome = await promptInstall()
    if (outcome === 'dismissed') {
      dismiss()
    }
  }

  return (
    <div className="install-banner">
      <div className="install-banner-content">
        <img
          src="/static/pwa-icon-192.webp"
          alt="MY PACE"
          width={24}
          height={24}
          className="install-banner-icon"
        />
        <span className="install-banner-message">
          Add MY PACE to your home screen for the best experience
        </span>
        <div className="install-banner-actions">
          <button type="button" className="install-banner-btn install" onClick={handleInstall}>
            Install
          </button>
          <button type="button" className="install-banner-btn dismiss" onClick={dismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
