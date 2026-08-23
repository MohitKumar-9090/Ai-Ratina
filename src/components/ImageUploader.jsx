import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import ImagePreview from './ImagePreview'

export default function ImageUploader({ image, onImageChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')

  const setFile = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG, JPEG, or PNG image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Please select an image smaller than 10 MB.')
      return
    }
    setError('')
    onImageChange({ preview: URL.createObjectURL(file), file })
  }

  return (
    <div className="space-y-4">
      {image?.preview ? (
        <div className="space-y-4">
          <ImagePreview src={image.preview} className="aspect-[16/9] max-h-[320px] rounded-xl border border-surface-border" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary w-full sm:w-auto text-xs"
            >
              <ImagePlus className="h-4 w-4" /> Replace Image
            </button>
            <button
              type="button"
              onClick={() => onImageChange(null)}
              className="btn-secondary w-full border-status-danger/20 text-status-danger hover:bg-status-danger/5 sm:w-auto text-xs"
            >
              <Trash2 className="h-4 w-4" /> Remove Image
            </button>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            setFile(e.dataTransfer.files?.[0])
          }}
          className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-border bg-surface-card px-6 text-center transition-all hover:border-primary hover:bg-surface-soft/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-soft text-primary-deep">
            <UploadCloud className="h-6 w-6" />
          </div>
          <span className="font-bold text-ink">Upload Retina Image</span>
          <span className="mt-1 text-xs text-ink-muted">Drag and drop fundus image, or click to browse</span>
          <span className="mt-3 text-[11px] font-semibold text-ink-subtle">JPG / JPEG / PNG · Max 10 MB</span>
          <input
            ref={inputRef}
            onChange={(e) => setFile(e.target.files?.[0])}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
          />
        </label>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-status-danger">{error}</p>}
    </div>
  )
}
