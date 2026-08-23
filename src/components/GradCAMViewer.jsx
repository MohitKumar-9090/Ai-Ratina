import ImagePreview from './ImagePreview'

export default function GradCAMViewer({ originalImage, heatmapImage, overlayImage }) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* 1. Original Retina */}
      <figure className="space-y-2">
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Original Retina
        </figcaption>
        <ImagePreview
          src={originalImage || '/retina-placeholder.svg'}
          alt="Original retinal fundus image"
          className="aspect-square rounded-xl border border-surface-border"
        />
      </figure>

      {/* 2. Grad-CAM Heatmap */}
      <figure className="space-y-2">
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Grad-CAM Heatmap
        </figcaption>
        <ImagePreview
          src={heatmapImage || overlayImage || '/gradcam-placeholder.svg'}
          alt="Grad-CAM activation heatmap"
          className="aspect-square rounded-xl border border-surface-border"
        />
      </figure>

      {/* 3. Grad-CAM Overlay */}
      <figure className="space-y-2">
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Grad-CAM Overlay
        </figcaption>
        <ImagePreview
          src={overlayImage || '/gradcam-placeholder.svg'}
          alt="Grad-CAM heatmap overlaid on original retina"
          className="aspect-square rounded-xl border border-surface-border"
        />
      </figure>
    </div>
  )
}
