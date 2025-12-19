import { SimplePool } from 'nostr-tools/pool'
import type { Event, Filter } from 'nostr-tools'
import { RELAYS } from '../constants'

export type RelayQueryResult<T> = {
  events: T[]
  cleanup: () => void
}

// SimplePool を使ってクエリを実行し、結果とクリーンアップ関数を返す
export async function queryRelays(filter: Filter): Promise<Event[]> {
  const pool = new SimplePool()
  try {
    const events = await pool.querySync(RELAYS, filter)
    return events
  } finally {
    pool.close(RELAYS)
  }
}

// 複数のクエリを並行実行
export async function queryRelaysMultiple(filters: Filter[]): Promise<Event[][]> {
  const pool = new SimplePool()
  try {
    const results = await Promise.all(filters.map((filter) => pool.querySync(RELAYS, filter)))
    return results
  } finally {
    pool.close(RELAYS)
  }
}

// イベントを発行
export async function publishToRelays(
  event: Event
): Promise<{
  success: boolean
  successCount: number
  details: Array<{ relay: string; success: boolean; error: string | null }>
}> {
  const pool = new SimplePool()
  try {
    const publishResults = pool.publish(RELAYS, event)
    const results = await Promise.allSettled(publishResults)

    const details = results.map((r, i) => ({
      relay: RELAYS[i],
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
    pool.close(RELAYS)
  }
}
