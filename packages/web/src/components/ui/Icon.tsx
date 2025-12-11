import * as icons from 'lucide-react'

type IconName = keyof typeof icons

interface IconProps {
  name: IconName
  size?: number
  fill?: string
  className?: string
}

export function Icon({ name, size = 16, fill = 'none', className }: IconProps) {
  const LucideIcon = icons[name] as React.ComponentType<{ size?: number; fill?: string; className?: string }>
  if (!LucideIcon || typeof LucideIcon !== 'function') return null

  return <LucideIcon size={size} fill={fill} className={className} />
}

export default Icon
