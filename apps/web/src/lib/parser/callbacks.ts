// Callback for hashtag clicks
let onHashtagClick: ((tag: string) => void) | null = null

export function setHashtagClickHandler(handler: (tag: string) => void) {
  onHashtagClick = handler
}

export function clearHashtagClickHandler() {
  onHashtagClick = null
}

export function getHashtagClickHandler() {
  return onHashtagClick
}

// Callback for image clicks (LightBox)
let onImageClick: ((src: string) => void) | null = null

export function setImageClickHandler(handler: (src: string) => void) {
  onImageClick = handler
}

export function clearImageClickHandler() {
  onImageClick = null
}

export function getImageClickHandler() {
  return onImageClick
}

// Callback for super mention clicks
let onSuperMentionClick: ((path: string) => void) | null = null

export function setSuperMentionClickHandler(handler: (path: string) => void) {
  onSuperMentionClick = handler
}

export function clearSuperMentionClickHandler() {
  onSuperMentionClick = null
}

export function getSuperMentionClickHandler() {
  return onSuperMentionClick
}
