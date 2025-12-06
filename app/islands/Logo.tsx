export default function Logo() {
  const handleClick = (e: Event) => {
    e.preventDefault()
    window.location.href = '/'
  }

  return (
    <a href="/" class="logo" onClick={handleClick}>
      <span class="logo-my">MY</span>
      <span class="logo-pace">PACE</span>
    </a>
  )
}
