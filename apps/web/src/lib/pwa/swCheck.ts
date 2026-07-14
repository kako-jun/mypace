// PWA Service Worker 更新チェック完了を待つための仕組み（Agasteer方式の移植）。
//
// 起動直後にNostrリレーへの初回タイムライン取得を始めてしまうと、
// 直後にSW更新でリロードされた場合にその問い合わせが無駄になる。
// このモジュールは「SW登録→update()→onNeedRefresh発火猶予」を待つ
// Promise（waitForSwCheck）を提供し、初回フェッチ側（useTimeline）が
// これをawaitしてから重い呼び出し（Nostrリレーへの問い合わせ）を行う。
//
// 実際の registerSW() 呼び出しと onNeedRefresh の overlay/cooldown ロジックは
// main.tsx が担う。このモジュールは DOM に触れないため、テスト側から
// import しても副作用（mount 等）が発生しない。

export interface SwCheckWaiterOptions {
  /** update() 成功後、onNeedRefresh 発火を待つ猶予（ms） */
  refreshGraceMs?: number
  /** SW登録自体が完了しない場合に諦めるまでの絶対タイムアウト（ms） */
  timeoutMs?: number
}

export interface SwCheckWaiterHandle {
  /** SW更新チェックの完了（または断念）を表すPromise */
  promise: Promise<void>
  /** swRegistration.update() が成功した時に呼ぶ */
  onUpdateSucceeded: () => void
  /** update() が失敗した時、またはSW未対応環境の時に呼ぶ */
  onUpdateSkipped: () => void
}

export function createSwCheckWaiter(options: SwCheckWaiterOptions = {}): SwCheckWaiterHandle {
  const { refreshGraceMs = 500, timeoutMs = 2000 } = options

  let resolved = false
  let resolvePromise: () => void
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  const safeResolve = () => {
    if (resolved) return
    resolved = true
    resolvePromise()
  }

  const onUpdateSucceeded = () => {
    // 更新チェック完了後、onNeedRefreshが呼ばれる猶予を与える
    setTimeout(safeResolve, refreshGraceMs)
  }

  const onUpdateSkipped = () => {
    safeResolve()
  }

  // SWがサポートされていない環境や登録に時間がかかる場合のフォールバック
  setTimeout(safeResolve, timeoutMs)

  return { promise, onUpdateSucceeded, onUpdateSkipped }
}

// アプリ全体で共有する単一インスタンス。main.tsx の registerSW コールバックが
// onUpdateSucceeded / onUpdateSkipped を呼び分けて解決する。
const swCheckWaiter = createSwCheckWaiter()

/** main.tsx の onMount 相当（初回起動）でのみ待つべきPromise */
export const waitForSwCheck: Promise<void> = swCheckWaiter.promise
export const onSwUpdateSucceeded = swCheckWaiter.onUpdateSucceeded
export const onSwUpdateSkipped = swCheckWaiter.onUpdateSkipped

/**
 * SW更新チェック完了を待ってから fetcher を実行する。
 * mypace起動直後の初回タイムライン取得（useTimeline の loadTimeline）専用。
 * ポーリングによる2回目以降の取得（useTimelinePolling の checkNewEvents）は対象外。
 *
 * waitForSwCheck は一度解決すると解決済みのまま保持されるため、アプリ起動から
 * 十分時間が経った後に呼ばれた場合は実質的に待たされない。
 */
export async function awaitSwCheckThen<T>(
  fetcher: () => Promise<T>,
  swCheck: Promise<void> = waitForSwCheck
): Promise<T> {
  await swCheck
  return fetcher()
}
