import { useState } from 'react'
import type { WebsiteEntry } from '../types'

interface UseWebsiteEditorResult {
  websites: WebsiteEntry[]
  newUrl: string
  setNewUrl: (url: string) => void
  handleUrlChange: (index: number, url: string) => void
  addWebsite: () => void
  removeWebsite: (index: number) => void
  moveWebsite: (index: number, direction: 'up' | 'down') => void
  hasChanged: (initial: WebsiteEntry[]) => boolean
}

export function useWebsiteEditor(initialWebsites: WebsiteEntry[]): UseWebsiteEditorResult {
  const [websites, setWebsites] = useState<WebsiteEntry[]>(() =>
    initialWebsites.length > 0 ? initialWebsites : [{ url: '', label: '' }]
  )
  const [newUrl, setNewUrl] = useState('')

  const handleUrlChange = (index: number, url: string) => {
    const updated = [...websites]
    updated[index] = { url, label: '' }
    setWebsites(updated)
  }

  const addWebsite = () => {
    if (websites.length < 10 && newUrl.trim()) {
      setWebsites([...websites, { url: newUrl.trim(), label: '' }])
      setNewUrl('')
    }
  }

  const removeWebsite = (index: number) => {
    if (websites.length > 1) {
      setWebsites(websites.filter((_, i) => i !== index))
    } else {
      setWebsites([{ url: '', label: '' }])
    }
  }

  const moveWebsite = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= websites.length) return
    const updated = [...websites]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setWebsites(updated)
  }

  const hasChanged = (initial: WebsiteEntry[]): boolean => {
    const current = websites.filter((w) => w.url.trim())
    if (initial.length !== current.length) return true
    return current.some((w, i) => w.url !== initial[i]?.url || w.label !== initial[i]?.label)
  }

  return {
    websites,
    newUrl,
    setNewUrl,
    handleUrlChange,
    addWebsite,
    removeWebsite,
    moveWebsite,
    hasChanged,
  }
}
