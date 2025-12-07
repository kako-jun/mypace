import type { Child } from 'hono/jsx'

interface ErrorBoxProps {
  children: Child
  onRetry?: () => void
}

export default function ErrorBox({ children, onRetry }: ErrorBoxProps) {
  return (
    <div class="error-box">
      <p>{children}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  )
}
