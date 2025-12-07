interface AttachedImagesProps {
  imageUrls: string[]
  onRemove: (url: string) => void
}

export default function AttachedImages({ imageUrls, onRemove }: AttachedImagesProps) {
  if (imageUrls.length === 0) return null

  return (
    <div class="attached-images">
      {imageUrls.map((url) => (
        <div key={url} class="attached-image">
          <img src={url} alt="" />
          <button
            type="button"
            class="remove-image-button"
            onClick={() => onRemove(url)}
            title="Remove image"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
