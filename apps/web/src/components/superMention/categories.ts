import { BookOpen, Clapperboard, Gamepad2, Film, Music, Book, Code, MapPin, User, Lightbulb, Globe } from 'lucide-react'

export type LucideIcon = typeof BookOpen

export const TOP_CATEGORIES = [
  { path: 'manga', label: '漫画', icon: BookOpen },
  { path: 'anime', label: 'アニメ', icon: Clapperboard },
  { path: 'game', label: 'ゲーム', icon: Gamepad2 },
  { path: 'movie', label: '映画', icon: Film },
  { path: 'music', label: '音楽', icon: Music },
  { path: 'book', label: '書籍', icon: Book },
  { path: 'tech', label: '技術', icon: Code },
  { path: 'place', label: '場所', icon: MapPin },
  { path: 'person', label: '人物', icon: User },
  { path: 'thing', label: '物・概念', icon: Lightbulb },
  { path: 'web', label: 'Web', icon: Globe },
] as const

export type CategoryPath = (typeof TOP_CATEGORIES)[number]['path']
