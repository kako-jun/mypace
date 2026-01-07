import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ marginBottom: '2rem', opacity: 0.7 }}>Page not found</p>
      <Link to="/" className="text-button">
        Go to Home
      </Link>
    </div>
  )
}
