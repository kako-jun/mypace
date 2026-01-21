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
  fetchUserStats,
  type StellaBalance,
  type UserSupernova,
  type SupernovaDefinition,
  type UserStellaStats,
  type UserStats,
} from '../lib/api'
import { formatNumber } from '../lib/utils/format'
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
  const [userFullStats, setUserFullStats] = useState<UserStats | null>(null)
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
        const [balanceRes, userSupernovasRes, allSupernovasRes, statsRes, fullStatsRes] = await Promise.all([
          fetchStellaBalance(pk),
          fetchUserSupernovas(pk),
          fetchSupernovaDefinitions(),
          fetchUserStellaStats(pk),
          fetchUserStats(pk),
        ])

        if (balanceRes) {
          setBalance(balanceRes.balance)
        }
        setSupernovas(userSupernovasRes)
        setAllSupernovas(allSupernovasRes)
        setUserStats(statsRes)
        setUserFullStats(fullStatsRes)
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

  const completedIds = new Set(supernovas.map((s) => s.id))
  const allIncompleteSupernovas = allSupernovas.filter((s) => !completedIds.has(s.id))

  // Get progress for cumulative supernovas
  const getProgress = (supernova: SupernovaDefinition): { current: number; target: number } | null => {
    if (supernova.category !== 'cumulative') return null

    // Parse supernova ID to determine type
    const receivedMatch = supernova.id.match(/^received_(yellow|green|red|blue|purple)_(\d+)$/)
    const givenMatch = supernova.id.match(/^given_(yellow|green|red|blue|purple)_(\d+)$/)
    const postsMatch = supernova.id.match(/^posts_(\d+)$/)
    const supernovaMatch = supernova.id.match(/^supernova_(\d+)$/)

    if (receivedMatch && userStats) {
      const color = receivedMatch[1]
      const threshold = parseInt(receivedMatch[2], 10)
      return { current: userStats.received[color] || 0, target: threshold }
    }
    if (givenMatch && userStats) {
      const color = givenMatch[1]
      const threshold = parseInt(givenMatch[2], 10)
      return { current: userStats.given[color] || 0, target: threshold }
    }
    if (postsMatch && userFullStats?.postsCount != null) {
      const threshold = parseInt(postsMatch[1], 10)
      return { current: userFullStats.postsCount, target: threshold }
    }
    if (supernovaMatch) {
      const threshold = parseInt(supernovaMatch[1], 10)
      return { current: supernovas.length, target: threshold }
    }

    return null
  }

  // Filter and sort pending supernovas
  // - Show all non-cumulative (single) supernovas
  // - Show cumulative supernovas only if progress > 0 (hide until started)
  // - Sort by progress percentage (higher progress = higher in list)
  const pendingSupernovas = (() => {
    const result: SupernovaDefinition[] = []

    for (const s of allIncompleteSupernovas) {
      if (s.category === 'cumulative') {
        // Cumulative: only show if progress > 0
        const progress = getProgress(s)
        if (progress && progress.current > 0) {
          result.push(s)
        }
      } else {
        // Single (non-cumulative): always show
        result.push(s)
      }
    }

    // Sort by progress percentage (descending) - items with higher progress appear first
    result.sort((a, b) => {
      const progressA = getProgress(a)
      const progressB = getProgress(b)

      // Calculate progress percentage (0-1)
      const percentA = progressA ? progressA.current / progressA.target : 0
      const percentB = progressB ? progressB.current / progressB.target : 0

      // Sort descending (higher progress first)
      return percentB - percentA
    })

    return result
  })()

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

          {/* Supernovas Section */}
          <div className="inventory-supernovas-section">
            <h3>
              <Icon name="Sparkles" size={20} /> Supernovas ({supernovas.length}/{allSupernovas.length})
            </h3>

            {pendingSupernovas.length === 0 && supernovas.length === 0 ? (
              <p className="inventory-supernova-empty">No supernovas yet. Keep posting!</p>
            ) : (
              <div className="inventory-supernova-list">
                {/* Pending supernovas */}
                {pendingSupernovas.map((supernova) => {
                  const progress = getProgress(supernova)
                  return (
                    <div key={supernova.id} className="inventory-supernova-item pending">
                      <div className="inventory-supernova-icon">
                        <Icon name="Sparkles" size={24} fill="#999" />
                      </div>
                      <div className="inventory-supernova-info">
                        <span className="inventory-supernova-name">{supernova.name}</span>
                        {supernova.description !== supernova.name && (
                          <span className="inventory-supernova-desc">{supernova.description}</span>
                        )}
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
                              {formatNumber(progress.current)} / {formatNumber(progress.target)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="inventory-supernova-reward">
                        {supernova.reward_green > 0 && (
                          <span>
                            <Icon name="Star" size={14} fill={STELLA_COLORS.green.hex} />+
                            {formatNumber(supernova.reward_green)}
                          </span>
                        )}
                        {supernova.reward_red > 0 && (
                          <span>
                            <Icon name="Star" size={14} fill={STELLA_COLORS.red.hex} />+
                            {formatNumber(supernova.reward_red)}
                          </span>
                        )}
                        {supernova.reward_blue > 0 && (
                          <span>
                            <Icon name="Star" size={14} fill={STELLA_COLORS.blue.hex} />+
                            {formatNumber(supernova.reward_blue)}
                          </span>
                        )}
                        {supernova.reward_purple > 0 && (
                          <span>
                            <Icon name="Star" size={14} fill={STELLA_COLORS.purple.hex} />+
                            {formatNumber(supernova.reward_purple)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* Completed supernovas */}
                {supernovas.map((supernova) => (
                  <div key={supernova.id} className="inventory-supernova-item completed">
                    <div className="inventory-supernova-icon">
                      <Icon
                        name="Sparkles"
                        size={24}
                        fill={STELLA_COLORS[supernova.supernova_color as keyof typeof STELLA_COLORS]?.hex || '#ffd700'}
                      />
                    </div>
                    <div className="inventory-supernova-info">
                      <span className="inventory-supernova-name">{supernova.name}</span>
                      {supernova.description !== supernova.name && (
                        <span className="inventory-supernova-desc">{supernova.description}</span>
                      )}
                      <span className="inventory-supernova-date">
                        {new Date(supernova.unlocked_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="inventory-supernova-reward">
                      {supernova.reward_green > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.green.hex} />+
                          {formatNumber(supernova.reward_green)}
                        </span>
                      )}
                      {supernova.reward_red > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.red.hex} />+
                          {formatNumber(supernova.reward_red)}
                        </span>
                      )}
                      {supernova.reward_blue > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.blue.hex} />+
                          {formatNumber(supernova.reward_blue)}
                        </span>
                      )}
                      {supernova.reward_purple > 0 && (
                        <span>
                          <Icon name="Star" size={14} fill={STELLA_COLORS.purple.hex} />+
                          {formatNumber(supernova.reward_purple)}
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
