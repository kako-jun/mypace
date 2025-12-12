interface AttachedImagesProps {
  imageUrls: string[]
  onRemove: (url: string) => void
}

export default function AttachedImages({ imageUrls, onRemove }: AttachedImagesProps) {
  if (imageUrls.length === 0) return null

  return (
    <div className="attached-images">
      {imageUrls.map((url) => (
        <div key={url} className="attached-image">
          <img src={url} alt="Attached image" />
          <button
            type="button"
            className="remove-image-button"
            onClick={() => onRemove(url)}
            aria-label="Remove attached image"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
