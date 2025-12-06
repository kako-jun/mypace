import { createRoute } from 'honox/factory'
import PostView from '../../islands/PostView'
import Settings from '../../islands/Settings'
import Logo from '../../islands/Logo'
import { APP_TITLE } from '../../lib/nostr/events'

export default createRoute((c) => {
  const id = c.req.param('id')
  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <Settings />
      </header>
      <PostView eventId={id} />
    </main>,
    { title: APP_TITLE }
  )
})
