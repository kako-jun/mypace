interface AvatarProps {
  src: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'reply-avatar',
  md: 'post-avatar',
  lg: 'settings-avatar',
}

const placeholderClasses = {
  sm: 'reply-avatar-placeholder',
  md: 'post-avatar-placeholder',
  lg: 'settings-avatar-placeholder',
}

export default function Avatar({
  src,
  alt = '',
  size = 'md',
  className,
}: AvatarProps) {
  const avatarClass = className || sizeClasses[size]
  const placeholderClass = placeholderClasses[size]

  if (src) {
    return <img src={src} alt={alt} class={avatarClass} />
  }

  return <div class={placeholderClass} />
}
