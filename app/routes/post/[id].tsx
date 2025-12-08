import { createRoute } from 'honox/factory'
import PostView from '../../islands/PostView'
import Settings from '../../islands/Settings'
import Logo from '../../islands/Logo'
import SearchButton from '../../islands/SearchButton'
import { APP_TITLE } from '../../lib/nostr/events'

export default createRoute((c) => {
  const id = c.req.param('id')

  // Handle missing id parameter
  if (!id) {
    return c.redirect('/')
  }

  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <div class="header-actions">
          <SearchButton />
          <Settings />
        </div>
      </header>
      <PostView eventId={id} />
    </main>,
    { title: APP_TITLE }
  )
})
