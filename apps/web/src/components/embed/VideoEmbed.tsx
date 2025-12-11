interface VideoEmbedProps {
  url: string
}

export default function VideoEmbed({ url }: VideoEmbedProps) {
  return (
    <div className="embed-container embed-video">
      <video controls preload="metadata">
        <source src={url} />
        Your browser does not support video playback.
      </video>
    </div>
  )
}
