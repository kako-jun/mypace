import { createPortal } from 'react-dom'
import { useMyStats } from '../../hooks/useMyStats'
import { Icon } from '../ui'
import '../../styles/components/my-stats-widget.css'

export function MyStatsWidget() {
  const { stats, loading, visible } = useMyStats()

  if (!visible || loading) return null

  const widget = (
    <div className="my-stats-widget">
      <span>{stats?.postsCount !== null ? stats?.postsCount : '...'} posts</span>
      <span>
        <Icon name="BarChart2" size={14} />{' '}
        {stats?.viewsCount !== null ? `${stats?.viewsCount.details} / ${stats?.viewsCount.impressions}` : '...'}
      </span>
      <span>
        <Icon name="Star" size={14} fill="#f1c40f" /> {stats?.stellaCount !== null ? stats?.stellaCount : '...'}
      </span>
    </div>
  )

  // Render to body to ensure correct z-index stacking
  return createPortal(widget, document.body)
}
