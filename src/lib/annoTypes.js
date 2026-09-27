// ============================================================================
// ANNOTATION TYPE REGISTRY
// ============================================================================
//
// The single source of truth for "what can be drawn" and "what can be edited
// about it". Before this file the inspector was a pile of `if (type === ...)`
// branches spread over MapCanvas and Sidebar, which is how new tools kept
// arriving with no way to change their colour.
//
// Every annotation type declares:
//   - how it is created while dragging (create mode)
//   - the default property bag written to the document
//   - which properties the inspector should offer, and in what order
//   - how it is hit-tested (point / polyline / box / circle / wedge / outline)
//
// The inspector renders whatever `props` lists, so adding a property to a type
// is a one-line change here and it shows up in BOTH the sidebar and the canvas
// inspector automatically.
//
// Coordinate rule for everything in this file: distances are METRES, angles are
// DEGREES in the UI and radians in the document, sizes are multipliers.
// ============================================================================

import {
  opacityOf,
  radiusOf,
  sizeOf,
  widthOf,
  annoBounds,
  fovCorners,
  pointInFov,
  distToPolyline,
  pointInBounds,
  worldToLocal,
  formatDistance,
  polylineLength,
} from './geometry'

/** Text weight options, matching the weights the renderer can request. */
export const FONT_WEIGHTS = [
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 500 },
  { label: 'Bold', value: 700 },
  { label: 'Black', value: 900 },
]

export const STROKE_PROP_DEFAULTS = { width: 3.5 }

/** Anchors a world point is close enough to count as a hit, in metres. */
const hitTolerance = (ppmZ) => 26 / Math.max(ppmZ, 1e-6)

// ---------------------------------------------------------------------------
// Property defaults
// ---------------------------------------------------------------------------

/**
 * Default property bag per type. `points` is added by the canvas at creation
 * time; everything here is what a freshly drawn object carries into the
 * document, into localStorage autosave, into share links and into exports.
 */
export const ANNO_DEFAULTS = {
  brush: { color: '#FBBF24', width: 3.5, opacity: 0.88, size: 1, rot: 0 },
  line: { color: '#FBBF24', width: 3.5, opacity: 1, size: 1, rot: 0 },
  arrow: { color: '#FACC15', width: 4, opacity: 1, size: 1, rot: 0 },
  arrow2: { color: '#00E5FF', width: 4, opacity: 1, size: 1, rot: 0 },
  rotation: { color: '#00E5FF', width: 4, opacity: 1, size: 1, rot: 0, dashed: true, label: '' },
  rect: { color: '#10B981', width: 2.5, opacity: 0.12, size: 1, rot: 0, label: '' },
  circle: { color: '#FACC15', width: 3.5, opacity: 0.12, size: 1, rot: 0, label: '' },
  danger: { color: '#EF4444', width: 2.5, opacity: 0.18, size: 1, rot: 0, r: 220, hatched: true, label: '' },
  fov: { color: '#38BDF8', width: 2, opacity: 0.22, size: 1, rot: 0, angle: 60, range: 420, label: '' },
  measure: { color: '#FFFFFF', width: 2, opacity: 1, size: 1, rot: 0, label: '' },
  text: { color: '#FBBF24', fontSize: 20, fontWeight: 700, opacity: 1, size: 1, rot: 0, label: 'Note', plainText: false },
  pin: { color: '#F97316', size: 1, opacity: 1, rot: 0, label: 'Pin' },
  player: { color: '#00E5FF', size: 1, opacity: 1, rot: 0, label: '' },
  vehicle: { color: '#94A3B8', size: 1, opacity: 1, rot: 0, open: true },
  team: { color: '#FACC15', size: 1, opacity: 1, rot: 0, showName: true },
  compound: { color: '#F97316', width: 2.5, opacity: 0.1, size: 1, rot: 0, label: '' },
  ridge: { color: '#F59E0B', width: 3, opacity: 1, size: 1, rot: 0, label: '' },
  smoke: { color: '#CBD5E1', width: 2, opacity: 0.35, size: 1, rot: 0, r: 15, label: '' },
  flight1: { color: '#EF4444', width: 4, opacity: 1, size: 1, rot: 0 },
  flight2: { color: '#A855F7', width: 4, opacity: 1, size: 1, rot: 0 },
}

// ---------------------------------------------------------------------------
// Inspector capabilities
// ---------------------------------------------------------------------------

