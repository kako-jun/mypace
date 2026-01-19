import { useNavigate } from 'react-router-dom'
import { BackButton, Icon } from '../components/ui'
import { getStoredThemeColors, isDarkColor } from '../lib/nostr/events'
import { useWallet } from '../hooks/useWallet'
import '../styles/pages/inventory.css'

// Stella color definitions (ordered by sats value descending for denomination conversion)
const STELLA_COLORS = [
  { name: 'purple', label: 'Purple', sats: 1000, color: '#9b59b6' },
  { name: 'blue', label: 'Blue', sats: 100, color: '#3498db' },
  { name: 'red', label: 'Red', sats: 10, color: '#e74c3c' },
  { name: 'green', label: 'Green', sats: 1, color: '#2ecc71' },
] as const

function useTextClass(): string {
  const colors = getStoredThemeColors()
  if (!colors) return ''

  const darkCount =
    (isDarkColor(colors.topLeft) ? 1 : 0) +
    (isDarkColor(colors.topRight) ? 1 : 0) +
    (isDarkColor(colors.bottomLeft) ? 1 : 0) +
    (isDarkColor(colors.bottomRight) ? 1 : 0)

  return darkCount >= 2 ? 'light-text' : 'dark-text'
}

// Convert sats balance to stella denominations
function satsToStellas(sats: number): { name: string; label: string; count: number; color: string }[] {
  const result: { name: string; label: string; count: number; color: string }[] = []
  let remaining = sats

  for (const stella of STELLA_COLORS) {
    const count = Math.floor(remaining / stella.sats)
    if (count > 0) {
      result.push({ name: stella.name, label: stella.label, count, color: stella.color })
      remaining = remaining % stella.sats
    }
  }

  return result
}

export function InventoryPage() {
  const navigate = useNavigate()
  const textClass = useTextClass()
  const { connected, balance, walletName, loading, error, hasWebLN, connect, disconnect, refreshBalance } = useWallet()

  const stellas = balance !== null ? satsToStellas(balance) : []

  const handleConnect = async () => {
    await connect()
  }

  const handleRefresh = async () => {
    await refreshBalance()
  }

  return (
    <div className="inventory-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className={`inventory-header themed-card ${textClass}`}>
        <h2>Inventory</h2>
        <p>Your Lightning wallet balance displayed as Color Stella</p>
      </div>

      <div className="inventory-balance-section">
        <div className="inventory-balance-header">
          <span className="inventory-balance-label">Color Stella Balance</span>
          {connected && balance !== null ? (
            <>
              <span className="inventory-balance-value">{balance.toLocaleString()} sats</span>
              <button className="inventory-refresh-button" onClick={handleRefresh} title="Refresh balance">
                <Icon name="RefreshCw" size={16} />
              </button>
            </>
          ) : connected && balance === null ? (
            <span className="inventory-balance-value inventory-balance-unknown">Balance unavailable</span>
          ) : (
            <span className="inventory-balance-value inventory-not-connected">Not connected</span>
          )}
        </div>

        {connected ? (
          <>
            {walletName && <div className="inventory-wallet-name">Connected: {walletName}</div>}
            {balance !== null ? (
              <div className="inventory-stella-list">
                {stellas.length > 0 ? (
                  stellas.map((stella) => (
                    <div key={stella.name} className="inventory-stella-item">
                      <span className="inventory-stella-icon">
                        <Icon name="Star" size={20} fill={stella.color} />
                      </span>
                      <span className="inventory-stella-label">{stella.label}</span>
                      <span className="inventory-stella-count">×{stella.count.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="inventory-stella-empty">No balance</div>
                )}
              </div>
            ) : (
              <div className="inventory-balance-unavailable">
                <p>This wallet does not support balance retrieval</p>
              </div>
            )}
            <button className="inventory-disconnect-button" onClick={disconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <div className="inventory-connect-section">
            {hasWebLN ? (
              <>
                <button className="inventory-connect-button" onClick={handleConnect} disabled={loading}>
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </button>
                {error && <p className="inventory-error">{error}</p>}
              </>
            ) : (
              <div className="inventory-no-webln">
                <p>Lightning wallet extension not found</p>
                <p className="inventory-install-hint">Please install a WebLN-compatible extension (e.g. Alby)</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="inventory-wallet-section">
        <h3>Lightning Wallet</h3>
        <p className="inventory-wallet-hint">Use a Lightning wallet to add sats</p>
        <div className="inventory-wallet-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={() => window.open('https://getalby.com/', '_blank', 'noopener,noreferrer')}
          >
            Alby
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={() => window.open('https://www.walletofsatoshi.com/', '_blank', 'noopener,noreferrer')}
          >
            Wallet of Satoshi
          </button>
        </div>
        <p className="inventory-wallet-note">
          * MY PACE does not process payments. It only displays your wallet balance.
        </p>
      </div>

      <div className="inventory-info-section">
        <h3>About Color Stella</h3>
        <table className="inventory-price-table">
          <thead>
            <tr>
              <th>Color</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {STELLA_COLORS.map((stella) => (
              <tr key={stella.name}>
                <td>
                  <span className="inventory-color-cell">
                    <Icon name="Star" size={16} fill={stella.color} />
                    <span>{stella.label}</span>
                  </span>
                </td>
                <td>{stella.sats.toLocaleString()} sats</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="inventory-info-note">
          Sats received via Zap from other Nostr clients are also reflected here.
          <br />
          You can also use them as Zap outside of MY PACE.
        </p>
      </div>
    </div>
  )
}
