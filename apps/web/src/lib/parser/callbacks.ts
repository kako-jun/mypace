// Callback for hashtag clicks
let onHashtagClick: ((tag: string) => void) | null = null

export function setHashtagClickHandler(handler: (tag: string) => void) {
  onHashtagClick = handler
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

export function getSuperMentionClickHandler() {
  return onSuperMentionClick
}

// Callback for internal link clicks (SPA navigation)
let onInternalLinkClick: ((path: string) => void) | null = null

export function setInternalLinkClickHandler(handler: (path: string) => void) {
  onInternalLinkClick = handler
}

export function getInternalLinkClickHandler() {
  return onInternalLinkClick
}

// Callback for wordrot word clicks
let onWordrotClick: ((word: string) => void) | null = null

export function setWordrotClickHandler(handler: (word: string) => void) {
  onWordrotClick = handler
}

export function clearWordrotClickHandler() {
  onWordrotClick = null
}

export function getWordrotClickHandler() {
  return onWordrotClick
}