// Order matters: this is the order the inspector renders controls in.
const COLOR = { key: 'color', kind: 'color' }
const OPACITY = { key: 'opacity', kind: 'opacity' }
const WIDTH = { key: 'width', kind: 'stroke' }
const SIZE = { key: 'size', kind: 'size' }
const ROTATION = { key: 'rot', kind: 'rotation' }
const LABEL = { key: 'label', kind: 'text' }
const FONT_SIZE = { key: 'fontSize', kind: 'fontSize' }
const FONT_WEIGHT = { key: 'fontWeight', kind: 'fontWeight' }
const PLAIN_TEXT = { key: 'plainText', kind: 'bool' }
const RADIUS = { key: 'r', kind: 'radius' }
const FOV_ANGLE = { key: 'angle', kind: 'fovAngle' }
const FOV_RANGE = { key: 'range', kind: 'fovRange' }
const DASHED = { key: 'dashed', kind: 'bool' }
const HATCHED = { key: 'hatched', kind: 'bool' }
const VEHICLE_OPEN = { key: 'open', kind: 'bool' }
const SHOW_NAME = { key: 'showName', kind: 'bool' }
const LOGO_URL = { key: 'logoUrl', kind: 'logoUrl' }

/**
 * Editable properties per annotation type.
 * Every type has at least colour / opacity / size / rotation, which is what
 * makes "every object has editable properties" true by construction rather than
 * by remembering to add a branch.
 */
