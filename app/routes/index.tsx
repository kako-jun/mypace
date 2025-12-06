import { createRoute } from 'honox/factory'
import Home from '../islands/Home'
import Settings from '../islands/Settings'
import Logo from '../islands/Logo'

export default createRoute((c) => {
  return c.render(
    <main class="container">
      <header class="header">
        <Logo />
        <Settings />
      </header>
      <Home />
    </main>,
    { title: 'MYPACE' }
  )
})
