import { icons } from 'lucide'

interface IconProps {
  name: keyof typeof icons
  size?: number
  fill?: string
  class?: string
}

// Render SVG child element as JSX
function renderSvgChild(child: [string, Record<string, string>], index: number) {
  const [tag, attrs] = child
  const props: Record<string, string> = { key: String(index) }
  for (const [k, v] of Object.entries(attrs)) {
    props[k] = v
  }

  switch (tag) {
    case 'circle':
      return <circle {...props} />
    case 'path':
      return <path {...props} />
    case 'line':
      return <line {...props} />
    case 'polyline':
      return <polyline {...props} />
    case 'polygon':
      return <polygon {...props} />
    case 'rect':
      return <rect {...props} />
    case 'ellipse':
      return <ellipse {...props} />
    default:
      return null
  }
}

export default function Icon({ name, size = 16, fill = 'none', class: className }: IconProps) {
  const icon = icons[name]
  if (!icon) return null

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {icon.map((child: [string, Record<string, string>], i: number) => renderSvgChild(child, i))}
    </svg>
  )
}
