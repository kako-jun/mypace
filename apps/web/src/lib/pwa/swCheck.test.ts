import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSwCheckWaiter, awaitSwCheckThen } from './swCheck'

describe('createSwCheckWaiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('onUpdateSucceeded: refreshGraceMs 経過前は resolve しない', async () => {
    const { promise, onUpdateSucceeded } = createSwCheckWaiter({ refreshGraceMs: 500, timeoutMs: 5000 })
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    onUpdateSucceeded()
    await vi.advanceTimersByTimeAsync(499)
    expect(resolved).toBe(false)
  })

  it('onUpdateSucceeded: refreshGraceMs 経過後に resolve する', async () => {
    const { promise, onUpdateSucceeded } = createSwCheckWaiter({ refreshGraceMs: 500, timeoutMs: 5000 })
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    onUpdateSucceeded()
    await vi.advanceTimersByTimeAsync(500)
    expect(resolved).toBe(true)
  })

  it('onUpdateSkipped: update()失敗・SW未対応時は即座に resolve する', async () => {
    const { promise, onUpdateSkipped } = createSwCheckWaiter({ refreshGraceMs: 500, timeoutMs: 5000 })
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    onUpdateSkipped()
    await vi.advanceTimersByTimeAsync(0)
    expect(resolved).toBe(true)
  })

  it('タイムアウト: 何も呼ばれなくても timeoutMs 経過後に resolve する', async () => {
    const { promise } = createSwCheckWaiter({ refreshGraceMs: 500, timeoutMs: 2000 })
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(1999)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  it('二重解決しても例外を投げず、Promiseは1回だけ解決される', async () => {
    const { promise, onUpdateSucceeded, onUpdateSkipped } = createSwCheckWaiter({
      refreshGraceMs: 500,
      timeoutMs: 5000,
    })
    let resolveCount = 0
    promise.then(() => {
      resolveCount++
    })

    expect(() => {
      onUpdateSkipped()
      onUpdateSucceeded()
    }).not.toThrow()

    await vi.advanceTimersByTimeAsync(1000)
    expect(resolveCount).toBe(1)
  })
})

describe('awaitSwCheckThen', () => {
  it('渡したPromiseが解決するまでfetcherを呼ばない', async () => {
    let resolveGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve
    })
    const fetcher = vi.fn().mockResolvedValue('result')

    const resultPromise = awaitSwCheckThen(fetcher, gate)
    // マイクロタスクを1周させても、gateが未解決ならfetcherは呼ばれない
    await Promise.resolve()
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()

    resolveGate()
    const result = await resultPromise
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result).toBe('result')
  })

  it('gateが既に解決済みならfetcherを実行して結果を返す', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const result = await awaitSwCheckThen(fetcher, Promise.resolve())
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result).toBe('ok')
  })

  it('fetcherが失敗した場合はそのエラーを伝播する', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('fetch failed'))
    await expect(awaitSwCheckThen(fetcher, Promise.resolve())).rejects.toThrow('fetch failed')
  })
})
