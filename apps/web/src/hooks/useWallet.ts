import { useState, useCallback, useEffect } from 'react'

// WebLN types
interface WebLNProvider {
  enable: () => Promise<void>
  getBalance?: () => Promise<{ balance: number; currency?: string }>
  getInfo?: () => Promise<{ alias?: string; pubkey?: string }>
  sendPayment?: (paymentRequest: string) => Promise<{ preimage: string }>
}

declare global {
  interface Window {
    webln?: WebLNProvider
  }
}

interface WalletState {
  connected: boolean
  balance: number | null // in sats
  walletName: string | null
  loading: boolean
  error: string | null
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    balance: null,
    walletName: null,
    loading: false,
    error: null,
  })

  // Check if WebLN is available
  const hasWebLN = typeof window !== 'undefined' && !!window.webln

  // Connect to wallet
  const connect = useCallback(async () => {
    if (!window.webln) {
      setState((prev) => ({ ...prev, error: 'WebLN not found. Please install a WebLN-compatible extension.' }))
      return false
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      await window.webln.enable()

      // Get wallet info if available
      let walletName: string | null = null
      if (window.webln.getInfo) {
        try {
          const info = await window.webln.getInfo()
          walletName = info.alias || 'Lightning Wallet'
        } catch {
          walletName = 'Lightning Wallet'
        }
      }

      // Get balance if available
      let balance: number | null = null
      if (window.webln.getBalance) {
        try {
          const balanceResponse = await window.webln.getBalance()
          balance = balanceResponse.balance
        } catch {
          // Balance API might not be supported by all wallets
          balance = null
        }
      }

      setState({
        connected: true,
        balance,
        walletName,
        loading: false,
        error: null,
      })

      return true
    } catch (error) {
      setState({
        connected: false,
        balance: null,
        walletName: null,
        loading: false,
        error: error instanceof Error ? error.message : '接続に失敗しました',
      })
      return false
    }
  }, [])

  // Disconnect (just reset state, WebLN doesn't have explicit disconnect)
  const disconnect = useCallback(() => {
    setState({
      connected: false,
      balance: null,
      walletName: null,
      loading: false,
      error: null,
    })
  }, [])

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!window.webln || !state.connected) return

    if (window.webln.getBalance) {
      try {
        const balanceResponse = await window.webln.getBalance()
        setState((prev) => ({ ...prev, balance: balanceResponse.balance }))
      } catch {
        // Ignore errors on refresh
      }
    }
  }, [state.connected])

  // Auto-check for existing connection on mount
  useEffect(() => {
    // Some wallets auto-connect, we could try to detect that here
    // For now, we require explicit connection
  }, [])

  return {
    ...state,
    hasWebLN,
    connect,
    disconnect,
    refreshBalance,
  }
}
