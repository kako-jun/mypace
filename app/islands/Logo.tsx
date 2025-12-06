export default function Logo() {
  const handleClick = (e: Event) => {
    e.preventDefault()
    window.location.href = '/'
  }

  return (
    <a href="/" class="logo" onClick={handleClick}>
      <img src="/static/logo.webp" alt="MYPACE" class="logo-img" />
    </a>
  )
}
