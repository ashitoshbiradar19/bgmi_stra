import { useEffect, useMemo, useRef, useState } from 'react'
import { renderExportCanvas, ensureFontsReady } from '../lib/export'
import { computeFrameLayout, getTemplate } from '../lib/frames'

/**
 * Live export preview.
 *
 * This deliberately calls `renderExportCanvas()` — the very same function the
 * download button calls — and then blits the result down into a small canvas.
 * A hand-rolled "preview renderer" would inevitably drift from the real export,
 * so there isn't one.
 *
 * The preview is composed at a reduced `outputWidth`. Because every frame
 * metric is expressed in design units and multiplied by scaleF, a 720px
 * composition is a true miniature of the 2048px download, not an approximation.
 */
export default function ExportPreview({
  board,
  frame,
  mode,
  view,
  viewportW,
  viewportH,
  previewWidth = 620,
  // The resolution the Download button will actually produce. Reported to the
  // user in the caption, because the preview itself is a scaled-down render.
  outputWidth = 2048,
  className = '',
}) {
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [error, setError] = useState(null)

  // Board contents are large arrays; depend on the values that actually change
  // pixels rather than on array identity, so drawing does not re-render the
  // preview on every pointer move.
  const boardKey = [
    board.mapId,
    board.mapSize,
    board.circles.length,
    board.annos.length,
    board.gridOn ? 1 : 0,
    board.showHeatmap ? 1 : 0,
    board.showContours ? 1 : 0,
    board.showBlueZoneMask ? 1 : 0,
    board.mapImage ? 'img' : 'noimg',
  ].join('|')

  const frameKey = JSON.stringify(frame)

  // The real download resolution. computeFrameLayout is a pure function and is
  // the same one the exporter uses, so this caption is authoritative rather
  // than an estimate of the preview.
  const realSize = useMemo(() => {
    const aspect = mode === 'square' ? 1 : viewportH / viewportW
    // computeLogoBox only needs the source aspect ratio, so the stored pixel
    // dimensions stand in for the decoded image here.
    const logo = frame?.logo?.dataUrl
      ? { ...frame.logo, img: { naturalWidth: frame.logo.width || 512, naturalHeight: frame.logo.height || 512 } }
      : null
    const layout = computeFrameLayout({
      template: getTemplate(frame?.templateId || 'none'),
      fields: frame?.fields || { header: {}, footer: {} },
      content: frame?.content,
      outputWidth,
      contentAspect: aspect,
      logo,
    })
    return { w: layout.width, h: layout.height }
  }, [frameKey, mode, outputWidth, viewportW, viewportH])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await ensureFontsReady()
      if (cancelled) return
      try {
        const { canvas, width, height } = await renderExportCanvas({
          mode,
          board,
          frame,
          view,
          viewportW,
          viewportH,
          outputWidth: previewWidth,
          // Fixed timestamp so the preview does not shimmer on every repaint.
          t: 0,
        })
        if (cancelled) return

        const target = canvasRef.current
        if (target) {
          // Backing store at device resolution for a crisp preview.
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          target.width = Math.round(width * dpr)
          target.height = Math.round(height * dpr)
          target.style.width = `${width}px`
          target.style.height = `${height}px`
          const ctx = target.getContext('2d')
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.clearRect(0, 0, target.width, target.height)
          ctx.drawImage(canvas, 0, 0, target.width, target.height)
        }
        setSize({ w: width, h: height })
        setError(null)
        canvas.width = canvas.height = 0
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Preview failed')
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey, frameKey, mode, previewWidth, viewportW, viewportH])

  return (
    <div className={className}>
      <div className="flex max-h-[46vh] items-start justify-center overflow-auto rounded-xl border border-slate-800/70 bg-[#05080F] p-3">
        {error ? (
          <p className="py-8 text-[11px] font-semibold text-red-400">Preview error: {error}</p>
        ) : (
          <canvas
            ref={canvasRef}
            className="block max-w-full rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
            aria-label="Export preview"
          />
        )}
      </div>
      <p className="mt-1.5 text-center font-mono text-[9px] font-semibold text-slate-500">
        {`${realSize.w} × ${realSize.h} px`} · preview shown at {size.w > 0 ? `${size.w} px` : '…'}
      </p>
    </div>
  )
}
