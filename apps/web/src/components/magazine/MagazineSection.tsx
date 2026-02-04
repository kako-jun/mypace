import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../ui'
import { MagazineCard } from './MagazineCard'
import { MagazineEditor } from './MagazineEditor'
import { fetchUserMagazines, publishEvent } from '../../lib/nostr/relay'
import { createMagazineEvent, type MagazineInput } from '../../lib/nostr/events'
import { navigateTo } from '../../lib/utils'
import { nip19 } from 'nostr-tools'
import type { Magazine } from '../../types'
import '../../styles/components/magazine.css'

interface MagazineSectionProps {
  pubkey: string
  isOwnProfile: boolean
}

export function MagazineSection({ pubkey, isOwnProfile }: MagazineSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [magazines, setMagazines] = useState<Magazine[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)

  // Handle createMagazine query parameter
  useEffect(() => {
    if (isOwnProfile && searchParams.get('createMagazine') === 'true') {
      setShowEditor(true)
      searchParams.delete('createMagazine')
      setSearchParams(searchParams, { replace: true })
    }
  }, [isOwnProfile, searchParams, setSearchParams])

  const loadMagazines = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchUserMagazines(pubkey)
      setMagazines(result)
    } catch (err) {
      console.error('Failed to load magazines:', err)
    } finally {
      setLoading(false)
    }
  }, [pubkey])

  useEffect(() => {
    loadMagazines()
  }, [loadMagazines])

  const handleMagazineClick = (magazine: Magazine) => {
    let npub: string
    try {
      npub = nip19.npubEncode(pubkey)
    } catch {
      npub = pubkey
    }
    navigateTo(`/user/${npub}/magazine/${magazine.slug}`)
  }

  const handleCreateMagazine = async (input: MagazineInput) => {
    try {
      const event = await createMagazineEvent(input)
      await publishEvent(event)
      setShowEditor(false)
      await loadMagazines()
    } catch (err) {
      console.error('Failed to create magazine:', err)
    }
  }

  // Don't show section if not own profile and no magazines
  if (!isOwnProfile && magazines.length === 0 && !loading) {
    return null
  }

  return (
    <div className="magazine-section">
      <div className="magazine-section-header">
        <div className="magazine-section-label">
          <Icon name="BookOpen" size={14} /> Magazines
        </div>
      </div>

      <div className="magazine-section-content">
        {loading ? (
          <div className="magazine-loading">Loading...</div>
        ) : (
          <div className="magazine-scroll">
            {magazines.map((magazine) => (
              <MagazineCard key={magazine.id} magazine={magazine} onClick={() => handleMagazineClick(magazine)} />
            ))}
            {isOwnProfile && (
              <button className="magazine-add-btn" onClick={() => setShowEditor(true)} type="button">
                <Icon name="Plus" size={20} />
                <span>Create</span>
              </button>
            )}
            {!isOwnProfile && magazines.length === 0 && <div className="magazine-empty">No magazines</div>}
          </div>
        )}
      </div>

      {showEditor && <MagazineEditor onSave={handleCreateMagazine} onClose={() => setShowEditor(false)} />}
    </div>
  )
}
