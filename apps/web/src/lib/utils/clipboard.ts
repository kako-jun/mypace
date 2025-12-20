export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export async function shareOrCopy(url: string): Promise<{ shared: boolean; copied: boolean }> {
  if (navigator.share) {
    try {
      await navigator.share({ url })
      return { shared: true, copied: false }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return { shared: false, copied: false }
      }
    }
  }

  const copied = await copyToClipboard(url)
  return { shared: false, copied }
}

export function downloadAsMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function openRawUrl(eventId: string): void {
  const rawUrl = `${window.location.origin}/api/events/${eventId}/raw`
  window.open(rawUrl, '_blank')
}
