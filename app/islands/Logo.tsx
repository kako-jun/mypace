import { navigateToHome } from '../lib/utils'

export default function Logo() {
  const handleClick = (e: Event) => {
    e.preventDefault()
    navigateToHome()
  }

  return (
    <a href="/" class="logo" onClick={handleClick}>
      <img src="/static/logo.webp" alt="MYPACE" class="logo-img" />
    </a>
  )
}