export const ANNO_PROPS = {
  brush: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  line: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  arrow: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  arrow2: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  rotation: [LABEL, COLOR, OPACITY, WIDTH, SIZE, ROTATION, DASHED],
  rect: [LABEL, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  circle: [LABEL, RADIUS, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  danger: [LABEL, RADIUS, COLOR, OPACITY, WIDTH, SIZE, ROTATION, HATCHED],
  fov: [LABEL, FOV_RANGE, FOV_ANGLE, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  measure: [LABEL, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  text: [LABEL, FONT_SIZE, FONT_WEIGHT, COLOR, OPACITY, SIZE, ROTATION, PLAIN_TEXT],
  pin: [LABEL, COLOR, OPACITY, SIZE, ROTATION],
  player: [LABEL, COLOR, OPACITY, SIZE, ROTATION],
  vehicle: [VEHICLE_OPEN, COLOR, OPACITY, SIZE, ROTATION],
  // A team marker's COLOUR is deliberately absent: it comes from the team
  // roster (`getTeam(...).color`), so a colour control here would be an input
  // that silently does nothing. Opacity, size and rotation all genuinely apply.
  team: [LABEL, SHOW_NAME, LOGO_URL, OPACITY, SIZE, ROTATION],
  compound: [LABEL, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  ridge: [LABEL, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  smoke: [LABEL, RADIUS, COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  flight1: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
  flight2: [COLOR, OPACITY, WIDTH, SIZE, ROTATION],
}

/** Playzone circles get their own inspector (radius + outline colour). */
export const CIRCLE_PROPS = [{ key: 'r', kind: 'radius' }, COLOR, OPACITY, WIDTH, SIZE]

// ---------------------------------------------------------------------------
// Creation modes
// ---------------------------------------------------------------------------

/**
 * How each type is born while the user drags on the canvas.
 *
 *   point   one click, no drag (markers, smoke)
 *   seg     press, drag, release (everything defined by two endpoints)
 *   stroke  press and sweep (freehand pen, rotation path)
 *   select  not an annotation — it is an interaction mode
 */
export const CREATE_MODES = {
  POINT: 'point',
  SEG: 'seg',
  STROKE: 'stroke',
  SELECT: 'select',
}

/**
 * Per-type create mode + property capabilities. `mode` is what the canvas
 * switches on in `onPointerDown`; the 2-point types additionally need their
 * radius recomputed from the drag, which `withDefaults` seeds for us.
 */
export const ANNO_TYPES = {
  brush: { mode: CREATE_MODES.STROKE },
  line: { mode: CREATE_MODES.SEG },
  arrow: { mode: CREATE_MODES.SEG },
  arrow2: { mode: CREATE_MODES.SEG },
  rotation: { mode: CREATE_MODES.STROKE },
  rect: { mode: CREATE_MODES.SEG },
  compound: { mode: CREATE_MODES.SEG },
  ridge: { mode: CREATE_MODES.SEG },
  measure: { mode: CREATE_MODES.SEG },
  flight1: { mode: CREATE_MODES.SEG },
  flight2: { mode: CREATE_MODES.SEG },
  // Radius shapes are created by dragging out from the centre, so their `r`
  // comes from the drag distance rather than a default.
  circle: { mode: CREATE_MODES.SEG },
  danger: { mode: CREATE_MODES.SEG },
  fov: { mode: CREATE_MODES.SEG },
  smoke: { mode: CREATE_MODES.POINT },
  text: { mode: CREATE_MODES.POINT },
  pin: { mode: CREATE_MODES.POINT },
  player: { mode: CREATE_MODES.POINT },
  vehicle: { mode: CREATE_MODES.POINT },
  team: { mode: CREATE_MODES.POINT },
  select: { mode: CREATE_MODES.SELECT },
}

/** The drag distance, in metres, that must be exceeded for a two-point shape
 *  to be created. Without it, every stray tap drops a zero-length arrow. */
export const SEG_MIN_LENGTH = 5

/** Types whose `r` is the distance from the first point to the second. */
export const RADIUS_FROM_DRAG = new Set(['circle', 'danger', 'smoke'])

/** How should this type be created? Falls back to a freehand stroke. */
export function createMode(type) {
  return ANNO_TYPES[type]?.mode || CREATE_MODES.STROKE
}

/**
 * Read the capability list for a type.
 *
 * An unknown type gets NOTHING, not the brush list: offering a `width` control
 * for an object that has no stroke is a control that silently does nothing,
 * which is worse than not showing it.
 */
export function propsFor(type) {
  return ANNO_PROPS[type] || []
}

/**
 * The property KEYS a type exposes, in inspector order.
 * This is the common question — "can the user set colour on this?" — so it gets
 * a named helper rather than every caller writing `.map(p => p.key)`.
 */
export function propKeys(type) {
  return propsFor(type).map((p) => p.key)
}

/**
 * Merge a type's defaults into a new object.
 *
 * Accepts either form, because both are natural at the call sites:
 *   withDefaults('arrow', { color: '#f00' })
 *   withDefaults({ id, type: 'arrow', points, color: '#f00' })
 *
 * Layer order is defaults < annotation < patch, and **an explicit `undefined`
 * in a higher layer is treated as "not specified" rather than as a value.** That
 * distinction matters: `{ ...{ opacity: 0.12 }, ...{ opacity: undefined } }`
 * really does clobber the default, and a rect whose opacity went missing would
 * then be drawn at the renderer's fallback instead of its own 12%. Optional
 * fields are spread in constantly (`{ ...anno, label: maybeUndefined }`), so the
 * safe behaviour is the one enforced here.
 *
 * A value already on the annotation always wins over the default — that is what
 * makes this safe to run over a document restored from localStorage.
 */
export function withDefaults(typeOrAnno, patch = {}) {
  const anno = typeof typeOrAnno === 'string' ? null : typeOrAnno
  const type = typeof typeOrAnno === 'string' ? typeOrAnno : anno?.type
  const base = ANNO_DEFAULTS[type] || {}
  const defined = (o) => {
    const out = {}
    for (const [k, v] of Object.entries(o || {})) if (v !== undefined) out[k] = v
    return out
  }
  return { ...base, ...defined(anno), ...defined(patch) }
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

/** Types drawn as a polyline, tested by distance to the nearest segment. */
const POLYLINE_TYPES = new Set(['brush', 'line', 'arrow', 'arrow2', 'ridge', 'rotation', 'measure', 'flight1', 'flight2', 'flight'])
/** Types drawn as an axis-aligned / rotatable rectangle. */
const BOX_TYPES = new Set(['rect', 'compound'])
/** Types drawn as a world circle. */
const CIRCLE_TYPES = new Set(['circle', 'smoke', 'danger'])
/** Types anchored at a single point. */
const POINT_TYPES = new Set(['pin', 'player', 'vehicle', 'team', 'text', 'fov'])

/**
 * Did a world-space click land on this annotation?
 *
 * `ppmZ` is pixels-per-metre for the current view. It is converted to a
 * world-space tolerance so the hit area is a constant ~26 screen pixels whether
 * the user is zoomed to 100% or 1400%.
 *
 * @returns {number} 0 = miss, >0 = hit, larger = better hit (for tie-breaks)
 */
export function annoHitScore(a, wx, wy, ppmZ = 1) {
  if (!a || a.hidden) return 0
  const tol = hitTolerance(ppmZ)
  const [lx, ly] = worldToLocal(a, wx, wy)
  const pts = a.points || []

  if (a.type === 'fov') {
    // `fovCorners` is in local space, so the click has to be tested in local
    // space too — `lx/ly` is already `worldToLocal` of the click.
    const c = fovCorners(a)
    // Edges score higher than the filled body. A vision cone can be 400 m
    // across, and a filled shape that large would otherwise swallow every click
    // meant for whatever is behind it.
    if (distToPolyline(lx, ly, [c[0], c[1], c[3]]) <= tol) return 2.5
    if (distToPolyline(lx, ly, [c[1], c[2], c[3]]) <= tol) return 2
    if (pointInFov(a, lx, ly)) return 1
    return 0
  }

  if (POINT_TYPES.has(a.type)) {
    const [px, py] = pts[0]
    const d = a.type === 'text' || a.type === 'team' ? boxScore(annoBounds(a), lx, ly) : Math.hypot(lx - px, ly - py)
    if (d <= tol) return 1
    return 0
  }

  if (a.type === 'danger' && a.outline) {
    if (distToPolyline(lx, ly, closeLoop(pts)) <= tol) return 2
    return 0
  }

  if (CIRCLE_TYPES.has(a.type)) {
    const [cx, cy] = pts[0]
    const r = radiusOf(a) || 0
    const d = Math.hypot(lx - cx, ly - cy)
    if (Math.abs(d - r) <= tol) return 2
    if (d <= r) return 1
    return 0
  }

  if (BOX_TYPES.has(a.type) && pts.length > 1) {
    const b = rectBox(pts[0], pts[1])
    if (pointInBounds(lx, ly, b)) return 1
    if (distToPolyline(lx, ly, [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY], [b.minX, b.minY]]) <= tol) return 2
    return 0
  }

  if (POLYLINE_TYPES.has(a.type) && pts.length > 1) {
    const d = distToPolyline(lx, ly, pts)
    // A generous box around text/measure keeps them easy to grab.
    if (a.type === 'measure' && d > tol && pointInBounds(lx, ly, annoBounds(a))) return 1
    return d <= tol ? 2 : 0
  }

  if (pts.length >= 1) {
    const [px, py] = pts[0]
    return Math.hypot(lx - px, ly - py) <= tol ? 1 : 0
  }
  return 0
}

const fovRangeSafe = (a) => (typeof a?.range === 'number' && a.range > 0 ? a.range : 400)

/** Distance outside a box; 0 when inside. Used for text hitboxes. */
function boxScore(b, lx, ly) {
  const insideX = lx >= b.minX && lx <= b.maxX
  const insideY = ly >= b.minY && ly <= b.maxY
  if (insideX && insideY) return 0
  return Math.hypot(
    insideX ? 0 : Math.min(Math.abs(lx - b.minX), Math.abs(lx - b.maxX)),
    insideY ? 0 : Math.min(Math.abs(ly - b.minY), Math.abs(ly - b.maxY)),
  )
}

const rectBox = (a, b) => ({
  minX: Math.min(a[0], b[0]),
  minY: Math.min(a[1], b[1]),
  maxX: Math.max(a[0], b[0]),
  maxY: Math.max(a[1], b[1]),
})

/** Close a freeform outline so hatching has a ring to follow. */
const closeLoop = (pts) => (pts.length > 1 ? [...pts, pts[0]] : pts)

/**
 * Topmost annotation under a world point.
 *
 * Later entries in the array paint on top, so we walk backwards and return the
 * first real hit. `list` is the visible layer list.
 */
export function pickAnno(list, wx, wy, ppmZ = 1) {
  if (!list || !list.length) return null
  let best = null
  let bestScore = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const score = annoHitScore(list[i], wx, wy, ppmZ)
    if (score > bestScore) {
      bestScore = score
      best = list[i]
      if (score >= 2) break
    }
  }
  return best
}

/** Topmost playzone circle under a world point (smallest radius wins). */
export function pickCircle(circles, wx, wy, ppmZ = 1, preferId = null) {
  if (!circles || !circles.length) return null
  const minR = hitTolerance(ppmZ)
  if (preferId) {
    const chosen = circles.find((c) => c.id === preferId)
    if (chosen && Math.hypot(wx - chosen.x, wy - chosen.y) <= Math.max(chosen.r, minR)) return chosen
  }
  const sorted = [...circles].sort((a, b) => a.r - b.r)
  for (const c of sorted) {
    if (Math.hypot(wx - c.x, wy - c.y) <= Math.max(c.r, minR)) return c
  }
  return null
}

// ---------------------------------------------------------------------------
// Readouts shown in the inspector header
// ---------------------------------------------------------------------------

/** One-line description of an object's geometry, e.g. "1.24km" or "⌀ 440m". */
export function annoReadout(a) {
  const pts = a?.points || []
  if (a?.type === 'circle' || a?.type === 'smoke' || a?.type === 'danger') return `⌀ ${formatDistance(radiusOf(a) * 2)}`
  if (a?.type === 'fov') return `${Math.round(a.angle || 60)}° · ${formatDistance(a.range || 400)}`
  if (pts.length > 1) return formatDistance(polylineLength(pts))
  if (pts.length === 1) return `${Math.round(pts[0][0])}m, ${Math.round(pts[0][1])}m`
  return '—'
}

/** Bounds of the selected circle, for the circle inspector header. */
export function circleBoundsReadout(c) {
  return `⌀ ${formatDistance((c.r || 0) * 2)}`
}
