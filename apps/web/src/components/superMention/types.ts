export type SuggestItem =
  | { type: 'wikidata'; id: string; path: string; description: string; aliases?: string[] }
  | { type: 'history'; path: string; description: string; wikidataId?: string }
  | { type: 'custom'; path: string }
