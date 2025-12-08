import Icon from './Icon'

export default function SearchButton() {
  const handleClick = () => {
    window.location.href = '/search'
  }

  return (
    <button class="search-toggle text-outlined" onClick={handleClick} title="Search">
      <Icon name="Search" size={20} />
    </button>
  )
}
