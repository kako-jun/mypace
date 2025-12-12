import * as icons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

interface IconProps {
  name: string
  size?: number
  fill?: string
  strokeWidth?: number
  className?: string
}

export function Icon({ name, size = 16, fill = 'none', strokeWidth, className }: IconProps) {
  const LucideIcon = (icons as unknown as Record<string, LucideIcon>)[name]
  if (!LucideIcon) return null

  return <LucideIcon size={size} fill={fill} strokeWidth={strokeWidth} className={className} />
}

export default Icon
