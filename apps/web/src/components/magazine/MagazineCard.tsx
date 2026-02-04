import { Icon } from '../ui'
import type { Magazine } from '../../types'
import '../../styles/components/magazine.css'

interface MagazineCardProps {
  magazine: Magazine
  onClick?: () => void
}

export function MagazineCard({ magazine, onClick }: MagazineCardProps) {
  const postCount = magazine.eventIds.length

  return (
    <button className="magazine-card" onClick={onClick} type="button">
      <div className="magazine-card-image">
        {magazine.image ? (
          <img src={magazine.image} alt={magazine.title} />
        ) : (
          <div className="magazine-card-placeholder">
            <Icon name="BookOpen" size={24} />
          </div>
        )}
      </div>
      <div className="magazine-card-info">
        <div className="magazine-card-title">{magazine.title || 'Untitled'}</div>
        <div className="magazine-card-count">{postCount} posts</div>
      </div>
    </button>
  )
}
