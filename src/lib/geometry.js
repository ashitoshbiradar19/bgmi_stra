// ============================================================================
// WORLD-SPACE GEOMETRY
// ============================================================================
//
// Every drawing tool in this app stores its points in MAP METRES, never in
// screen pixels. That single rule is what makes drawings survive zoom, pan,
// window resize, fullscreen, responsive relayout and PNG export: the viewport
// only ever changes the projection `X(m) = m * Z + ox`, so re-projecting the
// same stored metres always lands in the right place.
//
// This module is the one place that knows how to ask questions about that data
// (where is this object, how big is it, did the user just click on it) and how
// to transform it (move / resize / rotate). Both the canvas and the hit-tester
// use these functions, which is what stops the selection box from drifting away
// from the thing it is supposed to be framing.
//
// Nothing in here touches React or the DOM, so it is directly unit-testable.
// ============================================================================

/** Rotation is stored on the annotation as `rot`, in RADIANS, clockwise. */
export const DEG = Math.PI / 180

/** Convert degrees (what the UI sliders speak) to radians (what we store). */
export const degToRad = (d) => (Number.isFinite(d) ? d * DEG : 0)
/** Convert stored radians back to the degrees the UI sliders display. */
export const radToDeg = (r) => (Number.isFinite(r) ? r / DEG : 0)

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Read an annotation's rotation, defaulting to 0 for objects created earlier. */
export function rotOf(anno) {
  return typeof anno?.rot === 'number' && Number.isFinite(anno.rot) ? anno.rot : 0
}

/**
 * Read an annotation's uniform size multiplier, defaulting to 1.
 * The renderer multiplies glyphs and strokes by this, so a brand new object and
 * a restored-from-localStorage object scale identically.
 */
export function sizeOf(anno) {
  const s = anno?.size
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 1
}

/** Read an annotation's opacity, defaulting to 1. */
export function opacityOf(anno) {
  const o = anno?.opacity
  return typeof o === 'number' && Number.isFinite(o) ? clamp(o, 0, 1) : 1
}

/** Read an annotation's stroke width, falling back to the type default. */
export function widthOf(anno, fallback = 3.5) {
  const w = anno?.width
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : fallback
}

/**
 * Read a radius-shaped annotation's world radius in metres.
 *
 * Two conventions exist in the wild and BOTH must keep working:
 *   - New objects store an explicit `r` (the inspector's radius slider sets it).
 *   - Every circle drawn by the original segment tool stores only two points
 *     and derives its radius from their distance.
 * So `r` wins when present, otherwise fall back to the two-point distance.
 * Returns 0 when neither applies, so callers can test it for falsiness.
 */
export function radiusOf(anno) {
  const r = anno?.r
  if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
  const p0 = anno?.points?.[0]
  const p1 = anno?.points?.[1]
  if (p0 && p1) {
    const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if (d > 0) return d
  }
  return 0
}

/**
 * The anchor every transform pivots around.
 *
 * Usually the object's bounding-box centre. A vision cone is the exception and
 * pivots on its APEX, because that is where the observer is standing: rotating
 * a cone about its box centre would slide the observer around the map, which is
 * never what a coach means by "rotate this". Every consumer (the renderer's
 * canvas transform, `worldToLocal` for hit-testing, and `resizeAnno`) goes
 * through here, so the apex rule is honoured everywhere at once.
 */
export function pivotOf(anno) {
  if (anno?.type === 'fov' && anno.points?.length) return [anno.points[0][0], anno.points[0][1]]
  const b = annoBounds(anno)
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]
}

/** Rotate a point about a pivot by `rad`. Pure maths, no state. */
export function rotatePoint(px, py, pivotX, pivotY, rad) {
  if (!rad) return [px, py]
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const dx = px - pivotX
  const dy = py - pivotY
  return [pivotX + dx * c - dy * s, pivotY + dx * s + dy * c]
}

/**
 * Map a point from "object space" into "world space".
 *
 * The renderer applies rotation with a canvas transform about the projected
 * pivot, so hit-testing has to undo exactly that: take the world point, rotate
 * it back by -rot around the pivot, and you are looking at the object the way
 * the user drew it.
 */
