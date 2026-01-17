import { useMyStats } from '../../hooks/useMyStats'
import { Icon } from '../ui'
import { formatNumber } from '../../lib/utils'
import '../../styles/components/my-stats-widget.css'

export function MyStatsWidget() {
  const { stats, loading, visible } = useMyStats()

  if (!visible || loading) return null

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
    </div>
  )
}
