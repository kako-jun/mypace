export function extractSpotifyInfo(
  url: string
): { id: string; type: 'track' | 'album' | 'playlist' | 'episode' | 'show' } | null {
  const trackMatch = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)
  if (trackMatch) return { id: trackMatch[1], type: 'track' }

  const albumMatch = url.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/)
  if (albumMatch) return { id: albumMatch[1], type: 'album' }

  const playlistMatch = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/)
  if (playlistMatch) return { id: playlistMatch[1], type: 'playlist' }

  const episodeMatch = url.match(/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/)
  if (episodeMatch) return { id: episodeMatch[1], type: 'episode' }

  const showMatch = url.match(/open\.spotify\.com\/show\/([a-zA-Z0-9]+)/)
  if (showMatch) return { id: showMatch[1], type: 'show' }

  return null
}

export function getSpotifyEmbedUrl(id: string, type: 'track' | 'album' | 'playlist' | 'episode' | 'show'): string {
  return `https://open.spotify.com/embed/${type}/${id}`
}