export function worldToLocal(anno, wx, wy) {
  const rad = rotOf(anno)
  if (!rad) return [wx, wy]
  const [px, py] = pivotOf(anno)
  return rotatePoint(wx, wy, px, py, -rad)
}

/** Shortest distance from a point to a line segment. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / l2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Distance from a point to the nearest point on a polyline. */
export function distToPolyline(px, py, pts) {
  if (!pts || !pts.length) return Infinity
  if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1])
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
    if (d < best) best = d
  }
  return best
}

/** Axis-aligned bounding box of a rectangle described by two corner points. */
function rectBoundsFrom(a, b) {
  return {
    minX: Math.min(a[0], b[0]),
    minY: Math.min(a[1], b[1]),
    maxX: Math.max(a[0], b[0]),
    maxY: Math.max(a[1], b[1]),
  }
}

/**
 * A generous local bounding box for a glyph marker (pin, player, vehicle,
 * squad logo). These are drawn around their anchor, not between two points, so
 * the box has to be a function of the marker size — and of the on-screen zoom,
 * because a 1x pin should still be clickable when zoomed right out.
 *
 * @param ppmZ pixels-per-metre of the current view, or 0 to skip the minimum.
 */
function glyphBounds(x, y, worldHalf, ppmZ) {
  const screenFloor = ppmZ > 0 ? 22 / ppmZ : 0
  const half = Math.max(worldHalf, screenFloor)
  return { minX: x - half, minY: y - half, maxX: x + half, maxY: y + half }
}

/**
 * World-space bounding box for any annotation or playzone circle.
 * Always returns a real box (never null) so callers can do arithmetic on it
 * without guarding every use.
 *
 * The box is the object's LOCAL (un-rotated) box — see `fovCorners()` for why.
 *
 * @param {object} a annotation or playzone circle
 * @param {number} ppmZ pixels-per-metre of the current view. Optional, but pass
 *   it from the canvas so a small marker is still grabbable when zoomed out.
 */
export function annoBounds(a, ppmZ = 0) {
  const pts = a?.points || []
  if (a && a.__isCircle) return circleBounds(a)
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  if (pts.length === 1) {
    const [x, y] = pts[0]
    // Point-ish objects still occupy real estate around their anchor.
    switch (a.type) {
      case 'circle':
      case 'smoke':
        return circleBounds({ x, y, r: radiusOf(a) })
      case 'pin':
        return glyphBounds(x, y, 26 * sizeOf(a), ppmZ)
      case 'player':
        return glyphBounds(x, y, 20 * sizeOf(a), ppmZ)
      case 'vehicle':
        return glyphBounds(x, y, 20 * sizeOf(a), ppmZ)
      case 'team':
        return glyphBounds(x, y, 34 * sizeOf(a), ppmZ)
      case 'fov':
        return fovBounds(a)
      case 'danger':
        return dangerBounds(a)
      default:
        return glyphBounds(x, y, 18, ppmZ)
    }
  }

  if (a.type === 'circle' || a.type === 'smoke' || a.type === 'danger') {
    return circleBounds({ x: pts[0][0], y: pts[0][1], r: radiusOf(a) })
  }
  if (a.type === 'fov') return fovBounds(a)

  if (a.type === 'rect' || a.type === 'compound') {
    return rectBoundsFrom(pts[0], pts[1])
  }

  if (a.type === 'text') {
    // Text width depends on the string, so approximate with a per-character
    // advance. It only feeds selection boxes and the pivot, so "close" is fine.
    const fs = a.fontSize || 20
    const chars = String(a.label || 'Note').length
    const halfW = Math.max(fs * 0.35, chars * fs * 0.3) * sizeOf(a)
    const halfH = fs * 0.75
    return { minX: pts[0][0] - halfW, minY: pts[0][1] - halfH, maxX: pts[0][0] + halfW, maxY: pts[0][1] + halfH }
  }

  if (a.type === 'measure') {
    // A measurement line is a line: use its two endpoints, widened a touch so
    // the caps and the readout are inside the box.
    const box = rectBoundsFrom(pts[0], pts[1])
    const pad = 14
    return { minX: box.minX - pad, minY: box.minY - pad, maxX: box.maxX + pad, maxY: box.maxY + pad }
  }

  // polylines: brush, line, arrow, arrow2, ridge, rotation, flight*
  return polylineBounds(pts)
}

