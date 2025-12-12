import { useState, useEffect } from 'react'

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
  const [hasError, setHasError] = useState(false)
  const sizeClass = sizeClasses[size]

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false)
  }, [src])

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt=""
        className={`avatar ${sizeClass} ${className}`}
        onError={() => setHasError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return <div className={`avatar-placeholder ${sizeClass} ${className}`}>{hasError ? '404' : 'No image'}</div>
}
