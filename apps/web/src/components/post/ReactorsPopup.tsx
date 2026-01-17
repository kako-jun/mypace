import { createPortal } from 'react-dom'
import { Icon, CloseButton } from '../ui'
import { formatNumber } from '../../lib/utils'

interface Reactor {
  pubkey: string
  stella: number
}

interface ReactorsPopupProps {
  reactors: Reactor[]
  position: { top: number; left: number }
  myPubkey: string | null
  getDisplayName: (pubkey: string) => string
  onNavigateToProfile: (pubkey: string) => void
  onRemove: () => void
  onClose: (e?: React.MouseEvent) => void
}

export default function ReactorsPopup({
  reactors,
  position,
  myPubkey,
  getDisplayName,
  onNavigateToProfile,
  onRemove,
  onClose,
}: ReactorsPopupProps) {
  return createPortal(
    <>
      <div className="reactors-popup-overlay" onClick={onClose} />
      <div
        className="reactors-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reactors-popup-header">
          <span className="reactors-popup-title">Stella</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>
        <div className="reactors-list">
          {reactors.map((reactor) => (
            <div key={reactor.pubkey} className="reactor-item">
              <span className="reactor-name" onClick={() => onNavigateToProfile(reactor.pubkey)}>
                {getDisplayName(reactor.pubkey)}
              </span>
              <span className="reactor-stella">
                <Icon name="Star" size={14} fill="#f1c40f" />
                {formatNumber(reactor.stella)}
              </span>
              {reactor.pubkey === myPubkey && (
                <button className="reactor-remove" onClick={onRemove}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