/** Axis-aligned box around a list of world-space points. */
function polylineBounds(pts) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] > maxY) maxY = p[1]
  }
  return { minX, minY, maxX, maxY }
}

/** Bounding box of a world-space circle. */
export function circleBounds(c) {
  const r = Math.max(radiusOf(c), 0)
  return { minX: c.x - r, minY: c.y - r, maxX: c.x + r, maxY: c.y + r }
}

/**
 * Bounding box of a danger zone.
 *
 * Danger zones are authored as a centre + radius (like the existing circle
 * tool) so they can be resized from the same handle, but they may also hold a
 * freeform outline drawn with the pen. When there is an outline we use it.
 */
export function dangerBounds(a) {
  const pts = a.points || []
  if (pts.length > 1 && a.outline) return polylineBounds(pts)
  return circleBounds({ x: pts[0]?.[0] ?? 0, y: pts[0]?.[1] ?? 0, r: radiusOf(a) })
}

/**
 * Bounding box of a vision / FOV cone.
 * A wedge is not axis-aligned, so this returns the box of its four corners.
 */
export function fovBounds(a) {
  const [ax, ay] = a.points?.[0] || [0, 0]
  const [bx, by] = a.points?.[1] || a.points?.[0] || [ax, ay]
  const range = fovRange(a)
  const half = fovHalfAngle(a)
  const facing = fovFacing(a)
  const corners = [
    [ax, ay],
    [ax + Math.cos(facing - half) * range, ay + Math.sin(facing - half) * range],
    [ax + Math.cos(facing) * range, ay + Math.sin(facing) * range],
    [ax + Math.cos(facing + half) * range, ay + Math.sin(facing + half) * range],
  ]
  return {
    minX: Math.min(...corners.map((c) => c[0])),
    minY: Math.min(...corners.map((c) => c[1])),
    maxX: Math.max(...corners.map((c) => c[0])),
    maxY: Math.max(...corners.map((c) => c[1])),
  }
}

/** Length of the FOV cone in metres. */
export const fovRange = (a) => (typeof a?.range === 'number' && a.range > 0 ? a.range : 400)
/** Total opening of the FOV cone in radians. */
export const fovHalfAngle = (a) => degToRad((typeof a?.angle === 'number' && a.angle > 0 ? a.angle : 60) / 2)

/**
 * Direction the cone points, in world radians, in the object's LOCAL space
 * (i.e. before `rot`). Dragging sets the facing; the `rot` property then turns
 * the whole wedge about its bounding-box centre.
 */
export function fovFacing(a) {
  const [ax, ay] = a?.points?.[0] || [0, 0]
  const [bx, by] = a?.points?.[1] || [ax, ay]
  const dragAngle = Math.atan2(by - ay, bx - ax)
  return Number.isFinite(dragAngle) ? dragAngle : 0
}

/**
 * The four world-space corners of an FOV wedge in LOCAL space, apex first.
 *
 * `rot` is deliberately NOT applied here. The renderer sets up a canvas
 * transform for `rot` and then draws with these corners, so baking the
 * rotation in as well would apply it twice. The same reason means every
 * `annoBounds` for every type is the UN-ROTATED box: the pivot it produces is
 * what the canvas transform spins around, and keeping it rotation-independent
 * stops the pivot from drifting while the user rotates.
 */
export function fovCorners(a) {
  const [ax, ay] = a.points[0]
  const range = fovRange(a)
  const half = fovHalfAngle(a)
  const facing = fovFacing(a)
  return [
    [ax, ay],
    [ax + Math.cos(facing - half) * range, ay + Math.sin(facing - half) * range],
    [ax + Math.cos(facing) * range, ay + Math.sin(facing) * range],
    [ax + Math.cos(facing + half) * range, ay + Math.sin(facing + half) * range],
  ]
}

