interface FileInputProps {
  accept?: string
  onChange: (file: File) => void
  disabled?: boolean
  className?: string
  id?: string
}

export default function FileInput({
  accept = 'image/*',
  onChange,
  disabled = false,
  className = '',
  id,
}: FileInputProps) {
  const handleChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      onChange(file)
    }
    input.value = ''
  }

  return (
    <input
      type="file"
      accept={accept}
      onChange={handleChange}
      disabled={disabled}
      class={`file-input ${className}`}
      id={id}
      style={{ display: 'none' }}
    />
  )
}
