import { createRoute } from 'honox/factory'
import UserView from '../../islands/UserView'
import Settings from '../../islands/Settings'
import Logo from '../../islands/Logo'
import { SearchButton } from '../../components/ui'
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
      <header class="header">
        <Logo />
        <div class="header-actions">
          <SearchButton />
          <Settings />
        </div>
      </header>
      <UserView pubkey={pubkey} />
    </main>,
    { title: APP_TITLE }
  )
})
