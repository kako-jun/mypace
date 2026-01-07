import { Icon, Input } from '../ui'

interface FilterFieldsProps {
  searchQuery: string
  okTagsInput: string
  ngWordsInput: string
  ngTagsInput: string
  onSearchQueryChange: (value: string) => void
  onOkTagsChange: (value: string) => void
  onNgWordsChange: (value: string) => void
  onNgTagsChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
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
            <Input
              value={searchQuery}
              placeholder="Keyword..."
              onChange={onSearchQueryChange}
              onKeyDown={onKeyDown}
              className="filter-search-input"
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
            <Input
              value={okTagsInput}
              placeholder="Tags..."
              onChange={onOkTagsChange}
              onKeyDown={onKeyDown}
              className="filter-search-input"
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
            <Input
              value={ngWordsInput}
              placeholder="Keywords..."
              onChange={onNgWordsChange}
              onKeyDown={onKeyDown}
              className="filter-search-input"
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
            <Input
              value={ngTagsInput}
              placeholder="Tags..."
              onChange={onNgTagsChange}
              onKeyDown={onKeyDown}
              className="filter-search-input"
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