/**
 * Is a LOCAL-space point inside the wedge? Two conditions, both required:
 * within `range` of the apex, and within `angle`/2 of the facing direction.
 * The caller un-rotates the query point first (see `worldToLocal`).
 */
export function pointInFov(a, lx, ly) {
  const [ax, ay] = a.points[0]
  const d = Math.hypot(lx - ax, ly - ay)
  if (d > fovRange(a)) return false
  if (d < 1e-9) return true // the apex itself
  const off = Math.abs(normaliseAngle(Math.atan2(ly - ay, lx - ax) - fovFacing(a)))
  return off <= fovHalfAngle(a)
}

/** Wrap an angle into (-PI, PI] so angle differences can be compared directly. */
export function normaliseAngle(rad) {
  let a = rad
  while (a > Math.PI) a -= 2 * Math.PI
  while (a <= -Math.PI) a += 2 * Math.PI
  return a
}

/** True when a world point lies inside a world-space axis-aligned box. */
export function pointInBounds(wx, wy, b) {
  return wx >= b.minX && wx <= b.maxX && wy >= b.minY && wy <= b.maxY
}

// ============================================================================
// TRANSFORMS — all of these return a NEW annotation, never mutate
// ============================================================================

/** Deep-ish copy of an annotation. Points arrays are cloned so drags and
 *  undos can never share a reference with the live document. */
export function cloneAnno(a) {
  return { ...a, points: (a.points || []).map((p) => [p[0], p[1]]) }
}

/** Move every point by a world-space delta. */
export function translateAnno(a, dx, dy) {
  const next = cloneAnno(a)
  next.points = next.points.map((p) => [p[0] + dx, p[1] + dy])
  return next
}

/** Move a point marker (pin / player / text / squad logo) to an absolute spot. */
export function moveAnchor(a, x, y) {
  const next = cloneAnno(a)
  next.points[0] = [x, y]
  return next
}

/**
 * Resize by dragging one bounding-box handle.
 *
 * `handle` is a corner index 0..7, laid out as:
 *   0 nw   1 n   2 ne
 *   3 w         4 e
 *   5 sw   6 s   7 se
 * Handles on the edges move one axis only; corners move both.
 *
 * The maths works in the object's LOCAL (un-rotated) space so dragging a corner
 * of a rotated object still enlarges it symmetrically instead of shearing it.
 */
