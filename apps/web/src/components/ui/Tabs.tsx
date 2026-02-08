interface Tab<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export default function Tabs<T extends string>({ tabs, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`tabs ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`tab ${value === tab.value ? 'active' : ''}`}
          onClick={() => onChange(tab.value)}
          disabled={tab.disabled}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
