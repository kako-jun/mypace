import { createRoute } from 'honox/factory'
import Home from '../islands/Home'
import { APP_TITLE } from '../lib/nostr/events'

export default createRoute((c) => {
  return c.render(
    <main class="container">
      <Home />
    </main>,
    { title: APP_TITLE }
  )
})
