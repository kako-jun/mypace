import { Icon, Input } from '../ui'

interface FilterFieldsProps {
  ngWordsInput: string
  ngTagsInput: string
  onNgWordsChange: (value: string) => void
  onNgTagsChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function FilterFields({
  ngWordsInput,
  ngTagsInput,
  onNgWordsChange,
  onNgTagsChange,
  onKeyDown,
}: FilterFieldsProps) {
  return (
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
  )
}
