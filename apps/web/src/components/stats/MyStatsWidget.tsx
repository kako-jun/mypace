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
  const givenStellaByColor = stats?.givenStellaByColor
  const hasGivenColoredStella =
    givenStellaByColor && STELLA_COLORS.some((c) => c.key !== 'yellow' && givenStellaByColor[c.key] > 0)

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
          <Icon name="ArrowDown" size={12} className="stella-direction" />
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
          <Icon name="ArrowDown" size={14} className="stella-direction" />
          <Icon name="Star" size={14} fill="#f1c40f" /> {formatNumber(stats?.stellaCount)}
        </span>
      )}
      {hasGivenColoredStella ? (
        <span className="stella-colors-row">
          <Icon name="ArrowUp" size={12} className="stella-direction" />
          {STELLA_COLORS.map(
            ({ key, fill }) =>
              givenStellaByColor[key] > 0 && (
                <span key={key} className="stella-color-item">
                  <Icon name="Star" size={12} fill={fill} />
                  <span className="stella-color-count">{formatNumber(givenStellaByColor[key])}</span>
                </span>
              )
          )}
        </span>
      ) : (
        <span>
          <Icon name="ArrowUp" size={14} className="stella-direction" />
          <Icon name="Star" size={14} fill="#f1c40f" /> {formatNumber(stats?.givenStellaCount)}
        </span>
      )}
      <span id="inv-button">
        <TextButton className="my-stats-inventory-btn" onClick={handleInventoryClick}>
          INV
        </TextButton>
      </span>
    </div>
  )
}
