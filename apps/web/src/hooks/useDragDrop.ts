import { useState } from 'react'

interface UseDragDropResult {
  dragging: boolean
  handlers: {
    onDragOver: (e: React.DragEvent<HTMLElement>) => void
    onDragLeave: (e: React.DragEvent<HTMLElement>) => void
    onDrop: (e: React.DragEvent<HTMLElement>) => void
  }
}

export function useDragDrop(onFileDrop: (file: File) => void | Promise<void>): UseDragDropResult {
  const [dragging, setDragging] = useState(false)

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const onDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    await onFileDrop(files[0])
  }

  return {
    dragging,
    handlers: { onDragOver, onDragLeave, onDrop },
  }
}
