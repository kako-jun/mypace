export type SuggestItem =
  | { type: 'wikidata'; id: string; label: string; description: string }
  | { type: 'history'; path: string; label: string; description: string; wikidataId?: string }
  | { type: 'custom'; label: string }
