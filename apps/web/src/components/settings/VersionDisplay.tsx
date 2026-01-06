// __BUILD_DATE__ is injected at build time by Vite (vite.config.ts)
declare const __BUILD_DATE__: string

export function VersionDisplay() {
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'

  return <div className="version-display">v{buildDate}</div>
}
