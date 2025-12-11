import { useSearchParams } from 'react-router-dom'
import { HomePage } from './HomePage'
import type { FilterMode } from '../types'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const mode = (searchParams.get('mode') || 'and') as FilterMode

  return <HomePage initialSearchQuery={query} initialFilterTags={tags} initialFilterMode={mode} showSearchBox={true} />
}
