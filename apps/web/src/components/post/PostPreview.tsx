import { renderContent } from '../../lib/content-parser'
import { getThemeCardProps } from '../../lib/nostr/events'
import type { ThemeColors } from '../../types'

interface PostPreviewProps {
  content: string
  themeColors: ThemeColors | null
}

export default function PostPreview({ content, themeColors }: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  return (
    <div className={`post-preview ${themeProps.className}`} style={themeProps.style}>
      <div className="preview-label">Preview</div>
      <div className="preview-content">{renderContent(content)}</div>
    </div>
  )
}
