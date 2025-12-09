import { createRoute } from 'honox/factory'
import PostView from '../../islands/PostView'
import { APP_TITLE } from '../../lib/nostr/events'

export default createRoute((c) => {
  const id = c.req.param('id')

  // Handle missing id parameter
  if (!id) {
    return c.redirect('/')
  }

  return c.render(
    <main class="container">
      <PostView eventId={id} />
    </main>,
    { title: APP_TITLE }
  )
})
