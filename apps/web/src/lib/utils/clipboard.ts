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
