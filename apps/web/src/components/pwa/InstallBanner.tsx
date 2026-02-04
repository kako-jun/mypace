import { usePWAInstall } from '../../hooks/ui/usePWAInstall'
import { Icon } from '../ui'

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
        <Icon name="Download" size={20} />
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
