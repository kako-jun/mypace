import { useNavigate } from 'react-router-dom'
import { BackButton, Icon } from '../components/ui'
import { getStoredThemeColors, isDarkColor } from '../lib/nostr/events'
import { useWallet } from '../hooks/useWallet'
import '../styles/pages/inventory.css'

// Stella color definitions (ordered by sats value descending for denomination conversion)
const STELLA_COLORS = [
  { name: 'purple', label: 'パープル', sats: 1000, color: '#9b59b6' },
  { name: 'blue', label: 'ブルー', sats: 100, color: '#3498db' },
  { name: 'red', label: 'レッド', sats: 10, color: '#e74c3c' },
  { name: 'green', label: 'グリーン', sats: 1, color: '#2ecc71' },
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

  const handleOpenAlby = () => {
    window.open('https://getalby.com/', '_blank', 'noopener,noreferrer')
  }

  const handleOpenWalletOfSatoshi = () => {
    window.open('https://www.walletofsatoshi.com/', '_blank', 'noopener,noreferrer')
  }

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
        <h2>インベントリ</h2>
        <p>Lightningウォレットの残高がカラーステラとして表示されます</p>
      </div>

      <div className="inventory-balance-section">
        <div className="inventory-balance-header">
          <span className="inventory-balance-label">カラーステラ残高</span>
          {connected && balance !== null ? (
            <>
              <span className="inventory-balance-value">{balance.toLocaleString()} sats</span>
              <button className="inventory-refresh-button" onClick={handleRefresh} title="残高を更新">
                <Icon name="RefreshCw" size={16} />
              </button>
            </>
          ) : connected && balance === null ? (
            <span className="inventory-balance-value inventory-balance-unknown">残高取得不可</span>
          ) : (
            <span className="inventory-balance-value inventory-not-connected">未接続</span>
          )}
        </div>

        {connected ? (
          <>
            {walletName && <div className="inventory-wallet-name">接続中: {walletName}</div>}
            {balance !== null ? (
              <div className="inventory-stella-list">
                {stellas.length > 0 ? (
                  stellas.map((stella) => (
                    <div key={stella.name} className="inventory-stella-item">
                      <span className="inventory-stella-icon" style={{ color: stella.color }}>
                        ★
                      </span>
                      <span className="inventory-stella-label">{stella.label}</span>
                      <span className="inventory-stella-count">{stella.count}個</span>
                    </div>
                  ))
                ) : (
                  <div className="inventory-stella-empty">残高がありません</div>
                )}
              </div>
            ) : (
              <div className="inventory-balance-unavailable">
                <p>このウォレットは残高の取得に対応していません</p>
              </div>
            )}
            <button className="inventory-disconnect-button" onClick={disconnect}>
              切断
            </button>
          </>
        ) : (
          <div className="inventory-connect-section">
            {hasWebLN ? (
              <>
                <button className="inventory-connect-button" onClick={handleConnect} disabled={loading}>
                  {loading ? '接続中...' : 'ウォレットを接続'}
                </button>
                {error && <p className="inventory-error">{error}</p>}
              </>
            ) : (
              <div className="inventory-no-webln">
                <p>Lightningウォレット拡張機能が見つかりません</p>
                <p className="inventory-install-hint">Alby拡張機能をインストールしてください</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="inventory-wallet-section">
        <h3>Lightningウォレット</h3>
        <p className="inventory-wallet-hint">satsを追加するには、Lightningウォレットをご利用ください</p>
        <div className="inventory-wallet-buttons">
          <button className="inventory-wallet-button" onClick={handleOpenAlby}>
            <span>Alby</span>
          </button>
          <button className="inventory-wallet-button" onClick={handleOpenWalletOfSatoshi}>
            <span>Wallet of Satoshi</span>
          </button>
        </div>
        <p className="inventory-wallet-note">※ MY PACEは決済を行いません。ウォレットの残高を表示するのみです。</p>
      </div>

      <div className="inventory-info-section">
        <h3>カラーステラについて</h3>
        <table className="inventory-price-table">
          <thead>
            <tr>
              <th>色</th>
              <th>価格</th>
            </tr>
          </thead>
          <tbody>
            {STELLA_COLORS.map((stella) => (
              <tr key={stella.name}>
                <td>
                  <span style={{ color: stella.color }}>★</span> {stella.label}
                </td>
                <td>{stella.sats} sats</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="inventory-info-note">
          他のNostrクライアントでZapを受け取ったsatsも、ここに反映されます。
          <br />
          MY PACE以外でZapとして使用することもできます。
        </p>
      </div>
    </div>
  )
}
