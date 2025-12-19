import { Icon } from '../ui/Icon'

interface FilterFieldsProps {
  searchQuery: string
  okTagsInput: string
  ngWordsInput: string
  ngTagsInput: string
  onSearchQueryChange: (value: string) => void
  onOkTagsChange: (value: string) => void
  onNgWordsChange: (value: string) => void
  onNgTagsChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

export function FilterFields({
  searchQuery,
  okTagsInput,
  ngWordsInput,
  ngTagsInput,
  onSearchQueryChange,
  onOkTagsChange,
  onNgWordsChange,
  onNgTagsChange,
  onKeyDown,
  inputRef,
}: FilterFieldsProps) {
  return (
    <>
      {/* OK group */}
      <div className="filter-group filter-group-ok">
        <span className="filter-group-label">OK</span>
        <div className="filter-group-inputs">
          {/* OK word input */}
          <div className="filter-search-row">
            <Icon name="Search" size={16} className="filter-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="filter-search-input"
              value={searchQuery}
              placeholder="Keyword..."
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => onSearchQueryChange('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* OK tags input */}
          <div className="filter-search-row">
            <Icon name="Hash" size={16} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={okTagsInput}
              placeholder="Tags..."
              onChange={(e) => onOkTagsChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {okTagsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => onOkTagsChange('')}
                aria-label="Clear OK tags"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NG group */}
      <div className="filter-group filter-group-ng">
        <span className="filter-group-label filter-group-label-ng">NG</span>
        <div className="filter-group-inputs">
          {/* NG word input */}
          <div className="filter-search-row">
            <Icon name="Ban" size={16} className="filter-search-icon filter-ng-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={ngWordsInput}
              placeholder="Keywords..."
              onChange={(e) => onNgWordsChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {ngWordsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => onNgWordsChange('')}
                aria-label="Clear NG words"
              >
                ×
              </button>
            )}
          </div>

          {/* NG tags input */}
          <div className="filter-search-row">
            <Icon name="Hash" size={16} className="filter-search-icon filter-ng-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={ngTagsInput}
              placeholder="Tags..."
              onChange={(e) => onNgTagsChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {ngTagsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => onNgTagsChange('')}
                aria-label="Clear NG tags"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
