import { useNavigate } from 'react-router-dom'
import { SettingsSection, Icon } from '../ui'
import { useWallet } from '../../hooks'

interface WalletSectionProps {
  onClose: () => void
}

export default function WalletSection({ onClose }: WalletSectionProps) {
  const navigate = useNavigate()
  const { connected, walletName } = useWallet()

  const handleOpenInventory = () => {
    onClose()
    navigate('/inventory')
  }

  return (
    <SettingsSection title="Wallet">
      <div className="wallet-status">
        {connected ? (
          <span className="wallet-connected-status">
            <Icon name="Zap" size={16} fill="#f7931a" /> {walletName || 'Connected'}
          </span>
        ) : (
          <span className="wallet-not-connected-status">Not connected</span>
        )}
      </div>
      <button className="profile-edit-link" onClick={handleOpenInventory}>
        Inventory →
      </button>
    </SettingsSection>
  )
}
