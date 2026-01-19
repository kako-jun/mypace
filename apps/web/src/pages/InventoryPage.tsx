import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Icon } from '../components/ui'
import { getStoredThemeColors, isDarkColor } from '../lib/nostr/events'
import '../styles/pages/inventory.css'

// Stella color definitions
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

  // TODO: Get actual wallet balance from Lightning wallet (Alby/NWC)
  // For now, use a placeholder (null means not connected)
  const [walletBalance] = useState<number | null>(null)

  const stellas = walletBalance !== null ? satsToStellas(walletBalance) : []

  const handleOpenAlby = () => {
    window.open('https://getalby.com/', '_blank', 'noopener,noreferrer')
  }

  const handleOpenWalletOfSatoshi = () => {
    window.open('https://www.walletofsatoshi.com/', '_blank', 'noopener,noreferrer')
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
          {walletBalance !== null ? (
            <span className="inventory-balance-value">{walletBalance.toLocaleString()} sats</span>
          ) : (
            <span className="inventory-balance-value inventory-not-connected">未接続</span>
          )}
          <button className="inventory-add-button" title="satsを追加">
            <Icon name="Plus" size={20} />
          </button>
        </div>

        {walletBalance !== null ? (
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
          <div className="inventory-not-connected-message">
            <p>Lightningウォレットを接続すると、残高がカラーステラとして表示されます</p>
          </div>
        )}
      </div>

      <div className="inventory-wallet-section">
        <h3>satsを追加</h3>
        <p className="inventory-wallet-hint">satsを追加するには、Lightningウォレットをご利用ください</p>
        <div className="inventory-wallet-buttons">
          <button className="inventory-wallet-button" onClick={handleOpenAlby}>
            <span>Alby</span>
          </button>
          <button className="inventory-wallet-button" onClick={handleOpenWalletOfSatoshi}>
            <span>Wallet of Satoshi</span>
          </button>
        </div>
        <p className="inventory-wallet-note">※ MY PACEは決済を行いません</p>
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
