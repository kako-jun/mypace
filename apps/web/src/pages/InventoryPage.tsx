import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Icon, Loading } from '../components/ui'
import { getStoredThemeColors, isDarkColor, STELLA_COLORS } from '../lib/nostr/events'
import { getCurrentPubkey } from '../lib/nostr/events'
import {
  fetchStellaBalance,
  fetchUserSupernovas,
  fetchSupernovaDefinitions,
  type StellaBalance,
  type UserSupernova,
  type SupernovaDefinition,
} from '../lib/api'
import '../styles/pages/inventory.css'

// Stella color order for display
const STELLA_COLOR_ORDER = ['yellow', 'green', 'red', 'blue', 'purple'] as const

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

export function InventoryPage() {
  const navigate = useNavigate()
  const textClass = useTextClass()

  const [_pubkey, setPubkey] = useState<string | null>(null)
  const [balance, setBalance] = useState<StellaBalance | null>(null)
  const [supernovas, setSupernovas] = useState<UserSupernova[]>([])
  const [allSupernovas, setAllSupernovas] = useState<SupernovaDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const pk = await getCurrentPubkey()
        setPubkey(pk)

        // Fetch data in parallel
        const [balanceRes, userSupernovasRes, allSupernovasRes] = await Promise.all([
          fetchStellaBalance(pk),
          fetchUserSupernovas(pk),
          fetchSupernovaDefinitions(),
        ])

        if (balanceRes) {
          setBalance(balanceRes.balance)
        }
        setSupernovas(userSupernovasRes)
        setAllSupernovas(allSupernovasRes)
      } catch (e) {
        console.error('Failed to load inventory data:', e)
        setError('Failed to load inventory data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const getTotalBalance = () => {
    if (!balance) return 0
    return balance.yellow + balance.green + balance.red + balance.blue + balance.purple
  }

  const unlockedIds = new Set(supernovas.map((s) => s.id))
  const lockedSupernovas = allSupernovas.filter((s) => !unlockedIds.has(s.id))

  return (
    <div className="inventory-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className={`inventory-header themed-card ${textClass}`}>
        <h2>Inventory</h2>
        <p>Your Color Stella balance and unlocked Trophies.</p>
      </div>

      {loading ? (
        <div className="inventory-loading">
          <Loading />
        </div>
      ) : error ? (
        <div className="inventory-error">{error}</div>
      ) : (
        <>
          {/* Stella Balance Section */}
          <div className="inventory-balance-section">
            <div className="inventory-balance-header">
              <span className="inventory-balance-label">Color Stella Balance</span>
              <span className="inventory-balance-value">{getTotalBalance().toLocaleString()} stella</span>
            </div>

            <div className="inventory-stella-list">
              {STELLA_COLOR_ORDER.map((colorName) => {
                const colorInfo = STELLA_COLORS[colorName]
                const count = balance?.[colorName] || 0
                return (
                  <div key={colorName} className="inventory-stella-item">
                    <span className="inventory-stella-icon">
                      <Icon name="Star" size={20} fill={colorInfo.hex} />
                    </span>
                    <span className="inventory-stella-label">{colorInfo.label}</span>
                    <span className="inventory-stella-count">×{count.toLocaleString()}</span>
                  </div>
                )
              })}
            </div>

            {getTotalBalance() === 0 && (
              <p className="inventory-balance-hint">Earn stella by unlocking Trophies (Supernovas)!</p>
            )}
          </div>

          {/* Unlocked Trophies Section */}
          <div className="inventory-trophies-section">
            <h3>
              <Icon name="Trophy" size={20} /> Trophies ({supernovas.length}/{allSupernovas.length})
            </h3>

            {supernovas.length > 0 ? (
              <div className="inventory-trophy-list">
                {supernovas.map((supernova) => (
                  <div key={supernova.id} className="inventory-trophy-item unlocked">
                    <div className="inventory-trophy-icon">
                      <Icon
                        name="Trophy"
                        size={24}
                        fill={STELLA_COLORS[supernova.trophy_color as keyof typeof STELLA_COLORS]?.hex || '#ffd700'}
                      />
                    </div>
                    <div className="inventory-trophy-info">
                      <span className="inventory-trophy-name">{supernova.name}</span>
                      <span className="inventory-trophy-desc">{supernova.description}</span>
                      <span className="inventory-trophy-date">
                        Unlocked: {new Date(supernova.unlocked_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="inventory-trophy-reward">
                      {supernova.reward_yellow > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.yellow.hex} />+{supernova.reward_yellow}
                        </span>
                      )}
                      {supernova.reward_green > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.green.hex} />+{supernova.reward_green}
                        </span>
                      )}
                      {supernova.reward_red > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.red.hex} />+{supernova.reward_red}
                        </span>
                      )}
                      {supernova.reward_blue > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.blue.hex} />+{supernova.reward_blue}
                        </span>
                      )}
                      {supernova.reward_purple > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.purple.hex} />+{supernova.reward_purple}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="inventory-trophy-empty">No trophies yet. Keep posting to unlock!</p>
            )}
          </div>

          {/* Locked Trophies Section */}
          {lockedSupernovas.length > 0 && (
            <div className="inventory-trophies-section locked-section">
              <h3>
                <Icon name="Lock" size={20} /> Locked ({lockedSupernovas.length})
              </h3>

              <div className="inventory-trophy-list">
                {lockedSupernovas.map((supernova) => (
                  <div key={supernova.id} className="inventory-trophy-item locked">
                    <div className="inventory-trophy-icon">
                      <Icon name="Trophy" size={24} fill="#999" />
                    </div>
                    <div className="inventory-trophy-info">
                      <span className="inventory-trophy-name">{supernova.name}</span>
                      <span className="inventory-trophy-desc">{supernova.description}</span>
                    </div>
                    <div className="inventory-trophy-reward">
                      {supernova.reward_yellow > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.yellow.hex} />+{supernova.reward_yellow}
                        </span>
                      )}
                      {supernova.reward_green > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.green.hex} />+{supernova.reward_green}
                        </span>
                      )}
                      {supernova.reward_red > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.red.hex} />+{supernova.reward_red}
                        </span>
                      )}
                      {supernova.reward_blue > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.blue.hex} />+{supernova.reward_blue}
                        </span>
                      )}
                      {supernova.reward_purple > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.purple.hex} />+{supernova.reward_purple}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="inventory-info-section">
            <h3>About Trophies (Supernovas)</h3>
            <p className="inventory-info-text">
              Trophies are achievements you can unlock by using MY PACE. Each trophy rewards you with Color Stella that
              you can use to give reactions to other posts.
            </p>
            <ul className="inventory-info-list">
              <li>
                <Icon name="Star" size={14} fill={STELLA_COLORS.yellow.hex} /> Yellow - Basic stella
              </li>
              <li>
                <Icon name="Star" size={14} fill={STELLA_COLORS.green.hex} /> Green - Uncommon stella
              </li>
              <li>
                <Icon name="Star" size={14} fill={STELLA_COLORS.red.hex} /> Red - Rare stella
              </li>
              <li>
                <Icon name="Star" size={14} fill={STELLA_COLORS.blue.hex} /> Blue - Epic stella
              </li>
              <li>
                <Icon name="Star" size={14} fill={STELLA_COLORS.purple.hex} /> Purple - Legendary stella
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
