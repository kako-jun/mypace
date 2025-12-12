import './Loading.css'

export default function Loading() {
  return (
    <div className="loading-overlay">
      <div className="loading-circle">
        <img src="/static/star.webp" alt="" className="loading-star" />
        <span className="loading-text">Loading...</span>
      </div>
    </div>
  )
}
