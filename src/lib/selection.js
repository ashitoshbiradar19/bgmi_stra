// ============================================================================
// SELECTION OVERLAY GEOMETRY
// ============================================================================
//
// The selection frame, its eight resize handles and the rotate pivot, all
// expressed in WORLD METRES. The canvas projects them to pixels to draw, and
// converts the pointer back to world metres to pick them — it already owns a
// `toWorld()` and duplicating that maths here would be a second source of truth
// for the single most important coordinate conversion in the app.
//
// Two rules make the frame trustworthy:
//
//  1. Handle positions come from `annoBounds`, the same box the renderer draws,
//     rotated by the same `pivotOf` pivot. When the frame and the object
//     disagree, it is always because something bypassed this file — so there is
//     exactly one place for that to go wrong, and it is covered by tests.
//
//  2. Handle PICKING uses a screen-pixel tolerance converted to world metres,
//     the same trick the annotation hit-tester uses. A handle therefore keeps
//     the same physical size on screen at every zoom level, which is what makes
//     it usable on a phone and on a 4K monitor alike.
//
// This is deliberately NOT part of `render.js`. The selection frame is editor
// chrome and must never reach the exported PNG. Keeping the geometry here and
// having `MapCanvas` draw it as a separate pass is what guarantees that.
// ============================================================================

import { annoBounds, pivotOf, rotatePoint, rotOf } from './geometry'

/** Handle radius in SCREEN pixels. */
export const SEL_HANDLE_R = 5
/** The rotate pivot is drawn larger so the two are distinguishable by eye. */
export const SEL_PIVOT_R = 6
/** How close, in screen pixels, a pointer must be to grab a handle. */
export const SEL_GRAB_PX = 12

/**
 * The eight resize handles, in the order the maths in `resizeAnno` expects.
 *   0 nw   1 n   2 ne
 *   3 w          4 e
 *   5 sw   6 s   7 se
 */
export const HANDLE_LAYOUT = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
]

/** The corner order used when stroking the frame as a closed path. */
export const FRAME_ORDER = [0, 2, 7, 5]

/** The four edge handles, which on a radius type stand in for "change radius". */
export const RADIUS_HANDLES = [1, 3, 4, 6]

/** Types that resize by dragging a radius rather than a bounding box. */
const RADIUS_TYPES = new Set(['circle', 'danger', 'smoke'])

/** Does this type resize by dragging a radius handle? */
export const isRadiusType = (a) => RADIUS_TYPES.has(a?.type)

/** Is this a handle index that adjusts the radius rather than a box edge? */
export const isRadiusHandle = (a, index) => isRadiusType(a) && RADIUS_HANDLES.includes(index)

/**
 * World-space position of one bounding-box corner, after the object's rotation.
 *
 * `index` is 0..7 per `HANDLE_LAYOUT`. The corner is interpolated inside the
 * LOCAL box and then rotated about the pivot, so handles on a rotated object
 * follow the object's own frame rather than the screen's.
 */
export function handleWorldPos(anno, index) {
  const b = annoBounds(anno)
  const [fx, fy] = HANDLE_LAYOUT[index] || [0, 0]
  const raw = [b.minX + (b.maxX - b.minX) * fx, b.minY + (b.maxY - b.minY) * fy]
  const rad = rotOf(anno)
  if (!rad) return raw
  const [px, py] = pivotOf(anno)
  return rotatePoint(raw[0], raw[1], px, py, rad)
}

/** The four world-space corners of the selection frame, in path order. */
export function frameCorners(anno) {
  return FRAME_ORDER.map((i) => handleWorldPos(anno, i))
}

/**
 * All eight handles in world space, as `[x, y, index]`, for drawing.
 *
 * The index is included because a caller cannot work it out any other way: the
 * overlay colours radius grips differently, and `isRadiusHandle(anno, index)`
 * needs exactly the index `handleWorldPos` was given. Returning it also keeps
 * the frame and the pick test reading the same numbers, so they cannot disagree
 * about which grip is which.
 *
 * Destructuring as `const [x, y] = handle` still works, so a caller that only
 * wants the position need not know about the third element.
 */
export function allHandles(anno) {
  return HANDLE_LAYOUT.map((_, index) => {
    const [x, y] = handleWorldPos(anno, index)
    return [x, y, index]
  })
}

/** Centre of the object's local box, i.e. the middle of the frame. */
export function boxCentre(anno) {
  const b = annoBounds(anno)
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]
}

/**
 * Which handle is under the pointer?
 *
 * @param {number} wx,wy pointer position in world metres
 * @param {number} ppmZ pixels-per-metre of the current view
 * @returns {number} handle index 0..7, or -1 for "not on a handle"
 */
export function pickHandle(anno, wx, wy, ppmZ, grabPx = SEL_GRAB_PX) {
  const tol = grabPx / Math.max(ppmZ, 1e-6)
  let best = -1
  let bestDist = tol
  for (let index = 0; index < HANDLE_LAYOUT.length; index++) {
    const [hx, hy] = handleWorldPos(anno, index)
    const d = Math.hypot(hx - wx, hy - wy)
    if (d <= bestDist) {
      bestDist = d
      best = index
    }
  }
  return best
}

/**
 * Is the pointer on the rotate pivot?
 *
 * A vision cone pivots on its apex, because that is where the observer stands.
 * Checked AFTER the handles by the caller, so a handle sitting on top of the
 * pivot still wins.
 */
export function onPivot(anno, wx, wy, ppmZ, grabPx = SEL_GRAB_PX) {
  const tol = grabPx / Math.max(ppmZ, 1e-6)
  const [px, py] = pivotOf(anno)
  return Math.hypot(px - wx, py - wy) <= tol
}

/**
 * Is the pointer inside the frame's interior?
 *
 * Used to choose between "resize" and "move" on the first pointerdown. The click
 * is un-rotated about the pivot before being tested against the local box, which
 * is what makes a rotated frame still behave like a frame.
 */
export function inSelectionBox(anno, wx, wy) {
  const [lx, ly] = worldToLocalPoint(anno, wx, wy)
  const b = annoBounds(anno)
  return lx >= b.minX && lx <= b.maxX && ly >= b.minY && ly <= b.maxY
}

/**
 * Angle, in world radians, of a pointer around the object's pivot.
 *
 * `rotateAnnoTo` needs this sampled at gesture START so the gesture applies a
 * delta. Without the start sample the object snaps to the pointer's angle the
 * instant the drag begins, which is the classic rotate-gesture bug.
 */
export function pointerAngle(anno, wx, wy) {
  const [px, py] = pivotOf(anno)
  return Math.atan2(wy - py, wx - px)
}

/**
 * Undo the object's own rotation for a world point, so a test can be made in the
 * object's local frame. A thin wrapper over `rotatePoint` that documents the
 * direction, so callers do not have to remember which sign to pass.
 */
export function worldToLocalPoint(anno, wx, wy) {
  const rad = rotOf(anno)
  if (!rad) return [wx, wy]
  const [px, py] = pivotOf(anno)
  return rotatePoint(wx, wy, px, py, -rad)
}
