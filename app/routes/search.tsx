import { createRoute } from 'honox/factory'
import Home from '../islands/Home'
import Settings from '../islands/Settings'
import Logo from '../islands/Logo'
import { SearchButton } from '../components/ui'
import { APP_TITLE } from '../lib/nostr/events'
import type { FilterMode } from '../types'

export default createRoute((c) => {
  const url = new URL(c.req.url)
  const query = url.searchParams.get('q') || ''
  const tagsParam = url.searchParams.get('tags') || ''
  const modeParam = url.searchParams.get('mode') || 'and'

  // Parse tags: + for AND mode, , for OR mode
  let tags: string[] = []
  if (tagsParam) {
    if (tagsParam.includes('+')) {
      tags = tagsParam.split('+').map((t) => decodeURIComponent(t))
    } else if (tagsParam.includes(',')) {
      tags = tagsParam.split(',').map((t) => decodeURIComponent(t))
    } else {
      tags = [decodeURIComponent(tagsParam)]
    }
  }

  const filterMode: FilterMode = modeParam === 'or' ? 'or' : 'and'

  let title = 'Search'
  if (query && tags.length > 0) {
    title = `"${query}" + ${tags.map((t) => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')}`
  } else if (query) {
    title = `"${query}"`
  } else if (tags.length > 0) {
    title = tags.map((t) => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')
  }
  title += ` - ${APP_TITLE}`

  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <div class="header-actions">
          <SearchButton />
          <Settings />
        </div>
      </header>
      <Home initialFilterTags={tags} initialFilterMode={filterMode} initialSearchQuery={query} showSearchBox />
    </main>,
    { title }
  )
})
