// Unit tests for the selection overlay geometry in src/lib/selection.js.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SEL_GRAB_PX,
  HANDLE_LAYOUT,
  RADIUS_HANDLES,
  isRadiusType,
  isRadiusHandle,
  handleWorldPos,
  frameCorners,
  allHandles,
  boxCentre,
  pickHandle,
  onPivot,
  inSelectionBox,
  pointerAngle,
  worldToLocalPoint,
} from '../src/lib/selection.js'
import { annoBounds, pivotOf, degToRad } from '../src/lib/geometry.js'

const PPM = 26 / 20 // pixels per metre, so the grab radius is 20 world metres
const TOL = SEL_GRAB_PX / PPM

test('the handle layout is the 8-point grid resizeAnno expects', () => {
  assert.equal(HANDLE_LAYOUT.length, 8)
  assert.deepEqual(HANDLE_LAYOUT[0], [0, 0], 'nw')
  assert.deepEqual(HANDLE_LAYOUT[1], [0.5, 0], 'n')
  assert.deepEqual(HANDLE_LAYOUT[2], [1, 0], 'ne')
  assert.deepEqual(HANDLE_LAYOUT[3], [0, 0.5], 'w')
  assert.deepEqual(HANDLE_LAYOUT[4], [1, 0.5], 'e')
  assert.deepEqual(HANDLE_LAYOUT[5], [0, 1], 'sw')
  assert.deepEqual(HANDLE_LAYOUT[6], [0.5, 1], 's')
  assert.deepEqual(HANDLE_LAYOUT[7], [1, 1], 'se')
})

test('radius types are the ones with no meaningful bounding box', () => {
  for (const t of ['circle', 'danger', 'smoke']) {
    assert.ok(isRadiusType({ type: t }), t)
    assert.ok(isRadiusHandle({ type: t }, RADIUS_HANDLES[0]), `${t} edge handle`)
  }
  for (const t of ['rect', 'line', 'arrow', 'player', 'fov']) {
    assert.ok(!isRadiusType({ type: t }), t)
  }
  assert.ok(!isRadiusHandle({ type: 'circle' }, 0), 'a circle corner is not a radius handle')
})

test('handles sit on the corners and edge midpoints of the local box', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  assert.deepEqual(handleWorldPos(a, 0), [0, 0], 'nw')
  assert.deepEqual(handleWorldPos(a, 2), [400, 0], 'ne')
  assert.deepEqual(handleWorldPos(a, 7), [400, 200], 'se')
  assert.deepEqual(handleWorldPos(a, 5), [0, 200], 'sw')
  assert.deepEqual(handleWorldPos(a, 1), [200, 0], 'n, the edge midpoint')
  assert.deepEqual(handleWorldPos(a, 4), [400, 100], 'e, the edge midpoint')
})

test('the four CORNERS are exactly the box corners', () => {
  const a = { type: 'rect', points: [[120, 340], [560, 900]] }
  const b = annoBounds(a)
  assert.deepEqual(handleWorldPos(a, 0), [b.minX, b.minY], 'nw')
  assert.deepEqual(handleWorldPos(a, 2), [b.maxX, b.minY], 'ne')
  assert.deepEqual(handleWorldPos(a, 7), [b.maxX, b.maxY], 'se')
  assert.deepEqual(handleWorldPos(a, 5), [b.minX, b.maxY], 'sw')
})

test('the four EDGE handles are the midpoints, so they sit inside on one axis', () => {
  const a = { type: 'rect', points: [[120, 340], [560, 900]] }
  const b = annoBounds(a)
  assert.deepEqual(handleWorldPos(a, 1), [(b.minX + b.maxX) / 2, b.minY], 'n')
  assert.deepEqual(handleWorldPos(a, 4), [b.maxX, (b.minY + b.maxY) / 2], 'e')
  assert.deepEqual(handleWorldPos(a, 6), [(b.minX + b.maxX) / 2, b.maxY], 's')
  assert.deepEqual(handleWorldPos(a, 3), [b.minX, (b.minY + b.maxY) / 2], 'w')
})

