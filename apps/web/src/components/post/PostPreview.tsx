import { getThemeCardProps } from '../../lib/nostr/events'
import { PostContent } from './PostContent'
import type { ThemeColors } from '../../types'

interface PostPreviewProps {
  content: string
  themeColors: ThemeColors | null
  transparentBackground?: boolean
}

export default function PostPreview({ content, themeColors, transparentBackground = false }: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  return (
    <div className={`post-preview ${themeProps.className}`} style={transparentBackground ? {} : themeProps.style}>
      <div className="preview-label">Preview</div>
      <div className="preview-content">
        <PostContent content={content} />
      </div>
    </div>
  )
}
