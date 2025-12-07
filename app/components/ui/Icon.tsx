import { icons } from 'lucide'

interface IconProps {
  name: keyof typeof icons
  size?: number
  fill?: string
  class?: string
}

export default function Icon({ name, size = 16, fill = 'none', class: className }: IconProps) {
  const icon = icons[name]
  if (!icon) return null

  const svgChildren = icon
    .map((child: [string, Record<string, string>]) => {
      const [tag, attrs] = child
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${attrStr} />`
    })
    .join('')

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
      dangerouslySetInnerHTML={{ __html: svgChildren }}
    />
  )
}
