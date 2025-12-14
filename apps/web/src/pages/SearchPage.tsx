import { useSearchParams } from 'react-router-dom'
import { HomePage } from './HomePage'
import { parseSearchParams } from '../lib/utils'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const filters = parseSearchParams(searchParams)

  return <HomePage filters={filters} showSearchBox={true} />
}
