import * as icons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

interface IconProps {
  name: string
  size?: number
  fill?: string
  className?: string
}

export function Icon({ name, size = 16, fill = 'none', className }: IconProps) {
  const LucideIcon = (icons as Record<string, LucideIcon>)[name]
  if (!LucideIcon) return null

  return <LucideIcon size={size} fill={fill} className={className} />
}

export default Icon
