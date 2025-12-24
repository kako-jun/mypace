import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface PortalProps {
  children: ReactNode
}

/**
 * Renders children into document.body using React Portal.
 * Use this for modals/popups that need to escape ancestor stacking contexts
 * (e.g., when parent has backdrop-filter, transform, etc.)
 */
export default function Portal({ children }: PortalProps) {
  return createPortal(children, document.body)
}
