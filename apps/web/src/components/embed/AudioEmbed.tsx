interface AudioEmbedProps {
  url: string
}

export default function AudioEmbed({ url }: AudioEmbedProps) {
  return (
    <div className="embed-container embed-audio">
      <audio controls preload="metadata">
        <source src={url} />
        Your browser does not support audio playback.
      </audio>
    </div>
  )
}
