export function extractInstagramInfo(url: string): { id: string; type: 'post' | 'reel' | 'stories' } | null {
  const postMatch = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/)
  if (postMatch) return { id: postMatch[1], type: 'post' }

  const reelMatch = url.match(/instagram\.com\/reel\/([a-zA-Z0-9_-]+)/)
  if (reelMatch) return { id: reelMatch[1], type: 'reel' }

  const storiesMatch = url.match(/instagram\.com\/stories\/[^/]+\/(\d+)/)
  if (storiesMatch) return { id: storiesMatch[1], type: 'stories' }

  return null
}

export function getInstagramEmbedUrl(id: string): string {
  return `https://www.instagram.com/p/${id}/embed`
}
