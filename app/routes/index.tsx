import { createRoute } from 'honox/factory'
import Timeline from '../islands/Timeline'
import PostForm from '../islands/PostForm'
import Settings from '../islands/Settings'

export default createRoute((c) => {
  return c.render(
    <main class="container">
      <header class="header">
        <h1>mypace</h1>
        <Settings />
      </header>
      <PostForm />
      <Timeline />
    </main>,
    { title: 'mypace - Nostr microblog' }
  )
})
