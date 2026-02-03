import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon, CloseButton } from '../ui'
import { splitContentForSns, getCharLimit } from '../../lib/utils/sns-share'

export type ShareOption = 'url' | 'md-copy' | 'md-download' | 'md-open' | 'x' | 'bluesky' | 'threads'
export type SnsType = 'x' | 'bluesky' | 'threads'

type SubMenu = 'content' | 'sns' | SnsType | null

interface ShareMenuProps {
  position: { top: number; left: number }
  content: string
  tags: string[][]
  url: string
  onSelect: (option: ShareOption, partIndex?: number) => void
  onClose: (e?: React.MouseEvent) => void
}

export default function ShareMenu({ position, content, tags, url, onSelect, onClose }: ShareMenuProps) {
  const [subMenu, setSubMenu] = useState<SubMenu>(null)

  // 各SNSの分割パーツを計算
  const splitParts = useMemo(() => {
    return {
      x: splitContentForSns(content, tags, url, getCharLimit('x'), 'x'),
      bluesky: splitContentForSns(content, tags, url, getCharLimit('bluesky'), 'bluesky'),
      threads: splitContentForSns(content, tags, url, getCharLimit('threads'), 'threads'),
    }
  }, [content, tags, url])

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
        <button className="share-menu-option" onClick={handleShowSubMenu('sns')}>
          <Icon name="Send" size={16} />
          <span>Share to SNS</span>
          <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
        </button>
        <button className="share-menu-option" onClick={handleSelect('url')}>
          <Icon name="Link" size={16} />
          <span>Share URL</span>
        </button>
        <button className="share-menu-option" onClick={handleShowSubMenu('content')}>
          <Icon name="FileText" size={16} />
          <span>Share Content</span>
          <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
        </button>
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
          <span className="share-menu-x-icon">𝕏</span>
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
        {subMenu === 'content' && renderContentMenu()}
      </div>
    </>,
    document.body
  )
}
