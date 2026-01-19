import { useNavigate } from 'react-router-dom'
import { useMyStats } from '../../hooks/useMyStats'
import { Icon } from '../ui'
import { formatNumber } from '../../lib/utils'
import '../../styles/components/my-stats-widget.css'

export function MyStatsWidget() {
  const navigate = useNavigate()
  const { stats, loading, visible } = useMyStats()

  if (!visible || loading) return null

  const handleInventoryClick = () => {
    navigate('/inventory')
  }

  return (
    <div className="my-stats-widget">
      <span>{formatNumber(stats?.postsCount)} posts</span>
      <span>
        <Icon name="BarChart2" size={14} />{' '}
        {stats?.viewsCount !== null
          ? `${formatNumber(stats?.viewsCount.details)} / ${formatNumber(stats?.viewsCount.impressions)}`
          : '...'}
      </span>
      <span>
        <Icon name="Star" size={14} fill="#f1c40f" /> {formatNumber(stats?.stellaCount)}
      </span>
      <button className="my-stats-inventory-btn" onClick={handleInventoryClick} title="インベントリを開く">
        <Icon name="Backpack" size={14} />
      </button>
    </div>
  )
}
