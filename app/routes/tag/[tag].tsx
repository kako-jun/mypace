import { createRoute } from 'honox/factory'
import Home from '../../islands/Home'
import Settings from '../../islands/Settings'
import Logo from '../../islands/Logo'
import { APP_TITLE } from '../../lib/nostr/events'

export default createRoute((c) => {
  const tagParam = c.req.param('tag')

  // Parse tag filter: + for AND, , for OR
  let tags: string[] = []
  let filterMode: 'and' | 'or' = 'and'

  if (tagParam.includes('+')) {
    tags = tagParam.split('+').map(t => decodeURIComponent(t))
    filterMode = 'and'
  } else if (tagParam.includes(',')) {
    tags = tagParam.split(',').map(t => decodeURIComponent(t))
    filterMode = 'or'
  } else {
    tags = [decodeURIComponent(tagParam)]
  }

  const title = tags.length === 1
    ? `#${tags[0]} - ${APP_TITLE}`
    : `${tags.map(t => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')} - ${APP_TITLE}`

  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <Settings />
      </header>
      <Home initialFilterTags={tags} initialFilterMode={filterMode} />
    </main>,
    { title }
  )
})
