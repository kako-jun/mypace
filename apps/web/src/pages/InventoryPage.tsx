import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackButton, Icon, Loading, Tabs } from '../components/ui'
import { useCelebration } from '../components/supernova'
import { WordCard, SynthesisPanel, WordSynthesisCelebration } from '../components/wordrot'
import { useWordrot, useSynthesis } from '../hooks/wordrot'
import type { SynthesisResult } from '../hooks/wordrot'
import { getThemeCardProps, STELLA_COLORS } from '../lib/nostr/events'
import { getThemeColors } from '../lib/storage'
import { getCurrentPubkey } from '../lib/nostr/events'
import {
  fetchStellaBalance,
  fetchUserSupernovas,
  fetchSupernovaDefinitions,
  fetchUserStellaStats,
  fetchUserStats,
  checkSupernovas,
  retryWordImage,
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

type TabType = 'stella' | 'wordrot'

export function InventoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const themeProps = getThemeCardProps(getThemeColors())
  const textClass = themeProps.className.includes('light-text') ? 'light-text' : 'dark-text'
  const { celebrate } = useCelebration()

  // Tab state from URL
  const activeTab = (searchParams.get('tab') as TabType) || 'wordrot'
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams)
    if (tab === 'wordrot') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    setSearchParams(params)
  }

  // Word parameter from URL - if provided, open wordrot tab and highlight word
  const highlightWord = searchParams.get('word')

  const [_pubkey, setPubkey] = useState<string | null>(null)
  const [balance, setBalance] = useState<StellaBalance | null>(null)
  const [supernovas, setSupernovas] = useState<UserSupernova[]>([])
  const [allSupernovas, setAllSupernovas] = useState<SupernovaDefinition[]>([])
  const [userStats, setUserStats] = useState<UserStellaStats | null>(null)
  const [userFullStats, setUserFullStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wordrot state
  const {
    inventory: wordrotInventory,
    uniqueCount: wordrotUniqueCount,
    isLoadingInventory: wordrotLoading,
    loadInventory: loadWordrotInventory,
  } = useWordrot()

  // Synthesis state
  const synthesis = useSynthesis()
  const { slotA, slotB, slotC, setSlotA, setSlotB, setSlotC } = synthesis
  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | 'C'>('A')

  // Synthesis celebration state
  const [synthesisCelebration, setSynthesisCelebration] = useState<SynthesisResult | null>(null)
  const [showSynthesisCelebration, setShowSynthesisCelebration] = useState(false)

  // Card tap → place word into active slot, then advance to next empty
  const handleWordSelect = (word: { text: string }) => {
    // Prevent selecting the same word for multiple slots
    if (
      (activeSlot !== 'A' && slotA === word.text) ||
      (activeSlot !== 'B' && slotB === word.text) ||
      (activeSlot !== 'C' && slotC === word.text)
    ) {
      return
    }

    switch (activeSlot) {
      case 'A':
        setSlotA(word.text)
        break
      case 'B':
        setSlotB(word.text)
        break
      case 'C':
        setSlotC(word.text)
        break
    }
    // Advance to next empty slot after this render
    const slots = { A: slotA, B: slotB, C: slotC }
    slots[activeSlot] = word.text // reflect what we just set
    const order: ('A' | 'B' | 'C')[] = ['A', 'B', 'C']
    const next = order.find((s) => s !== activeSlot && !slots[s])
    if (next) setActiveSlot(next)
  }

  // Slot tap → if filled, clear it; set as active
  const handleSlotTap = (slot: 'A' | 'B' | 'C') => {
    const value = slot === 'A' ? slotA : slot === 'B' ? slotB : slotC
    if (value) {
      if (slot === 'A') setSlotA(null)
      else if (slot === 'B') setSlotB(null)
      else setSlotC(null)
    }
    setActiveSlot(slot)
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const pk = await getCurrentPubkey()
        setPubkey(pk)

        // checkSupernovasはDB書き込み（unlock）を含むため、先に順次実行
        // fetchUserSupernovasが新しくunlockされたデータを読めるよう順序を保証
        const checkResult = await checkSupernovas(pk)
        if (checkResult.newlyUnlocked.length > 0) {
          celebrate(checkResult.newlyUnlocked)
        }

        // 読み取り系を全て並列実行
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

  // Auto-switch to wordrot tab if word parameter is provided
  useEffect(() => {
    if (highlightWord && activeTab !== 'wordrot') {
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'wordrot')
      setSearchParams(params, { replace: true })
    }
  }, [highlightWord])

  // Scroll to highlighted word after inventory loads
  useEffect(() => {
    if (highlightWord && activeTab === 'wordrot' && !wordrotLoading && wordrotInventory.length > 0) {
      // Wait for render to complete
      setTimeout(() => {
        const anchorId = `word-${highlightWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        const element = document.getElementById(anchorId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [highlightWord, activeTab, wordrotLoading, wordrotInventory.length])

  const getTotalBalance = () => {
    if (!balance) return 0
    // Yellow excluded from total (infinite use)
    return balance.green + balance.red + balance.blue + balance.purple
  }

  const completedIds = new Set(supernovas.map((s) => s.id))
  const allIncompleteSupernovas = allSupernovas.filter((s) => !completedIds.has(s.id))

  // Define tier thresholds for each series (starting from 1)
  // Single-item series have only [1] for now but can be expanded to [1, 10, 100, 1000] later
  const SERIES_THRESHOLDS: Record<string, number[]> = {
    posts: [1, 10, 100, 1000],
    supernova: [1, 10, 25, 50],
    long_post: [281, 1000, 2000, 4000],
    penguin: [1000, 500, 250, 100], // Reverse order: lower number = higher tier
    received_green: [1, 10, 100, 1000],
    received_red: [1, 10, 100, 1000],
    received_blue: [1, 10, 100, 1000],
    received_purple: [1, 10, 100, 1000],
    given_green: [1, 10, 100, 1000],
    given_red: [1, 10, 100, 1000],
    given_blue: [1, 10, 100, 1000],
    given_purple: [1, 10, 100, 1000],
    // Future-expandable series (currently single-item)
    teaser: [1],
    super_mention: [1],
    image: [1],
    voice: [1],
    map: [1],
    url: [1],
    table: [1],
    list: [1],
    reply: [1],
    repost: [1],
  }

  // Map series + threshold to actual supernova ID
  const getSeriesId = (series: string, threshold: number): string => {
    // Long post series has different naming
    if (series === 'long_post') {
      return threshold === 281 ? 'first_long_post' : `first_${threshold}_chars`
    }
    // Penguin series: penguin_1000, penguin_500, etc.
    if (series === 'penguin') {
      return `penguin_${threshold}`
    }
    // First tier (threshold=1) has special names
    if (threshold === 1) {
      switch (series) {
        case 'posts':
          return 'first_post'
        case 'supernova':
          return 'first_supernova'
        case 'received_green':
        case 'received_red':
        case 'received_blue':
        case 'received_purple':
          return 'first_received_stella'
        case 'given_green':
        case 'given_red':
        case 'given_blue':
        case 'given_purple':
          return 'first_given_stella'
        // Single-item series (expandable in future)
        case 'teaser':
          return 'first_teaser'
        case 'super_mention':
          return 'first_super_mention'
        case 'image':
          return 'first_image'
        case 'voice':
          return 'first_voice'
        case 'map':
          return 'first_map'
        case 'url':
          return 'first_url'
        case 'table':
          return 'first_table'
        case 'list':
          return 'first_list'
        case 'reply':
          return 'first_reply'
        case 'repost':
          return 'first_repost'
        default:
          return `${series}_${threshold}`
      }
    }
    return `${series}_${threshold}`
  }

  // Get the previous tier ID that must be completed before showing this supernova
  const getPreviousTierId = (supernovaId: string): string | null => {
    // Parse series and threshold from ID
    const postsMatch = supernovaId.match(/^posts_(\d+)$/)
    const supernovaMatch = supernovaId.match(/^supernova_(\d+)$/)
    const longPostMatch = supernovaId.match(/^first_(\d+)_chars$/)
    const penguinMatch = supernovaId.match(/^penguin_(\d+)$/)
    const receivedMatch = supernovaId.match(/^(received_(?:green|red|blue|purple))_(\d+)$/)
    const givenMatch = supernovaId.match(/^(given_(?:green|red|blue|purple))_(\d+)$/)
    // Future-expandable series: teaser_10, image_100, url_1000, etc.
    const expandableMatch = supernovaId.match(
      /^(teaser|super_mention|image|voice|map|url|table|list|reply|repost)_(\d+)$/
    )

    let series: string | null = null
    let threshold: number | null = null

    if (postsMatch) {
      series = 'posts'
      threshold = parseInt(postsMatch[1], 10)
    } else if (supernovaMatch) {
      series = 'supernova'
      threshold = parseInt(supernovaMatch[1], 10)
    } else if (longPostMatch) {
      series = 'long_post'
      threshold = parseInt(longPostMatch[1], 10)
    } else if (penguinMatch) {
      series = 'penguin'
      threshold = parseInt(penguinMatch[1], 10)
    } else if (receivedMatch) {
      series = receivedMatch[1]
      threshold = parseInt(receivedMatch[2], 10)
    } else if (givenMatch) {
      series = givenMatch[1]
      threshold = parseInt(givenMatch[2], 10)
    } else if (expandableMatch) {
      series = expandableMatch[1]
      threshold = parseInt(expandableMatch[2], 10)
    }

    if (!series || threshold === null) return null

    const thresholds = SERIES_THRESHOLDS[series]
    if (!thresholds) return null

    const idx = thresholds.indexOf(threshold)
    if (idx <= 0) return null // First tier or not found

    const prevThreshold = thresholds[idx - 1]
    return getSeriesId(series, prevThreshold)
  }

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
  // - Show cumulative supernovas only if:
  //   1. It's the first tier of a series, OR previous tier is completed
  //   2. progress > 0 (hide until started)
  // - Sort by progress percentage (higher progress = higher in list)
  const pendingSupernovas = (() => {
    const result: SupernovaDefinition[] = []

    for (const s of allIncompleteSupernovas) {
      if (s.category === 'cumulative') {
        // Check if previous tier must be completed first
        const prevTierId = getPreviousTierId(s.id)
        if (prevTierId && !completedIds.has(prevTierId)) {
          // Previous tier not completed - don't show this one
          continue
        }

        // Cumulative: only show if progress > 0
        const progress = getProgress(s)
        if (progress && progress.current > 0) {
          result.push(s)
        }
      } else {
        // Single (non-cumulative): check if previous tier is required
        const prevTierId = getPreviousTierId(s.id)
        if (prevTierId && !completedIds.has(prevTierId)) {
          // Previous tier not completed - don't show this one
          continue
        }
        result.push(s)
      }
    }

    // Sort by: 1) progress percentage (descending), 2) color tier (green→red→blue→purple), 3) name alphabetically
    const colorOrder: Record<string, number> = { green: 0, red: 1, blue: 2, purple: 3 }
    result.sort((a, b) => {
      const progressA = getProgress(a)
      const progressB = getProgress(b)

      // Primary: progress percentage (descending)
      const percentA = progressA ? progressA.current / progressA.target : 0
      const percentB = progressB ? progressB.current / progressB.target : 0
      if (percentA !== percentB) {
        return percentB - percentA
      }

      // Secondary: color tier (green first, purple last)
      const colorA = colorOrder[a.supernova_color] ?? 99
      const colorB = colorOrder[b.supernova_color] ?? 99
      if (colorA !== colorB) {
        return colorA - colorB
      }

      // Tertiary: name alphabetically
      return a.name.localeCompare(b.name)
    })

    return result
  })()

  return (
    <div className="inventory-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className={`inventory-header ${textClass}`}>
        <h2>Inventory</h2>
        <p>Your Color Stella balance, Supernovas, and Wordrot Collection.</p>
      </div>

      {/* Tab Navigation */}
      <Tabs
        tabs={[
          {
            value: 'wordrot' as const,
            label: (
              <>
                <Icon name="FlaskConical" size={16} />
                <span>Wordrot</span>
                {wordrotUniqueCount > 0 && <span className="inventory-tab-badge">{wordrotUniqueCount}</span>}
              </>
            ),
          },
          {
            value: 'stella' as const,
            label: (
              <>
                <Icon name="Star" size={16} />
                <span>Stella</span>
              </>
            ),
          },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="inventory-tabs"
      />

      {/* Stella Tab Content */}
      {activeTab === 'stella' && (
        <>
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

                {getTotalBalance() === 0 && (
                  <p className="inventory-balance-hint">Earn stella by unlocking Supernovas!</p>
                )}
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
                      const hasReward =
                        supernova.reward_green > 0 ||
                        supernova.reward_red > 0 ||
                        supernova.reward_blue > 0 ||
                        supernova.reward_purple > 0
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
                            {hasReward && (
                              <div className="inventory-supernova-reward-inline">
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
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {/* Completed supernovas - sorted by unlock date (newest first, oldest at bottom) */}
                    {/* When timestamps are equal, higher tier (later in series array) comes first */}
                    {[...supernovas]
                      .sort((a, b) => {
                        // Primary sort: by unlock date (newest first)
                        if (a.unlocked_at !== b.unlocked_at) {
                          return b.unlocked_at - a.unlocked_at
                        }
                        // Secondary sort: use series array index (higher index = higher tier = first)
                        const getTierIndex = (id: string): number => {
                          for (const [series, thresholds] of Object.entries(SERIES_THRESHOLDS)) {
                            for (let i = 0; i < thresholds.length; i++) {
                              if (getSeriesId(series, thresholds[i]) === id) {
                                return i
                              }
                            }
                          }
                          return -1
                        }
                        return getTierIndex(b.id) - getTierIndex(a.id)
                      })
                      .map((supernova) => {
                        const hasReward =
                          supernova.reward_green > 0 ||
                          supernova.reward_red > 0 ||
                          supernova.reward_blue > 0 ||
                          supernova.reward_purple > 0
                        return (
                          <div key={supernova.id} className="inventory-supernova-item completed">
                            <div className="inventory-supernova-icon">
                              <Icon
                                name="Sparkles"
                                size={24}
                                fill={
                                  STELLA_COLORS[supernova.supernova_color as keyof typeof STELLA_COLORS]?.hex ||
                                  '#ffd700'
                                }
                              />
                            </div>
                            <div className="inventory-supernova-info">
                              <span className="inventory-supernova-name">
                                <Icon name="Check" size={14} className="inventory-check-icon" />
                                {supernova.name}
                              </span>
                              {supernova.description !== supernova.name && (
                                <span className="inventory-supernova-desc">{supernova.description}</span>
                              )}
                              <span className="inventory-supernova-date">
                                {new Date(supernova.unlocked_at * 1000).toLocaleDateString()}
                              </span>
                              {hasReward && (
                                <div className="inventory-supernova-reward-inline">
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
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Wordrot Tab Content */}
      {activeTab === 'wordrot' && (
        <div className="inventory-wordrot-tab">
          {wordrotLoading ? (
            <div className="inventory-loading">
              <Loading />
            </div>
          ) : (
            <>
              {/* Harvest words - collected from posts */}
              {(() => {
                const harvestWords = wordrotInventory.filter((item) => item.source === 'harvest')
                const synthesizedWords = wordrotInventory.filter((item) => item.source === 'synthesis')
                return (
                  <>
                    <div className="inventory-words-section">
                      <h3>Words ({harvestWords.length})</h3>

                      {harvestWords.length === 0 ? (
                        <div className="inventory-words-empty">
                          <p>No Words collected yet.</p>
                          <p className="inventory-words-hint">Click on highlighted words in posts to collect them!</p>
                        </div>
                      ) : (
                        <div className="inventory-words-grid">
                          {harvestWords.map((item) => (
                            <WordCard
                              key={item.word.id}
                              word={item.word}
                              source="harvest"
                              onClick={() => handleWordSelect(item.word)}
                              selected={
                                item.word.text === slotA || item.word.text === slotB || item.word.text === slotC
                              }
                              highlight={highlightWord?.toLowerCase() === item.word.text.toLowerCase()}
                              onRetryImage={retryWordImage}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Synthesis bar - bottom sticky */}
                    <SynthesisPanel
                      inventory={wordrotInventory}
                      synthesis={synthesis}
                      activeSlot={activeSlot}
                      onSlotTap={handleSlotTap}
                      onClear={() => setActiveSlot('A')}
                      onSynthesisComplete={(result) => {
                        // Check if user already had this word before synthesis
                        const hadBefore = wordrotInventory.some((item) => item.word.id === result.result.id)

                        // Reload inventory
                        loadWordrotInventory()

                        // Show celebration with corrected isNewWord flag
                        setSynthesisCelebration({
                          ...result,
                          isNewWord: !hadBefore, // True only if user didn't have it before
                        })
                        setShowSynthesisCelebration(true)
                      }}
                      onResultClick={(result) => {
                        // When clicking result slot, always show as not new (since they have it now)
                        setSynthesisCelebration({
                          ...result,
                          isNewWord: false,
                        })
                        setShowSynthesisCelebration(true)
                      }}
                    />

                    {/* Synthesized words - created from synthesis */}
                    {synthesizedWords.length > 0 && (
                      <div className="inventory-words-section inventory-synthesized-section">
                        <h3>
                          <Icon name="FlaskConical" size={20} fill="#10b981" /> Wordrot ({synthesizedWords.length})
                        </h3>
                        <div className="inventory-words-grid">
                          {synthesizedWords.map((item) => (
                            <WordCard
                              key={item.word.id}
                              word={item.word}
                              source="synthesis"
                              onClick={() => {
                                setSynthesisCelebration({
                                  result: item.word,
                                  isNewSynthesis: false,
                                  isNewWord: false,
                                  formula: '',
                                })
                                setShowSynthesisCelebration(true)
                              }}
                              selected={false}
                              onRetryImage={retryWordImage}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* Synthesis celebration modal */}
      {synthesisCelebration && (
        <WordSynthesisCelebration
          word={synthesisCelebration.result}
          isNewWord={synthesisCelebration.isNewWord}
          isNewRecipe={synthesisCelebration.isNewSynthesis}
          isVisible={showSynthesisCelebration}
          onClose={() => setShowSynthesisCelebration(false)}
        />
      )}
    </div>
  )
}
