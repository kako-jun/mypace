import { SettingsSection, Button, Icon } from '../ui'
import { useWallet } from '../../hooks'
import { formatNumber } from '../../lib/utils'

export default function WalletSection() {
  const { connected, balance, walletName, loading, error, hasWebLN, connect, disconnect, refreshBalance } = useWallet()

  // WebLN not available
  if (!hasWebLN) {
    return (
      <SettingsSection title="Wallet">
        <p className="settings-note">
          WebLN wallet extension not detected. Install{' '}
          <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="settings-link">
            Alby
          </a>{' '}
          to use colored stella.
        </p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Wallet">
      {connected ? (
        <div className="wallet-connected">
          <div className="wallet-info">
            <span className="wallet-name">
              <Icon name="Zap" size={16} fill="#f7931a" /> {walletName || 'Lightning Wallet'}
            </span>
            {balance !== null && (
              <span className="wallet-balance">
                {formatNumber(balance)} sats
                <button className="wallet-refresh-btn" onClick={refreshBalance} title="Refresh balance">
                  <Icon name="RefreshCw" size={12} />
                </button>
              </span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="wallet-connect">
          <Button size="sm" onClick={connect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </div>
      )}

      {error && <p className="settings-error">{error}</p>}

      <p className="settings-note">
        Connect your Lightning wallet to give colored stella. Yellow is free, colored stella costs sats.
      </p>

      <div className="stella-price-info">
        <span className="stella-price-item">
          <Icon name="Star" size={12} fill="#f1c40f" /> Yellow: Free
        </span>
        <span className="stella-price-item">
          <Icon name="Star" size={12} fill="#2ecc71" /> Green: 1 sat
        </span>
        <span className="stella-price-item">
          <Icon name="Star" size={12} fill="#e74c3c" /> Red: 10 sats
        </span>
        <span className="stella-price-item">
          <Icon name="Star" size={12} fill="#3498db" /> Blue: 100 sats
        </span>
        <span className="stella-price-item">
          <Icon name="Star" size={12} fill="#9b59b6" /> Purple: 1,000 sats
        </span>
      </div>
    </SettingsSection>
  )
}
