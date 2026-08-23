import { Image as ImageIcon } from 'lucide-react'

export default function ImagePreview({ src, alt = 'Retina image preview', className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900 ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain p-1" />
      ) : (
        <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-ink-subtle">
          <ImageIcon className="h-7 w-7" />
          <span className="text-xs">No image preview</span>
        </div>
      )}
    </div>
  )
}
