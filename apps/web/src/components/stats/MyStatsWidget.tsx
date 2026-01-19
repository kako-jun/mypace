import { useNavigate } from 'react-router-dom'
import { useMyStats } from '../../hooks/useMyStats'
import { Icon, TextButton } from '../ui'
import { formatNumber } from '../../lib/utils'
import '../../styles/components/my-stats-widget.css'

// Stella colors matching the picker
const STELLA_COLORS: Array<{ key: 'yellow' | 'green' | 'red' | 'blue' | 'purple'; fill: string }> = [
  { key: 'yellow', fill: '#f1c40f' },
  { key: 'green', fill: '#2ecc71' },
  { key: 'red', fill: '#e74c3c' },
  { key: 'blue', fill: '#3498db' },
  { key: 'purple', fill: '#9b59b6' },
]

export function MyStatsWidget() {
  const navigate = useNavigate()
  const { stats, loading, visible } = useMyStats()

  if (!visible || loading) return null

  const handleInventoryClick = () => {
    navigate('/inventory')
  }

  // Get colored stella counts (only show colors with count > 0)
  const stellaByColor = stats?.stellaByColor
  const hasColoredStella = stellaByColor && STELLA_COLORS.some((c) => c.key !== 'yellow' && stellaByColor[c.key] > 0)

  return (
    <div className="my-stats-widget">
      <span>{formatNumber(stats?.postsCount)} posts</span>
      <span>
        <Icon name="BarChart2" size={14} />{' '}
        {stats?.viewsCount !== null
          ? `${formatNumber(stats?.viewsCount.details)} / ${formatNumber(stats?.viewsCount.impressions)}`
          : '...'}
      </span>
      {hasColoredStella ? (
        <span className="stella-colors-row">
          {STELLA_COLORS.map(
            ({ key, fill }) =>
              stellaByColor[key] > 0 && (
                <span key={key} className="stella-color-item">
                  <Icon name="Star" size={12} fill={fill} />
                  <span className="stella-color-count">{formatNumber(stellaByColor[key])}</span>
                </span>
              )
          )}
        </span>
      ) : (
        <span>
          <Icon name="Star" size={14} fill="#f1c40f" /> {formatNumber(stats?.stellaCount)}
        </span>
      )}
      <TextButton className="my-stats-inventory-btn" onClick={handleInventoryClick}>
        INV
      </TextButton>
    </div>
  )
}
