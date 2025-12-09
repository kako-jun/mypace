import { createRoute } from 'honox/factory'
import UserView from '../../islands/UserView'
import { APP_TITLE } from '../../lib/nostr/events'

export default createRoute((c) => {
  const pubkey = c.req.param('pubkey')

  // Handle missing pubkey parameter
  if (!pubkey) {
    return c.redirect('/')
  }

  // Validate pubkey format (64 hex characters)
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    return c.redirect('/')
  }

  return c.render(
    <main class="container">
      <UserView pubkey={pubkey} />
    </main>,
    { title: APP_TITLE }
  )
})
