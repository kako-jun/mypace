import type { LucideIcon } from './categories'

export type SuggestItem =
  | { type: 'category'; path: string; label: string; icon: LucideIcon }
  | { type: 'wikidata'; id: string; label: string; description: string }
  | { type: 'history'; path: string; label: string; description: string; wikidataId?: string }
  | { type: 'custom'; label: string }
