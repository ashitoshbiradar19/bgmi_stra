// The live selection overlay: frame, resize handles and rotation pivot.
//
// WHY THIS IS A SEPARATE FILE, AND WHY IT IS NOT IN THE EXPORT
// -------------------------------------------------------------
// `renderScene()` is shared by the editor and the PNG exporter, which is what
// stops the two from drifting apart. But a selection frame is editor chrome:
// exporting a picture of cyan squares around an arrow would be a bug, not a
// feature. So the overlay lives here instead of inside `renderScene`, is drawn
// by `MapCanvas` on a separate pass AFTER the scene, and no export path calls
// it. The geometry comes from `lib/selection.js` — the very same module the
// pointer uses to pick a handle — so the frame cannot drift away from the thing
// it is framing, and what you grab is what you see.
//
// All coordinates arrive already projected to screen pixels (`X`/`Y` closures
// over the view), which is how `drawAnno` is fed too. Sizes are in SCREEN pixels
// multiplied by `S`, so the overlay stays a constant visual weight at any zoom
// and still matches an export-scale screenshot.

import { frameCorners, allHandles, isRadiusHandle, isRadiusType } from './selection.js'
import { pivotOf } from './geometry.js'

/** Half the handle square, in screen pixels. */
export const HANDLE_PX = 4.5
/** Rotation-pip radius, in screen pixels. */
export const PIVOT_PX = 5

const FRAME_COLOR = '#00E5FF'
const HANDLE_FILL = '#00E5FF'
const HANDLE_EDGE = '#070A0F'
const PIVOT_COLOR = '#FBBF24'
const RADIUS_HANDLE_COLOR = '#FACC15'

/**
 * Draw the selection overlay for a single annotation.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} a       the selected annotation (world metres)
 * @param {(m:number)=>number} X  world metre -> screen x
 * @param {(m:number)=>number} Y  world metre -> screen y
 * @param {object} [opts]
 * @param {number} [opts.S=1]  scale factor, so the overlay matches export scale
 * @param {boolean} [opts.showHandles=true]  hide the handles while dragging a
 *        handle itself, so the grip you are holding does not jump around
 * @param {boolean} [opts.showPivot=true]
 */
export function drawSelectionOverlay(ctx, a, X, Y, opts = {}) {
  if (!a || !a.points || !a.points.length) return
  const { S = 1, showHandles = true, showPivot = true } = opts
  const hs = HANDLE_PX * S

  ctx.save()
  ctx.lineJoin = 'miter'

  // --- frame -----------------------------------------------------------------
  // Drawn through the rotated corners rather than an axis-aligned rect, so a
  // rotated object is framed by a frame that is rotated with it.
  const corners = frameCorners(a)
  if (corners && corners.length >= 3) {
    ctx.beginPath()
    ctx.moveTo(X(corners[0][0]), Y(corners[0][1]))
    for (let i = 1; i < corners.length; i++) ctx.lineTo(X(corners[i][0]), Y(corners[i][1]))
    ctx.closePath()
    ctx.setLineDash([4 * S, 3 * S])
    ctx.lineWidth = Math.max(1, 1.25 * S)
    ctx.strokeStyle = FRAME_COLOR
    ctx.stroke()
    ctx.setLineDash([])
  }

  // --- resize handles --------------------------------------------------------
  if (showHandles) {
    for (const [hx, hy, idx] of allHandles(a)) {
      const sx = X(hx)
      const sy = Y(hy)
      // Radius shapes get a different colour: on a circle the corners are
      // meaningless as resize targets, so they are shown as radius grips.
      const isRadiusGrip = isRadiusHandle(a, idx) || isRadiusType(a)
      ctx.beginPath()
      ctx.rect(sx - hs, sy - hs, hs * 2, hs * 2)
      ctx.fillStyle = isRadiusGrip ? RADIUS_HANDLE_COLOR : HANDLE_FILL
      ctx.fill()
      ctx.lineWidth = Math.max(1, 1 * S)
      ctx.strokeStyle = HANDLE_EDGE
      ctx.stroke()
    }
  }

  // --- rotation pivot --------------------------------------------------------
  // Drawn last and on top: it sits near the middle of most objects, so anything
  // else would hide the one thing you need to see to rotate.
  if (showPivot) {
    const [px, py] = pivotOf(a)
    const sx = X(px)
    const sy = Y(py)
    ctx.beginPath()
    ctx.arc(sx, sy, PIVOT_PX * S, 0, Math.PI * 2)
    ctx.fillStyle = PIVOT_COLOR
    ctx.fill()
    ctx.lineWidth = Math.max(1, 1.25 * S)
    ctx.strokeStyle = HANDLE_EDGE
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Draw the overlay for a whole selection.
 *
 * `annos` may be a single id (the common case) or several, for a future
 * multi-select. A multi-select of mixed types would need a union box, which is
 * deliberately NOT faked here: pretending to support it with per-object frames
 * would let you drag one and appear to move all of them.
 *
 * @param {object} opts
 * @param {string|string[]} opts.selectedId
 * @param {object[]} opts.annos
 */
export function drawSelectionOverlays(ctx, X, Y, opts = {}) {
  const { selectedId, annos = [], ...rest } = opts
  if (!selectedId) return
  const ids = Array.isArray(selectedId) ? selectedId : [selectedId]
  for (const id of ids) {
    const a = annos.find((x) => x && x.id === id)
    if (a) drawSelectionOverlay(ctx, a, X, Y, rest)
  }
}