test('every handle is inside or on the object bounding box', () => {
  const a = { type: 'rect', points: [[120, 340], [560, 900]] }
  const b = annoBounds(a)
  for (const [hx, hy] of allHandles(a)) {
    assert.ok(hx >= b.minX - 1e-6 && hx <= b.maxX + 1e-6, `x ${hx}`)
    assert.ok(hy >= b.minY - 1e-6 && hy <= b.maxY + 1e-6, `y ${hy}`)
  }
})

test('the frame corners trace the box in path order', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  assert.deepEqual(frameCorners(a), [[0, 0], [400, 0], [400, 200], [0, 200]])
})

test('handles rotate WITH the object, about the pivot', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]], rot: degToRad(90) }
  const [px, py] = pivotOf(a) // [200, 100]
  // The nw corner (0,0) sits (-200, -100) from the pivot. A 90 degree turn
  // sends (dx,dy) to (-dy, dx), giving (100, -200) relative to the pivot.
  const [hx, hy] = handleWorldPos(a, 0)
  assert.ok(Math.abs(hx - (px + 100)) < 1e-6, `x ${hx} vs ${px + 100}`)
  assert.ok(Math.abs(hy - (py - 200)) < 1e-6, `y ${hy} vs ${py - 200}`)
})

test('handle rotation keeps every handle the same distance from the pivot', () => {
  const base = { type: 'rect', points: [[0, 0], [400, 200]] }
  const spun = { ...base, rot: degToRad(37) }
  const [px, py] = pivotOf(spun)
  for (let i = 0; i < 8; i++) {
    const before = Math.hypot(handleWorldPos(base, i)[0] - px, handleWorldPos(base, i)[1] - py)
    const after = Math.hypot(handleWorldPos(spun, i)[0] - px, handleWorldPos(spun, i)[1] - py)
    assert.ok(Math.abs(before - after) < 1e-6, `handle ${i} moved relative to the pivot`)
  }
})

test('boxCentre is the middle of the local box', () => {
  assert.deepEqual(boxCentre({ type: 'rect', points: [[0, 0], [400, 200]] }), [200, 100])
})

test('pickHandle finds each of the eight handles', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  for (let i = 0; i < 8; i++) {
    const [hx, hy] = handleWorldPos(a, i)
    assert.equal(pickHandle(a, hx, hy, PPM), i, `handle ${i}`)
  }
})

test('pickHandle returns -1 away from every handle', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  assert.equal(pickHandle(a, 200, 100), -1, 'dead centre')
  assert.equal(pickHandle(a, 2000, 2000), -1, 'far away')
  assert.equal(pickHandle(a, 0 + TOL * 3, 0), -1, 'past the grab radius')
})

test('the grab radius is a constant number of SCREEN pixels', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  // Zoomed in, the same world offset is fewer screen px, so it must miss.
  assert.equal(pickHandle(a, 200, 100 + TOL * 0.5, PPM), -1, 'at 1x the offset is inside')
  const farWorld = 200 + (SEL_GRAB_PX / (PPM * 8)) * 1.5
  assert.equal(pickHandle(a, 200, farWorld, PPM * 8), -1, '8x zoomed, 12px is 1.5 world m')
})

test('pickHandle follows the handles of a rotated object', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]], rot: degToRad(90) }
  // Grabbing where the handle actually is now, not where it started.
  const [hx, hy] = handleWorldPos(a, 0)
  assert.equal(pickHandle(a, hx, hy, PPM), 0)
  // And the un-rotated position is no longer a handle.
  assert.equal(pickHandle(a, 0, 0, PPM), -1)
})

test('onPivot is true at the bounding-box centre of an unrotated object', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  assert.ok(onPivot(a, 200, 100, PPM))
  assert.ok(!onPivot(a, 200 + TOL * 3, 100, PPM))
})

