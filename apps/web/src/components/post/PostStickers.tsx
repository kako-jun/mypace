import type { Sticker } from '../../types'

interface PostStickersProps {
  stickers: Sticker[]
}

export default function PostStickers({ stickers }: PostStickersProps) {
  if (stickers.length === 0) return null

  return (
    <>
      {stickers.map((sticker, index) => (
        <img
          key={index}
          src={sticker.url}
          alt=""
          className="post-sticker"
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            width: `${sticker.size}%`,
          }}
          loading="lazy"
        />
      ))}
    </>
  )
}
