export type EmbedType =
  | 'youtube'
  | 'youtube-shorts'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'spotify'
  | 'video'
  | 'audio'
  | 'iframe'
  | 'ogp'

export interface EmbedInfo {
  type: EmbedType
  url: string
  videoId?: string
  tweetId?: string
  instagramId?: string
  instagramType?: 'post' | 'reel' | 'stories'
  tiktokId?: string
  spotifyType?: 'track' | 'album' | 'playlist' | 'episode' | 'show'
  spotifyId?: string
  iframeSrc?: string
}
