import { renderContent } from '../../lib/content-parser'
import { getThemeCardProps, type ThemeColors } from '../../lib/nostr/events'

interface PostPreviewProps {
  content: string
  themeColors: ThemeColors | null
}

export default function PostPreview({ content, themeColors }: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  return (
    <div class={`post-preview ${themeProps.className}`} style={themeProps.style}>
      <div class="preview-label">Preview</div>
      <div class="preview-content">
        {renderContent(content)}
      </div>
    </div>
  )
}
