import { createRoute } from 'honox/factory'
import Timeline from '../islands/Timeline'
import PostForm from '../islands/PostForm'
import Settings from '../islands/Settings'

export default createRoute((c) => {
  return c.render(
    <main class="container">
      <header class="header">
        <div class="logo">
          <span class="logo-my">MY</span>
          <span class="logo-pace">PACE</span>
        </div>
        <Settings />
      </header>
      <PostForm />
      <Timeline />
    </main>,
    { title: 'mypace - Nostr microblog' }
  )
})
