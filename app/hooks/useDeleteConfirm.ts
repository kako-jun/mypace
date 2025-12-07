import { useState } from 'hono/jsx'

interface UseDeleteConfirmResult {
  confirmId: string | null
  showConfirm: (id: string) => void
  hideConfirm: () => void
  isConfirming: (id: string) => boolean
}

export function useDeleteConfirm(): UseDeleteConfirmResult {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return {
    confirmId,
    showConfirm: (id: string) => setConfirmId(id),
    hideConfirm: () => setConfirmId(null),
    isConfirming: (id: string) => confirmId === id,
  }
}
