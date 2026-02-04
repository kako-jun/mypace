import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { nip19 } from 'nostr-tools'
import { Icon, CloseButton } from '../ui'
import { splitContentForSns, getCharLimit } from '../../lib/utils/sns-share'
import { fetchUserMagazines, publishEvent } from '../../lib/nostr/relay'
import { createMagazineEvent, getCurrentPubkey } from '../../lib/nostr/events'
import { navigateTo } from '../../lib/utils'
import type { Magazine } from '../../types'

export type ShareOption = 'url-copy' | 'url-share' | 'md-copy' | 'md-download' | 'md-open' | 'x' | 'bluesky' | 'threads'
export type SnsType = 'x' | 'bluesky' | 'threads'

type SubMenu = 'content' | 'sns' | 'url' | 'magazine' | SnsType | null

interface ShareMenuProps {
  position: { top: number; left: number }
  content: string
  tags: string[][]
  url: string
  isMyPost: boolean
  eventId?: string
  onSelect: (option: ShareOption, partIndex?: number) => void
  onClose: (e?: React.MouseEvent) => void
}

export default function ShareMenu({
  position,
  content,
  tags,
  url,
  isMyPost,
  eventId,
  onSelect,
  onClose,
}: ShareMenuProps) {
  const [subMenu, setSubMenu] = useState<SubMenu>(null)
  const [magazines, setMagazines] = useState<Magazine[]>([])
  const [magazinesLoading, setMagazinesLoading] = useState(false)
  const [updatingMagazine, setUpdatingMagazine] = useState<string | null>(null)

  // 各SNSの分割パーツを計算
  const splitParts = useMemo(() => {
    return {
      x: splitContentForSns(content, tags, url, getCharLimit('x'), 'x'),
      bluesky: splitContentForSns(content, tags, url, getCharLimit('bluesky'), 'bluesky'),
      threads: splitContentForSns(content, tags, url, getCharLimit('threads'), 'threads'),
    }
  }, [content, tags, url])

  const loadMagazines = useCallback(async () => {
    if (!isMyPost || !eventId) return
    setMagazinesLoading(true)
    try {
      const pubkey = await getCurrentPubkey()
      const result = await fetchUserMagazines(pubkey)
      setMagazines(result)
    } catch (err) {
      console.error('Failed to load magazines:', err)
    } finally {
      setMagazinesLoading(false)
    }
  }, [isMyPost, eventId])

  useEffect(() => {
    if (subMenu === 'magazine') {
      loadMagazines()
    }
  }, [subMenu, loadMagazines])

  const handleToggleMagazine = async (magazine: Magazine) => {
    if (!eventId) return
    setUpdatingMagazine(magazine.id)

    try {
      const isInMagazine = magazine.eventIds.includes(eventId)
      const newEventIds = isInMagazine
        ? magazine.eventIds.filter((id) => id !== eventId)
        : [...magazine.eventIds, eventId]

      const event = await createMagazineEvent({
        slug: magazine.slug,
        title: magazine.title,
        description: magazine.description,
        image: magazine.image,
        eventIds: newEventIds,
      })
      await publishEvent(event)

      // Update local state
      setMagazines((prev) =>
        prev.map((m) => (m.id === magazine.id ? { ...m, eventIds: newEventIds, id: event.id } : m))
      )
    } catch (err) {
      console.error('Failed to update magazine:', err)
    } finally {
      setUpdatingMagazine(null)
    }
  }

  const handleSelect = (option: ShareOption, partIndex?: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(option, partIndex)
  }

  const handleSnsClick = (sns: SnsType) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const parts = splitParts[sns]
    if (parts.length <= 1) {
      // 分割不要 - 直接共有
      onSelect(sns)
    } else {
      // 分割が必要 - サブメニューを表示
      setSubMenu(sns)
    }
  }

  const handleShowSubMenu = (menu: SubMenu) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setSubMenu(menu)
  }

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation()
    // SNS分割メニューからはSNSメニューに戻る
    if (subMenu === 'x' || subMenu === 'bluesky' || subMenu === 'threads') {
      setSubMenu('sns')
    } else {
      setSubMenu(null)
    }
  }

  const renderMainMenu = () => (
    <>
      <div className="share-menu-header">
        <span className="share-menu-title">Share</span>
        <CloseButton onClick={() => onClose()} size={16} />
      </div>
      <div className="share-menu-options">
        {isMyPost && (
          <button className="share-menu-option" onClick={handleShowSubMenu('sns')}>
            <Icon name="Send" size={16} />
            <span>Share to SNS</span>
            <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
          </button>
        )}
        <button className="share-menu-option" onClick={handleShowSubMenu('url')}>
          <Icon name="Link" size={16} />
          <span>Share URL</span>
          <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
        </button>
        <button className="share-menu-option" onClick={handleShowSubMenu('content')}>
          <Icon name="FileText" size={16} />
          <span>Share Content</span>
          <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
        </button>
        {isMyPost && eventId && (
          <>
            <div className="share-menu-divider" />
            <button className="share-menu-option" onClick={handleShowSubMenu('magazine')}>
              <Icon name="BookOpen" size={16} />
              <span>Add to Magazine</span>
              <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
            </button>
          </>
        )}
      </div>
    </>
  )

  const renderSnsMenu = () => (
    <>
      <div className="share-menu-header">
        <button className="share-menu-back" onClick={handleBack}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        <span className="share-menu-title">SNS</span>
        <CloseButton onClick={() => onClose()} size={16} />
      </div>
      <div className="share-menu-options">
        <button className="share-menu-option" onClick={handleSnsClick('x')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="share-menu-x-icon">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>X</span>
          {splitParts.x.length > 1 && <span className="share-menu-badge">{splitParts.x.length}</span>}
          {splitParts.x.length > 1 && <Icon name="ChevronRight" size={16} className="share-menu-arrow" />}
        </button>
        <button className="share-menu-option" onClick={handleSnsClick('bluesky')}>
          <Icon name="Cloud" size={16} />
          <span>Bluesky</span>
          {splitParts.bluesky.length > 1 && <span className="share-menu-badge">{splitParts.bluesky.length}</span>}
          {splitParts.bluesky.length > 1 && <Icon name="ChevronRight" size={16} className="share-menu-arrow" />}
        </button>
        <button className="share-menu-option" onClick={handleSnsClick('threads')}>
          <Icon name="AtSign" size={16} />
          <span>Threads</span>
          {splitParts.threads.length > 1 && <span className="share-menu-badge">{splitParts.threads.length}</span>}
          {splitParts.threads.length > 1 && <Icon name="ChevronRight" size={16} className="share-menu-arrow" />}
        </button>
      </div>
    </>
  )

  const renderSnsSplitMenu = (sns: SnsType) => {
    const parts = splitParts[sns]
    const snsName = sns === 'x' ? 'X' : sns === 'bluesky' ? 'Bluesky' : 'Threads'
    const total = parts.length

    return (
      <>
        <div className="share-menu-header">
          <button className="share-menu-back" onClick={handleBack}>
            <Icon name="ChevronLeft" size={16} />
          </button>
          <span className="share-menu-title">{snsName}</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>
        <div className="share-menu-options">
          {/* 全文オプション */}
          <button className="share-menu-option" onClick={handleSelect(sns, -1)}>
            <Icon name="FileText" size={16} />
            <span>Full</span>
          </button>
          {/* 分割パーツ */}
          {parts.map((_, index) => (
            <button key={index} className="share-menu-option" onClick={handleSelect(sns, index)}>
              <Icon name="FileText" size={16} />
              <span>
                {index + 1}/{total}
              </span>
            </button>
          ))}
        </div>
      </>
    )
  }

  const renderUrlMenu = () => (
    <>
      <div className="share-menu-header">
        <button className="share-menu-back" onClick={handleBack}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        <span className="share-menu-title">URL</span>
        <CloseButton onClick={() => onClose()} size={16} />
      </div>
      <div className="share-menu-options">
        <button className="share-menu-option" onClick={handleSelect('url-copy')}>
          <Icon name="Clipboard" size={16} />
          <span>Copy URL</span>
        </button>
        <button className="share-menu-option" onClick={handleSelect('url-share')}>
          <Icon name="Share2" size={16} />
          <span>Share to Apps</span>
        </button>
      </div>
    </>
  )

  const renderContentMenu = () => (
    <>
      <div className="share-menu-header">
        <button className="share-menu-back" onClick={handleBack}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        <span className="share-menu-title">Content</span>
        <CloseButton onClick={() => onClose()} size={16} />
      </div>
      <div className="share-menu-options">
        <button className="share-menu-option" onClick={handleSelect('md-copy')}>
          <Icon name="Clipboard" size={16} />
          <span>Copy Markdown</span>
        </button>
        <button className="share-menu-option" onClick={handleSelect('md-open')}>
          <Icon name="ExternalLink" size={16} />
          <span>Open Markdown URL</span>
        </button>
        <button className="share-menu-option" onClick={handleSelect('md-download')}>
          <Icon name="Download" size={16} />
          <span>Download Markdown</span>
        </button>
      </div>
    </>
  )

  const renderMagazineMenu = () => (
    <>
      <div className="share-menu-header">
        <button className="share-menu-back" onClick={handleBack}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        <span className="share-menu-title">Magazine</span>
        <CloseButton onClick={() => onClose()} size={16} />
      </div>
      <div className="share-menu-options">
        {magazinesLoading ? (
          <div className="share-menu-loading">Loading...</div>
        ) : (
          <>
            {magazines.length > 0 && (
              <div className="magazine-select-list">
                {magazines.map((magazine) => {
                  const isInMagazine = eventId ? magazine.eventIds.includes(eventId) : false
                  const isUpdating = updatingMagazine === magazine.id
                  return (
                    <button
                      key={magazine.id}
                      className={`magazine-select-item ${isInMagazine ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleMagazine(magazine)
                      }}
                      disabled={isUpdating}
                    >
                      <div className={`magazine-select-checkbox ${isInMagazine ? 'checked' : ''}`}>
                        {isInMagazine && <Icon name="Check" size={12} />}
                      </div>
                      <span className="magazine-select-name">{magazine.title || 'Untitled'}</span>
                      <span className="magazine-select-count">{magazine.eventIds.length}</span>
                      {isUpdating && <Icon name="Loader" size={14} />}
                    </button>
                  )
                })}
              </div>
            )}
            {magazines.length > 0 && <div className="share-menu-divider" />}
            <button
              className="share-menu-option"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const pubkey = await getCurrentPubkey()
                  const npub = nip19.npubEncode(pubkey)
                  onClose()
                  navigateTo(`/user/${npub}?createMagazine=true`)
                } catch (err) {
                  console.error('Failed to navigate:', err)
                }
              }}
            >
              <Icon name="Plus" size={16} />
              <span>Create New Magazine</span>
            </button>
          </>
        )}
      </div>
    </>
  )

  return createPortal(
    <>
      <div className="share-menu-overlay" onClick={onClose} />
      <div
        className="share-menu"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {subMenu === null && renderMainMenu()}
        {subMenu === 'sns' && renderSnsMenu()}
        {subMenu === 'x' && renderSnsSplitMenu('x')}
        {subMenu === 'bluesky' && renderSnsSplitMenu('bluesky')}
        {subMenu === 'threads' && renderSnsSplitMenu('threads')}
        {subMenu === 'url' && renderUrlMenu()}
        {subMenu === 'content' && renderContentMenu()}
        {subMenu === 'magazine' && renderMagazineMenu()}
      </div>
    </>,
    document.body
  )
}
