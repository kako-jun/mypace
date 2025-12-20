export function getItem<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function removeItem(key: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(key)
}

export function getString(key: string, defaultValue: string = ''): string {
  if (typeof localStorage === 'undefined') return defaultValue
  return localStorage.getItem(key) || defaultValue
}

export function setString(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, value)
}

export function getBoolean(key: string, defaultValue: boolean = false): boolean {
  if (typeof localStorage === 'undefined') return defaultValue
  const value = localStorage.getItem(key)
  if (value === null) return defaultValue
  return value === 'true'
}

export function setBoolean(key: string, value: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, value ? 'true' : 'false')
}
