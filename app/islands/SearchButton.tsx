import { Icon } from '../components/ui'

export default function SearchButton() {
  const handleClick = () => {
    window.location.href = '/search'
  }

  return (
    <button class="search-toggle" onClick={handleClick} title="Search">
      <Icon name="Search" size={20} />
    </button>
  )
}
