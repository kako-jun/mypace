interface Props {
  children: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'primary' | 'danger' | 'secondary'
}

export default function Button({ children, onClick, disabled = false, type = 'button', variant = 'primary' }: Props) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