export function resizeAnno(a, handle, wx, wy) {
  const b = annoBounds(a)
  // Undo the object's own rotation so the handle maths is axis-aligned.
  const [lx, ly] = worldToLocal(a, wx, wy)

  let minX = b.minX
  let minY = b.minY
  let maxX = b.maxX
  let maxY = b.maxY
  const movesLeft = handle === 0 || handle === 3 || handle === 5
  const movesRight = handle === 2 || handle === 4 || handle === 7
  const movesTop = handle === 0 || handle === 1 || handle === 2
  const movesBottom = handle === 5 || handle === 6 || handle === 7

  if (movesLeft) minX = Math.min(lx, maxX - MIN_EXTENT)
  if (movesRight) maxX = Math.max(lx, minX + MIN_EXTENT)
  if (movesTop) minY = Math.min(ly, maxY - MIN_EXTENT)
  if (movesBottom) maxY = Math.max(ly, minY + MIN_EXTENT)

  const next = cloneAnno(a)

  if (a.type === 'text' || a.type === 'pin' || a.type === 'player' || a.type === 'vehicle' || a.type === 'team') {
    // Glyph anchors: keep the anchor in place and scale the glyph instead, so
    // the object never slides away from the spot the user pointed at.
    next.size = clampNum((a.size || 1) * scaleRatio(b, { minX, minY, maxX, maxY }), 0.2, 6)
    return next
  }

  if (a.type === 'circle' || a.type === 'smoke' || a.type === 'danger') {
    // Radius shapes scale about their anchor. Collapse to a single point + `r`
    // so the stored shape has ONE canonical representation: adding a second
    // point would make `annoBounds` treat it as a two-point line and drift.
    const [cx, cy] = a.points[0]
    const factor = scaleRatio(b, { minX, minY, maxX, maxY })
    next.r = Math.max(8, (radiusOf(a) || 8) * factor)
    next.points = [[cx, cy]]
    return next
  }

  if (a.type === 'fov') {
    const factor = scaleRatio(b, { minX, minY, maxX, maxY })
    next.range = Math.max(40, fovRange(a) * factor)
    return next
  }

  // Two-point shapes (line, arrow, rect, compound, measure, flight) and
  // polylines (brush, ridge, rotation): map every point through the same
  // axis-aligned remap of the old box onto the new one.
  //
  // This must be an EDGE remap, not a scale about the centre. Scaling about the
  // centre would leave the dragged corner short of the pointer, so releasing a
  // handle would visibly jump the object.
  const mapX = (x) => minX + (x - b.minX) * sx
  const mapY = (y) => minY + (y - b.minY) * sy
  const sx = (maxX - minX) / Math.max(1e-6, b.maxX - b.minX)
  const sy = (maxY - minY) / Math.max(1e-6, b.maxY - b.minY)
  next.points = next.points.map((p) => [mapX(p[0]), mapY(p[1])])
  return next
}

/**
 * Guard so a resize can never collapse an object to nothing, and can never
 * invert it (which would silently mirror the shape).
 *
 * The floor is 5 METRES because world units are metres on an 8000 m map. A
 * millimetre floor technically prevents a zero extent but still lets a user
 * squash a zone down to a hairline — an object that is effectively invisible,
 * hard to select again, and produces a divide-by-near-zero in `scaleRatio`.
 * 5 m is 0.06% of the map, so nothing is meaningfully constrained, but every
 * object stays selectable and drawable.
 */
const MIN_EXTENT = 5

/** How much bigger/smaller the dragged box is than the original, on average. */
function scaleRatio(before, after) {
  const bw = Math.max(1e-6, before.maxX - before.minX)
  const bh = Math.max(1e-6, before.maxY - before.minY)
  const aw = Math.max(1e-6, after.maxX - after.minX)
  const ah = Math.max(1e-6, after.maxY - after.minY)
  return (aw / bw + ah / bh) / 2
}

const clampNum = (v, lo, hi) => clamp(v, lo, hi)

/**
 * Set the object's rotation from a pointer position.
 *
 * `wx/wy` is where the pointer is (in world metres, already converted from
 * screen pixels by the canvas). `startPointerAngle` is the angle of the pointer
 * about the pivot at the moment the rotate gesture began, so the returned `rot`
 * is the object's existing rotation PLUS the drag delta. Passing the delta
 * rather than the raw pointer angle is what stops the object from snapping to
 * the pointer's angle the instant the gesture starts.
 */
export function rotateAnnoTo(a, wx, wy, startPointerAngle) {
  const [px, py] = pivotOf(a)
  const angle = Math.atan2(wy - py, wx - px)
  return { ...cloneAnno(a), rot: rotOf(a) + (angle - startPointerAngle) }
}

/** Copy an annotation with a brand new id, offset so it is visibly a copy. */
export function duplicateAnno(a, makeId, offsetMetres = 60) {
  const next = cloneAnno(a)
  next.id = makeId()
  next.points = next.points.map((p) => [p[0] + offsetMetres, p[1] + offsetMetres])
  return next
}

/** Human-readable distance label, e.g. 1.24km / 480m. */
export function formatDistance(metres) {
  if (!Number.isFinite(metres)) return '—'
  if (metres >= 1000) return `${(metres / 1000).toFixed(2)}km`
  return `${Math.round(metres)}m`
}

/** Length of a polyline in metres. */
export function polylineLength(pts) {
  if (!pts || pts.length < 2) return 0
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
  return total
}
