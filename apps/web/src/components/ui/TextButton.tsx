import { forwardRef, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'default' | 'primary' | 'warning'
  className?: string
  'aria-label'?: string
  title?: string
}

const TextButton = forwardRef<HTMLButtonElement, Props>(
  (
    {
      children,
      onClick,
      disabled = false,
      type = 'button',
      variant = 'default',
      className = '',
      'aria-label': ariaLabel,
      title,
    },
    ref
  ) => {
    const variantClass = variant !== 'default' ? `text-outlined-${variant}` : ''
    return (
      <button
        ref={ref}
        type={type}
        className={`text-outlined text-outlined-button ${variantClass} ${className}`.trim()}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
      >
        {children}
      </button>
    )
  }
)

TextButton.displayName = 'TextButton'

export default TextButton
