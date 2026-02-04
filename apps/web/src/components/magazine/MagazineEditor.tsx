import { useState } from 'react'
import { Icon, CloseButton, Button, Input, Textarea, Portal } from '../ui'
import type { MagazineInput } from '../../lib/nostr/events'
import type { Magazine } from '../../types'
import '../../styles/components/magazine.css'

interface MagazineEditorProps {
  magazine?: Magazine
  onSave: (input: MagazineInput) => Promise<void>
  onClose: () => void
}

function generateSlug(title: string): string {
  // Try to generate from title (for English titles)
  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)

  // If title produces a valid slug, use it
  if (fromTitle.length >= 3) {
    return fromTitle
  }

  // Otherwise generate a random ID (for non-ASCII titles like Japanese)
  const randomId = Math.random().toString(36).slice(2, 10)
  return `magazine-${randomId}`
}

export function MagazineEditor({ magazine, onSave, onClose }: MagazineEditorProps) {
  const [title, setTitle] = useState(magazine?.title ?? '')
  const [slug, setSlug] = useState(magazine?.slug ?? '')
  const [description, setDescription] = useState(magazine?.description ?? '')
  const [image, setImage] = useState(magazine?.image ?? '')
  const [saving, setSaving] = useState(false)
  const [slugEdited, setSlugEdited] = useState(!!magazine?.slug)

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugEdited) {
      setSlug(generateSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlug(value.replace(/[^a-z0-9-]/g, '').slice(0, 50))
    setSlugEdited(true)
  }

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) return

    setSaving(true)
    try {
      await onSave({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        image: image.trim(),
        eventIds: magazine?.eventIds ?? [],
      })
    } catch (err) {
      console.error('Failed to save magazine:', err)
    } finally {
      setSaving(false)
    }
  }

  const isValid = title.trim() && slug.trim()

  return (
    <Portal>
      <div className="magazine-editor-overlay" onClick={onClose} />
      <div className="magazine-editor">
        <div className="magazine-editor-header">
          <span className="magazine-editor-title">{magazine ? 'Edit Magazine' : 'Create Magazine'}</span>
          <CloseButton onClick={onClose} size={18} />
        </div>

        <div className="magazine-editor-content">
          <div className="magazine-editor-field">
            <label>Title</label>
            <Input value={title} onChange={handleTitleChange} placeholder="Magazine title" maxLength={100} />
          </div>

          <div className="magazine-editor-field">
            <label>Slug</label>
            <Input value={slug} onChange={handleSlugChange} placeholder="url-identifier" maxLength={50} />
            <span className="magazine-editor-hint">Used in URL: /magazine/{slug || '...'}</span>
          </div>

          <div className="magazine-editor-field">
            <label>Description</label>
            <Textarea
              value={description}
              onChange={setDescription}
              placeholder="What is this magazine about?"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="magazine-editor-field">
            <label>Thumbnail URL</label>
            <Input type="url" value={image} onChange={setImage} placeholder="https://..." />
            {image && (
              <div className="magazine-editor-preview">
                <img src={image} alt="Preview" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>
        </div>

        <div className="magazine-editor-actions">
          <Button size="md" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="md" variant="primary" onClick={handleSave} disabled={!isValid || saving}>
            {saving ? (
              <>
                <Icon name="Loader" size={16} /> Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </Portal>
  )
}
