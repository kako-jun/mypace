import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Icon, Loading } from '../components/ui'
import { getStoredThemeColors, isDarkColor, STELLA_COLORS } from '../lib/nostr/events'
import { getCurrentPubkey } from '../lib/nostr/events'
import {
  fetchStellaBalance,
  fetchUserSupernovas,
  fetchSupernovaDefinitions,
  fetchUserStellaStats,
  type StellaBalance,
  type UserSupernova,
  type SupernovaDefinition,
  type UserStellaStats,
} from '../lib/api'
import '../styles/pages/inventory.css'

// Stella color order for display (yellow excluded - infinite use)
const STELLA_COLOR_ORDER = ['green', 'red', 'blue', 'purple'] as const

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
  const [userStats, setUserStats] = useState<UserStellaStats | null>(null)
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
        const [balanceRes, userSupernovasRes, allSupernovasRes, statsRes] = await Promise.all([
          fetchStellaBalance(pk),
          fetchUserSupernovas(pk),
          fetchSupernovaDefinitions(),
          fetchUserStellaStats(pk),
        ])

        if (balanceRes) {
          setBalance(balanceRes.balance)
        }
        setSupernovas(userSupernovasRes)
        setAllSupernovas(allSupernovasRes)
        setUserStats(statsRes)
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
    // Yellow excluded from total (infinite use)
    return balance.green + balance.red + balance.blue + balance.purple
  }

  const unlockedIds = new Set(supernovas.map((s) => s.id))
  const allLockedSupernovas = allSupernovas.filter((s) => !unlockedIds.has(s.id))

  // Helper to extract cumulative group key (e.g., "received_yellow", "given_green")
  const getCumulativeGroupKey = (id: string): string | null => {
    const match = id.match(/^(received|given)_(yellow|green|red|blue|purple)_\d+$/)
    return match ? `${match[1]}_${match[2]}` : null
  }

  // Filter cumulative supernovas to show only the next milestone for each group
  const lockedSupernovas = (() => {
    const nonCumulative = allLockedSupernovas.filter((s) => s.category !== 'cumulative')

    // Group cumulative supernovas by type (received_yellow, given_green, etc.)
    const cumulativeGroups = new Map<string, SupernovaDefinition[]>()
    for (const s of allLockedSupernovas.filter((s) => s.category === 'cumulative')) {
      const groupKey = getCumulativeGroupKey(s.id)
      if (groupKey) {
        if (!cumulativeGroups.has(groupKey)) {
          cumulativeGroups.set(groupKey, [])
        }
        cumulativeGroups.get(groupKey)!.push(s)
      }
    }

    // For each group, only show the lowest threshold (next milestone to unlock)
    const nextMilestones: SupernovaDefinition[] = []
    for (const [_groupKey, group] of cumulativeGroups) {
      // Sort by threshold ascending
      group.sort((a, b) => (a.threshold || 0) - (b.threshold || 0))
      // Add only the first one (lowest threshold = next to unlock)
      if (group.length > 0) {
        nextMilestones.push(group[0])
      }
    }

    return [...nonCumulative, ...nextMilestones]
  })()

  // Get progress for cumulative supernovas
  const getProgress = (supernova: SupernovaDefinition): { current: number; target: number } | null => {
    if (supernova.category !== 'cumulative' || !userStats) return null

    // Parse supernova ID to determine type: received_{color}_{threshold} or given_{color}_{threshold}
    const receivedMatch = supernova.id.match(/^received_(yellow|green|red|blue|purple)_(\d+)$/)
    const givenMatch = supernova.id.match(/^given_(yellow|green|red|blue|purple)_(\d+)$/)

    if (receivedMatch) {
      const color = receivedMatch[1]
      const threshold = parseInt(receivedMatch[2], 10)
      return { current: userStats.received[color] || 0, target: threshold }
    }
    if (givenMatch) {
      const color = givenMatch[1]
      const threshold = parseInt(givenMatch[2], 10)
      return { current: userStats.given[color] || 0, target: threshold }
    }

    return null
  }

  return (
    <div className="inventory-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className={`inventory-header themed-card ${textClass}`}>
        <h2>Inventory</h2>
        <p>Your Color Stella balance and unlocked Supernovas.</p>
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

            {getTotalBalance() === 0 && <p className="inventory-balance-hint">Earn stella by unlocking Supernovas!</p>}
          </div>

          {/* Supernovas Section - Locked on top, Unlocked below */}
          <div className="inventory-supernovas-section">
            <h3>
              <Icon name="Sparkles" size={20} /> Supernovas ({supernovas.length}/{allSupernovas.length})
            </h3>

            {lockedSupernovas.length === 0 && supernovas.length === 0 ? (
              <p className="inventory-supernova-empty">No supernovas yet. Keep posting to unlock!</p>
            ) : (
              <div className="inventory-supernova-list">
                {/* Locked supernovas (next to unlock) */}
                {lockedSupernovas.map((supernova) => {
                  const progress = getProgress(supernova)
                  return (
                    <div key={supernova.id} className="inventory-supernova-item locked">
                      <div className="inventory-supernova-icon">
                        <Icon name="Sparkles" size={24} fill="#999" />
                      </div>
                      <div className="inventory-supernova-info">
                        <span className="inventory-supernova-name">{supernova.name}</span>
                        <span className="inventory-supernova-desc">{supernova.description}</span>
                        {progress && (
                          <div className="inventory-supernova-progress">
                            <div className="inventory-progress-bar">
                              <div
                                className="inventory-progress-fill"
                                style={{
                                  width: `${Math.min(100, (progress.current / progress.target) * 100)}%`,
                                  backgroundColor:
                                    STELLA_COLORS[supernova.supernova_color as keyof typeof STELLA_COLORS]?.hex ||
                                    '#ffd700',
                                }}
                              />
                            </div>
                            <span className="inventory-progress-text">
                              {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="inventory-supernova-reward">
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
                  )
                })}
                {/* Unlocked supernovas */}
                {supernovas.map((supernova) => (
                  <div key={supernova.id} className="inventory-supernova-item unlocked">
                    <div className="inventory-supernova-icon">
                      <Icon
                        name="Sparkles"
                        size={24}
                        fill={STELLA_COLORS[supernova.supernova_color as keyof typeof STELLA_COLORS]?.hex || '#ffd700'}
                      />
                    </div>
                    <div className="inventory-supernova-info">
                      <span className="inventory-supernova-name">{supernova.name}</span>
                      <span className="inventory-supernova-desc">{supernova.description}</span>
                      <span className="inventory-supernova-date">
                        Unlocked: {new Date(supernova.unlocked_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="inventory-supernova-reward">
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
