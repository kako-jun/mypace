import { createRoute } from 'honox/factory'
import Timeline from '../islands/Timeline'
import PostForm from '../islands/PostForm'
import Settings from '../islands/Settings'
import Logo from '../islands/Logo'

export default createRoute((c) => {
  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <Settings />
      </header>
      <PostForm />
      <Timeline />
    </main>,
    { title: 'MYPACE' }
  )
})
