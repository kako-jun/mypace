interface AvatarProps {
  src: string | null | undefined
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const sizeClasses = {
  small: 'avatar-small',
  medium: 'avatar-medium',
  large: 'avatar-large',
}

export default function Avatar({ src, size = 'medium', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size]

  if (src) {
    return <img src={src} alt="" class={`avatar ${sizeClass} ${className}`} />
  }

  return <div class={`avatar-placeholder ${sizeClass} ${className}`}>No image</div>
}
