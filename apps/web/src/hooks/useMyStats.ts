import { useState, useEffect, useCallback } from 'react'
import { getStoredSecretKey, getPublicKeyFromSecret } from '../lib/nostr/keys'
import { fetchUserProfile } from '../lib/nostr/relay'
import { fetchUserStats, type StellaByColor } from '../lib/api'

interface MyStats {
  postsCount: number | null
  stellaCount: number | null
  stellaByColor: StellaByColor | null
  givenStellaCount: number | null
  givenStellaByColor: StellaByColor | null
  viewsCount: { details: number; impressions: number } | null
}

interface UseMyStatsResult {
  stats: MyStats | null
  loading: boolean
  visible: boolean
}

export function useMyStats(): UseMyStatsResult {
  const [stats, setStats] = useState<MyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)

  // Get pubkey from stored secret key
  useEffect(() => {
    const sk = getStoredSecretKey()
    if (sk) {
      const pk = getPublicKeyFromSecret(sk)
      setPubkey(pk)
    } else {
      setLoading(false)
      setVisible(false)
    }
  }, [])

  // Check if profile has username set
  const checkProfileAndFetchStats = useCallback(async () => {
    if (!pubkey) return

    try {
      // First check if user has set their profile name
      const profile = await fetchUserProfile(pubkey)
      const hasUsername = !!(profile?.name || profile?.display_name)

      if (!hasUsername) {
        setVisible(false)
        setLoading(false)
        return
      }

      setVisible(true)

      // Fetch all stats in one call
      const userStats = await fetchUserStats(pubkey)

      if (userStats) {
        setStats({
          postsCount: userStats.postsCount,
          stellaCount: userStats.stellaCount,
          stellaByColor: userStats.stellaByColor,
          givenStellaCount: userStats.givenStellaCount,
          givenStellaByColor: userStats.givenStellaByColor,
          viewsCount: userStats.viewsCount,
        })
      }
    } catch (error) {
      console.error('Failed to fetch my stats:', error)
    } finally {
      setLoading(false)
    }
  }, [pubkey])

  // Initial fetch only (no periodic refresh - stats don't need real-time updates)
  useEffect(() => {
    if (!pubkey) return
    checkProfileAndFetchStats()
  }, [pubkey, checkProfileAndFetchStats])

  return { stats, loading, visible }
}
