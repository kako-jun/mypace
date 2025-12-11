import { useParams } from 'react-router-dom'
import { HomePage } from './HomePage'
import type { FilterMode } from '../types'

export function TagPage() {
  const { tags } = useParams<{ tags: string }>()

  if (!tags) {
    return <HomePage />
  }

  // Parse tags - '+' means AND mode, ',' means OR mode
  const hasPlus = tags.includes('+')
  const hasComma = tags.includes(',')

  let filterTags: string[]
  let filterMode: FilterMode

  if (hasPlus) {
    filterTags = tags.split('+').map(decodeURIComponent)
    filterMode = 'and'
  } else if (hasComma) {
    filterTags = tags.split(',').map(decodeURIComponent)
    filterMode = 'or'
  } else {
    filterTags = [decodeURIComponent(tags)]
    filterMode = 'and'
  }

  return <HomePage initialFilterTags={filterTags} initialFilterMode={filterMode} />
}
