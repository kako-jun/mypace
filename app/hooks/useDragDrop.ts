import { useState } from 'hono/jsx'

interface UseDragDropResult {
  dragging: boolean
  handlers: {
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

export function useDragDrop(onFileDrop: (file: File) => void | Promise<void>): UseDragDropResult {
  const [dragging, setDragging] = useState(false)

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const onDrop = async (e: DragEvent) => {
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