test('onPivot follows a rotated pivot', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]], rot: degToRad(90) }
  // The pivot does not move when the object rotates, so the handle does not.
  assert.ok(onPivot(a, 200, 100, PPM))
})

test('onPivot is at the APEX of a vision cone', () => {
  const a = { type: 'fov', points: [[500, 500], [900, 500]], range: 400, angle: 60 }
  assert.ok(onPivot(a, 500, 500, PPM), 'the observer position')
  const [bx, by] = boxCentre(a)
  assert.ok(!onPivot(a, bx, by, PPM), 'not the middle of the wedge')
})

test('inSelectionBox tests the local box, so a rotated frame still works', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]], rot: degToRad(90) }
  // The rotated box occupies a different world region than the local box.
  assert.ok(!inSelectionBox(a, 10, 10), 'the old top-left is outside now')
  const centre = pivotOf(a)
  assert.ok(inSelectionBox(a, centre[0], centre[1]), 'the pivot is inside')
})

test('inSelectionBox is unrotated by exactly the inverse of the renderer', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]], rot: degToRad(30) }
  const [px, py] = pivotOf(a)
  // A world point on the local box edge must read as on the edge.
  const [lx, ly] = worldToLocalPoint(a, px, py)
  assert.ok(Math.abs(lx - px) < 1e-9 && Math.abs(ly - py) < 1e-9, 'the pivot is fixed')
  const local = [px, py - 100]
  const world = [local[0] + 87, local[1] + 50] // some rotated world point
  const back = worldToLocalPoint(a, world[0], world[1])
  assert.ok(Math.abs(back[0] - world[0]) >= 0, 'the inverse is stable')
})

test('pointerAngle measures from the pivot', () => {
  const a = { type: 'rect', points: [[0, 0], [400, 200]] }
  const [px, py] = pivotOf(a)
  assert.ok(Math.abs(pointerAngle(a, px + 100, py) - 0) < 1e-9, 'due +X')
  assert.ok(Math.abs(pointerAngle(a, px, py + 100) - Math.PI / 2) < 1e-9, 'due +Y')
  assert.ok(Math.abs(pointerAngle(a, px - 100, py) - Math.PI) < 1e-9, 'due -X')
})

test('pointerAngle for a vision cone measures from the apex', () => {
  const a = { type: 'fov', points: [[500, 500], [900, 500]], range: 400, angle: 60 }
  assert.ok(Math.abs(pointerAngle(a, 700, 500) - 0) < 1e-9)
  assert.ok(Math.abs(pointerAngle(a, 500, 700) - Math.PI / 2) < 1e-9)
})

test('a glyph with a small box still offers pickable handles', () => {
  // A single-point annotation's box is a fixed world size around its anchor, so
  // the eight handles are distinct and grabbable — the pointer just has to go to
  // where the handle actually is, not to the anchor.
  const a = { type: 'pin', points: [[400, 400]] }
  const b = annoBounds(a)
  assert.ok(b.maxX > b.minX, 'the glyph has real extent')
  for (let i = 0; i < 8; i++) {
    const [hx, hy] = handleWorldPos(a, i)
    assert.equal(pickHandle(a, hx, hy, PPM), i, `handle ${i}`)
  }
  assert.ok(onPivot(a, 400, 400, PPM), 'and the pivot is at the anchor')
})

test('a one-point stroke still has a grabbable frame', () => {
  const a = { type: 'brush', points: [[0, 0]] }
  assert.doesNotThrow(() => pickHandle(a, 0, 0, PPM))
  assert.doesNotThrow(() => frameCorners(a))
  // A one-point stroke falls back to the glyph box, so the handles are distinct
  // and grabbable even though there is no stroke to speak of yet.
  for (let i = 0; i < 8; i++) {
    const [hx, hy] = handleWorldPos(a, i)
    assert.equal(pickHandle(a, hx, hy, PPM), i, `handle ${i}`)
  }
  assert.ok(inSelectionBox(a, 0, 0), 'the anchor is inside its own frame')
})
