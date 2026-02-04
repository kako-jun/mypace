import { usePWAInstall } from '../../hooks/ui'
import { Icon } from '../ui/Icon'

export function InstallPrompt() {
  const { canInstall, promptInstall, dismiss } = usePWAInstall()

  if (!canInstall) return null

  const handleInstall = async () => {
    const outcome = await promptInstall()
    if (outcome === 'dismissed') {
      dismiss()
    }
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-icon">
          <Icon name="Download" size={24} />
        </div>
        <div className="install-prompt-text">
          <p className="install-prompt-title">MY PACE</p>
          <p className="install-prompt-description">Add to home screen for app-like experience</p>
        </div>
      </div>
      <div className="install-prompt-actions">
        <button type="button" className="install-prompt-dismiss" onClick={dismiss}>
          Later
        </button>
        <button type="button" className="install-prompt-install" onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  )
}
