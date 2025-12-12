import './Loading.css'

export default function Loading() {
  return (
    <div className="loading-overlay">
      <img src="/static/star.webp" alt="" className="loading-star" />
      <span className="loading-text">Loading...</span>
    </div>
  )
}
