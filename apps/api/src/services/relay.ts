import { SimplePool } from 'nostr-tools/pool'
import type { Event, Filter } from 'nostr-tools'

export type RelayQueryResult<T> = {
  events: T[]
  cleanup: () => void
}

// SimplePool を使ってクエリを実行し、結果とクリーンアップ関数を返す
export async function queryRelays(filter: Filter, relays: string[]): Promise<Event[]> {
  if (relays.length === 0) {
    return []
  }
  const pool = new SimplePool()
  try {
    const events = await pool.querySync(relays, filter)
    return events
  } finally {
    pool.close(relays)
  }
}

// 複数のクエリを並行実行
export async function queryRelaysMultiple(filters: Filter[], relays: string[]): Promise<Event[][]> {
  if (relays.length === 0) {
    return filters.map(() => [])
  }
  const pool = new SimplePool()
  try {
    const results = await Promise.all(filters.map((filter) => pool.querySync(relays, filter)))
    return results
  } finally {
    pool.close(relays)
  }
}

// イベントを発行
export async function publishToRelays(
  event: Event,
  relays: string[]
): Promise<{
  success: boolean
  successCount: number
  details: Array<{ relay: string; success: boolean; error: string | null }>
}> {
  if (relays.length === 0) {
    return {
      success: false,
      successCount: 0,
      details: [],
    }
  }
  const pool = new SimplePool()
  try {
    const publishResults = pool.publish(relays, event)
    const results = await Promise.allSettled(publishResults)

    const details = results.map((r, i) => ({
      relay: relays[i],
      success: r.status === 'fulfilled',
      error: r.status === 'rejected' ? String(r.reason) : null,
    }))

    const successCount = details.filter((r) => r.success).length

    return {
      success: successCount > 0,
      successCount,
      details,
    }
  } finally {
    pool.close(relays)
  }
}
