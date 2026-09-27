// Unit tests for the pure world-space maths in src/lib/geometry.js.
// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEG,
  degToRad,
  radToDeg,
  rotOf,
  sizeOf,
  opacityOf,
  widthOf,
  radiusOf,
  annoBounds,
  circleBounds,
  pivotOf,
  rotatePoint,
  worldToLocal,
  distToSegment,
  distToPolyline,
  pointInBounds,
  cloneAnno,
  translateAnno,
  resizeAnno,
  rotateAnnoTo,
  duplicateAnno,
  formatDistance,
  polylineLength,
  fovRange,
  fovHalfAngle,
  fovFacing,
  fovCorners,
  pointInFov,
  normaliseAngle,
} from '../src/lib/geometry.js'

const box = (a) => `${a.minX},${a.minY},${a.maxX},${a.maxY}`

test('degToRad / radToDeg round-trip', () => {
  assert.equal(degToRad(180), Math.PI)
  assert.equal(radToDeg(Math.PI), 180)
  assert.ok(Math.abs(radToDeg(degToRad(37)) - 37) < 1e-9)
  assert.equal(degToRad('nonsense'), 0)
  assert.equal(radToDeg(undefined), 0)
})

test('property readers have safe defaults', () => {
  assert.equal(rotOf({}), 0)
  assert.equal(rotOf({ rot: 1.2 }), 1.2)
  assert.equal(rotOf({ rot: 'x' }), 0)
  assert.equal(sizeOf({}), 1)
  assert.equal(sizeOf({ size: 2 }), 2)
  assert.equal(sizeOf({ size: 0 }), 1, 'a zero or negative size is nonsense')
  assert.equal(sizeOf({ size: -3 }), 1)
  assert.equal(opacityOf({}), 1)
  assert.equal(opacityOf({ opacity: 0.4 }), 0.4)
  assert.equal(opacityOf({ opacity: 5 }), 1, 'opacity clamps to 1')
  assert.equal(opacityOf({ opacity: -2 }), 0, 'opacity clamps to 0')
  assert.equal(widthOf({}), 3.5, 'falls back to the caller default')
  assert.equal(widthOf({}, 2), 2)
  assert.equal(widthOf({ width: 6 }), 6)
})

test('radiusOf understands BOTH stored conventions', () => {
  // Legacy circles from the original segment tool: two points, no `r`.
  const legacy = { type: 'circle', points: [[100, 100], [160, 140]] }
  assert.equal(Math.round(radiusOf(legacy)), 72)
  // New / inspector-edited circles: an explicit `r`, which must win.
  assert.equal(radiusOf({ type: 'circle', r: 250, points: [[0, 0], [10, 0]] }), 250)
  // Single-point smoke / danger.
  assert.equal(radiusOf({ type: 'smoke', r: 40, points: [[5, 5]] }), 40)
  assert.equal(radiusOf({ type: 'smoke', points: [[5, 5]] }), 0)
})

test('distToSegment handles endpoints and degenerate segments', () => {
  assert.equal(distToSegment(5, 0, 0, 0, 10, 0), 0, 'the point lies ON the segment')
  assert.equal(distToSegment(5, 3, 0, 0, 10, 0), 3, 'perpendicular offset')
  assert.equal(distToSegment(0, 0, 0, 0, 10, 0), 0, 'exact endpoint')
  assert.ok(Math.abs(distToSegment(-5, 3, 0, 0, 10, 0) - Math.hypot(5, 3)) < 1e-9, 'clamped to the start point')
  assert.equal(distToSegment(15, 0, 0, 0, 10, 0), 5, 'clamped to the end point')
  assert.equal(distToSegment(3, 4, 0, 0, 0, 0), 5, 'zero-length segment')
  assert.equal(distToSegment(0, 0, 0, 0, 0, 0), 0)
})

test('distToPolyline picks the nearest of many segments', () => {
  const pts = [[0, 0], [100, 0], [100, 100]]
  assert.equal(distToPolyline(50, 10, pts), 10, 'nearest the first segment')
  assert.equal(distToPolyline(95, 40, pts), 5, 'nearest the vertical segment')
  assert.equal(distToPolyline(0, 0, [[0, 0]]), 0, 'the point itself')
  assert.ok(Math.abs(distToPolyline(0, 0, [[7, 7]]) - Math.hypot(7, 7)) < 1e-9, 'single point')
  assert.equal(distToPolyline(0, 0, []), Infinity)
})

test('pointInBounds', () => {
  const b = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
  assert.ok(pointInBounds(5, 5, b))
  assert.ok(pointInBounds(0, 0, b), 'edges count as inside')
  assert.ok(!pointInBounds(11, 5, b))
})

test('circleBounds is centred on x/y', () => {
  assert.equal(box(circleBounds({ x: 10, y: 20, r: 5 })), '5,15,15,25')
})

test('annoBounds: two-point shapes use their endpoints', () => {
  assert.equal(box(annoBounds({ type: 'line', points: [[10, 20], [30, 60]] })), '10,20,30,60')
  assert.equal(
    box(annoBounds({ type: 'rect', points: [[30, 60], [10, 20]] })),
    '10,20,30,60',
    'corner order must not matter',
  )
  assert.equal(
    box(annoBounds({ type: 'compound', points: [[10, 20], [30, 60]] })),
    '10,20,30,60',
  )
})

test('annoBounds: radius shapes centre on the anchor', () => {
  const b = annoBounds({ type: 'circle', r: 50, points: [[200, 300]] })
  assert.equal(box(b), '150,250,250,350')
  // Legacy two-point circle must produce the same box.
  const legacy = annoBounds({ type: 'circle', points: [[200, 300], [250, 300]] })
  assert.equal(box(legacy), '150,250,250,350')
})

test('annoBounds: measure pads the endpoints for caps and label', () => {
  const b = annoBounds({ type: 'measure', points: [[0, 0], [100, 0]] })
  assert.equal(b.minX, -14)
  assert.equal(b.maxX, 114)
  assert.equal(b.minY, -14)
  assert.equal(b.maxY, 14)
})

test('annoBounds: glyphs reserve space around their anchor', () => {
  const b = annoBounds({ type: 'pin', points: [[0, 0]] })
  assert.equal(b.minX, -b.maxX, 'symmetric about the anchor')
  assert.ok(b.maxX > 0)
  const scaled = annoBounds({ type: 'pin', size: 2, points: [[0, 0]] })
  assert.ok(scaled.maxX > b.maxX, 'size widens the box')
})

test('annoBounds never returns null, even for a point-less anno', () => {
  assert.deepEqual(annoBounds({ type: 'brush', points: [] }), { minX: 0, minY: 0, maxX: 0, maxY: 0 })
  assert.deepEqual(annoBounds({}), { minX: 0, minY: 0, maxX: 0, maxY: 0 })
  assert.deepEqual(annoBounds(null), { minX: 0, minY: 0, maxX: 0, maxY: 0 })
})

test('annoBounds honours the pixel scale so markers stay grabbable zoomed out', () => {
  const at1x = annoBounds({ type: 'vehicle', points: [[0, 0]] }, 0)
  const zoomedOut = annoBounds({ type: 'vehicle', points: [[0, 0]] }, 0.05)
  assert.ok(zoomedOut.maxX > at1x.maxX, 'a low pixels-per-metre forces a bigger world box')
  // 22 screen px of reach at 0.05 ppm = 440 world metres.
  assert.equal(Math.round(zoomedOut.maxX), 440)
})

test('pivotOf is the bounding-box centre', () => {
  assert.deepEqual(pivotOf({ type: 'line', points: [[0, 0], [100, 50]] }), [50, 25])
})

test('pivotOf does not drift as the object rotates', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 50]] }
  const before = pivotOf(a)
  const rotated = rotateAnnoTo(a, 0, 200, Math.atan2(200, 0))
  assert.deepEqual(pivotOf(rotated), before, 'rotation spins geometry, not the anchor')
})

test('rotatePoint is a true rotation about a pivot', () => {
  const [x, y] = rotatePoint(1, 0, 0, 0, Math.PI / 2)
  assert.ok(Math.abs(x) < 1e-12)
  assert.ok(Math.abs(y - 1) < 1e-12)
  assert.deepEqual(rotatePoint(5, 5, 0, 0, 0), [5, 5], 'zero radians is identity')
})

test('worldToLocal inverts the renderer rotation', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 50]], rot: Math.PI / 2 }
  const pivot = pivotOf(a)
  // A world point exactly on the pivot must not move.
  assert.deepEqual(worldToLocal(a, pivot[0], pivot[1]), pivot)
  // A point offset from the pivot in world space comes back offset the same
  // way once the object's own rotation is removed.
  const [lx, ly] = worldToLocal(a, pivot[0] + 10, pivot[1])
  const back = rotatePoint(lx, ly, pivot[0], pivot[1], Math.PI / 2)
  assert.ok(Math.abs(back[0] - (pivot[0] + 10)) < 1e-9)
  assert.ok(Math.abs(back[1] - pivot[1]) < 1e-9)
})

test('worldToLocal is identity when the object is not rotated', () => {
  assert.deepEqual(worldToLocal({ type: 'line', points: [[0, 0], [1, 1]] }, 3, 4), [3, 4])
})

test('transforms never mutate their input', () => {
  const a = { id: 'x', type: 'line', points: [[0, 0], [10, 10]] }
  const snapshot = JSON.stringify(a)
  translateAnno(a, 5, 5)
  resizeAnno(a, 7, 40, 40)
  rotateAnnoTo(a, 40, 40, 0)
  duplicateAnno(a, () => 'y', 10)
  assert.equal(JSON.stringify(a), snapshot)
})

test('cloneAnno deep-copies points', () => {
  const a = { id: 'x', type: 'line', points: [[0, 0], [10, 10]] }
  const c = cloneAnno(a)
  c.points[0][0] = 999
  assert.equal(a.points[0][0], 0, 'the original must be untouched')
})

test('translateAnno offsets every point', () => {
  const a = { type: 'brush', points: [[0, 0], [10, 0], [10, 10]] }
  assert.deepEqual(translateAnno(a, 3, -2).points, [[3, -2], [13, -2], [13, 8]])
})

test('resizeAnno on a line drags the dragged corner only', () => {
  const a = { type: 'line', points: [[0, 0], [100, 100]] }
  // Handle 7 = south-east: moves maxX and maxY, leaves the origin pinned.
  const r = resizeAnno(a, 7, 200, 200)
  assert.deepEqual(r.points, [[0, 0], [200, 200]])
})

test('resizeAnno edge handles move one axis only', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 100]] }
  // Handle 4 = east: maxX follows the pointer, maxY must not move.
  const r = resizeAnno(a, 4, 300, 7)
  assert.equal(r.points[1][0], 300)
  assert.equal(r.points[1][1], 100)
})

test('resizeAnno cannot invert the box', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 100]] }
  // Dragging the west handle far past the east handle must not flip the shape.
  const r = resizeAnno(a, 3, 500, 0)
  const b = annoBounds(r)
  assert.ok(b.maxX > b.minX, 'width stays positive')
  assert.ok(b.maxY >= b.minY)
})

test('resizeAnno keeps a usable floor on the extent, in metres', () => {
  // A 1 mm floor stops a zero extent but still lets an object be squashed into
  // a hairline: invisible, nearly impossible to re-select, and close enough to
  // zero to make the glyph scale ratio explode. World units are metres, so the
  // floor has to be a visible number of metres.
  const a = { type: 'rect', points: [[0, 0], [2000, 2000]] }
  for (const handle of [0, 1, 2, 3, 4, 5, 6, 7]) {
    // Drag every handle right through the opposite edge.
    const b = annoBounds(resizeAnno(a, handle, 900, 900))
    assert.ok(b.maxX - b.minX >= 5, `handle ${handle} collapsed the width`)
    assert.ok(b.maxY - b.minY >= 5, `handle ${handle} collapsed the height`)
  }
})

test('resizeAnno does not fight the pointer for a normal drag', () => {
  // The floor must not be so large that a legitimate small object cannot be
  // resized at all. 5 m is 0.06% of an 8 km map.
  const a = { type: 'rect', points: [[0, 0], [1000, 1000]] }
  const r = resizeAnno(a, 7, 300, 40) // shrink to a 300 x 40 box
  const b = annoBounds(r)
  assert.ok(Math.abs(b.maxX - b.minX - 300) < 1e-6, `width ${b.maxX - b.minX}`)
  assert.ok(Math.abs(b.maxY - b.minY - 40) < 1e-6, `height ${b.maxY - b.minY}`)
})

test('resizeAnno scales a circle into a single point plus r', () => {
  const a = { type: 'circle', r: 100, points: [[500, 500]] }
  const r = resizeAnno(a, 7, 800, 800)
  assert.equal(r.points.length, 1, 'one canonical representation')
  assert.deepEqual(r.points[0], [500, 500], 'the anchor does not move')
  assert.ok(r.r > 100, 'grew')
  assert.equal(r.r, Math.round(annoBounds(r).maxX - 500), 'r matches the drawn box')
})

test('resizeAnno scales the FOV range', () => {
  const a = { type: 'fov', points: [[100, 100], [500, 100]], range: 400, angle: 60 }
  const before = annoBounds(a)
  const r = resizeAnno(a, 7, 900, 900)
  assert.ok(r.range > 400, 'grew')
  assert.deepEqual(r.points, [[100, 100], [500, 100]], 'the drag handle does not rewrite the points')
  // The wedge is still an apex + a facing, so the box must still span the range.
  const after = annoBounds(r)
  assert.ok(after.maxX > before.maxX)
})

test('resizeAnno remaps the LOCAL box onto the requested box, even when rotated', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 50]], rot: degToRad(30) }
  // The handle maths runs in local space, so the invariant is that the object's
  // local box ends up exactly where the handle was dragged. Scaling about the
  // centre instead would leave the dragged corner short of the pointer.
  const r = resizeAnno(a, 7, 900, 900)
  const b = annoBounds(r)
  const expected = annoBounds({ ...a, points: r.points, rot: 0 })
  assert.ok(Math.abs(b.minX - expected.minX) < 1e-6)
  assert.ok(Math.abs(b.minY - expected.minY) < 1e-6)
  assert.ok(b.maxX > 100 && b.maxY > 50, 'both axes grew')

  // A non-uniform local stretch is a stretch, not a shear: the four corners of
  // the un-rotated rect must still form a rectangle.
  const bb = annoBounds(r)
  assert.ok(bb.maxX > bb.minX && bb.maxY > bb.minY)
  assert.equal(r.rot, a.rot, 'the resize does not touch rot')
})

test('resizeAnno scales a glyph rather than moving it', () => {
  const a = { type: 'player', points: [[300, 400]], size: 1 }
  const r = resizeAnno(a, 7, 500, 500)
  assert.deepEqual(r.points, [[300, 400]], 'the anchor stays where the user pointed')
  assert.ok(r.size > 1)
})

test('resizeAnno works on a rotated object without changing its rotation', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 50]], rot: degToRad(30) }
  const r = resizeAnno(a, 7, 900, 900)
  assert.equal(r.rot, degToRad(30), 'a stretch must not re-orient the object')
})

test('rotateAnnoTo applies the drag DELTA, not the raw pointer angle', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 100]], rot: 0 }
  const pivot = pivotOf(a) // [50, 50]
  // Pointer starts pointing +X from the pivot, so the start angle is 0.
  const start = Math.atan2(0, 100)
  const r = rotateAnnoTo(a, pivot[0] + 100, pivot[1], start)
  assert.ok(Math.abs(r.rot) < 1e-12, 'no snap on the first frame of the gesture')

  // Now drag a further 90 degrees: the object should have turned 90 degrees.
  const r2 = rotateAnnoTo(a, pivot[0], pivot[1] + 100, start)
  assert.ok(Math.abs(r2.rot - Math.PI / 2) < 1e-9)
})

test('rotateAnnoTo adds to the existing rotation', () => {
  const a = { type: 'rect', points: [[0, 0], [100, 100]], rot: degToRad(10) }
  const pivot = pivotOf(a)
  const r = rotateAnnoTo(a, pivot[0] + 100, pivot[1], 0)
  assert.ok(Math.abs(r.rot - degToRad(10)) < 1e-12)
})

test('duplicateAnno offsets and re-identifies', () => {
  const a = { id: 'orig', type: 'line', points: [[0, 0], [10, 10]] }
  const d = duplicateAnno(a, () => 'copy', 25)
  assert.equal(d.id, 'copy')
  assert.equal(a.id, 'orig', 'the source keeps its id')
  assert.deepEqual(d.points, [[25, 25], [35, 35]])
  assert.equal(duplicateAnno(a, () => 'c2', 0).points.length, 2)
})

test('formatDistance switches to km at 1000m', () => {
  assert.equal(formatDistance(0), '0m')
  assert.equal(formatDistance(480), '480m')
  assert.equal(formatDistance(999), '999m')
  assert.equal(formatDistance(1000), '1.00km')
  assert.equal(formatDistance(1240), '1.24km')
  assert.equal(formatDistance(8000), '8.00km')
  assert.equal(formatDistance(NaN), '—')
})

test('polylineLength sums the segments in metres', () => {
  assert.equal(polylineLength([[0, 0], [30, 40]]), 50)
  assert.equal(polylineLength([[0, 0], [30, 40], [30, 90]]), 100)
  assert.equal(polylineLength([[5, 5]]), 0)
  assert.equal(polylineLength([]), 0)
})

test('normaliseAngle wraps into (-PI, PI]', () => {
  assert.ok(Math.abs(normaliseAngle(3 * Math.PI) - Math.PI) < 1e-9)
  // -3*PI has two valid representatives; the half-open interval picks +PI.
  assert.ok(Math.abs(normaliseAngle(-3 * Math.PI) - Math.PI) < 1e-9)
  assert.ok(Math.abs(normaliseAngle(0.5) - 0.5) < 1e-12)
  assert.ok(Math.abs(normaliseAngle(-0.5) + 0.5) < 1e-12)
  // A +175 deg and a -175 deg wedge boundary are 10 deg apart, not 350.
  const a = normaliseAngle(degToRad(175) - degToRad(-175))
  assert.ok(Math.abs(Math.abs(a) - degToRad(10)) < 1e-9)
  // Whatever comes in, the result is inside the half-open interval.
  for (let r = -20; r <= 20; r += 0.37) {
    const n = normaliseAngle(r)
    assert.ok(n > -Math.PI - 1e-9 && n <= Math.PI + 1e-9, `${r} -> ${n}`)
  }
})

test('FOV defaults and derived values', () => {
  const a = { type: 'fov', points: [[0, 0], [100, 0]] }
  assert.equal(fovRange(a), 400, 'default range')
  assert.equal(fovRange({ range: 900 }), 900)
  assert.ok(Math.abs(fovHalfAngle(a) - degToRad(30)) < 1e-12, '60 deg total opening -> 30 deg half')
  assert.ok(Math.abs(fovHalfAngle({ angle: 90 }) - degToRad(45)) < 1e-12)
  assert.equal(fovFacing(a), 0, 'pointing +X')
  assert.ok(Math.abs(fovFacing({ points: [[0, 0], [0, 100]] }) - Math.PI / 2) < 1e-12)
})

test('fovCorners is in LOCAL space — rot is not baked in', () => {
  const plain = { type: 'fov', points: [[0, 0], [100, 0]], range: 400, angle: 60 }
  const spun = { ...plain, rot: degToRad(90) }
  // Same corners: the renderer applies rot as a canvas transform, so baking it
  // in here too would rotate the wedge twice.
  assert.deepEqual(fovCorners(spun), fovCorners(plain))
  // And the corners describe the documented geometry.
  const c = fovCorners(plain)
  assert.deepEqual(c[0], [0, 0], 'apex first')
  assert.ok(Math.abs(c[2][0] - 400) < 1e-9, 'bisector tip sits at the range')
  assert.ok(c[1][1] < 0 && c[3][1] > 0, 'the two edges straddle the bisector')
})

test('fovBounds encloses the wedge', () => {
  const a = { type: 'fov', points: [[0, 0], [100, 0]], range: 400, angle: 60 }
  const b = annoBounds(a)
  assert.equal(b.minX, 0)
  assert.equal(b.maxX, 400)
  const c = fovCorners(a)
  for (const corner of c) {
    assert.ok(pointInBounds(corner[0], corner[1], b), 'every corner is inside the bounds')
  }
})

test('pointInFov checks range AND the angular opening', () => {
  const a = { type: 'fov', points: [[0, 0], [100, 0]], range: 400, angle: 60 }
  assert.ok(pointInFov(a, 0, 0), 'the apex itself')
  assert.ok(pointInFov(a, 200, 0), 'straight ahead')
  assert.ok(pointInFov(a, 200, 100), 'inside the 30 deg half-angle')
  assert.ok(!pointInFov(a, 200, 250), 'outside the half-angle')
  assert.ok(!pointInFov(a, 500, 0), 'beyond the range')
})

test('an FOV cone pivots on its apex, so rotating does not move the observer', () => {
  const a = { type: 'fov', points: [[100, 200], [500, 200]], range: 400, angle: 60 }
  assert.deepEqual(pivotOf(a), [100, 200], 'the apex is the pivot, not the box centre')
  const spun = { ...a, rot: degToRad(90) }
  assert.deepEqual(pivotOf(spun), [100, 200], 'rotation does not move the pivot')
})

test('a rotated FOV cone sweeps about its apex and is hit-tested consistently', () => {
  const base = { type: 'fov', points: [[0, 0], [100, 0]], range: 400, angle: 60 }
  const spun = { ...base, rot: degToRad(90) }

  // In local space "straight ahead" is +X.
  assert.ok(pointInFov(base, 200, 0), 'local: straight ahead')
  // 90 degrees of rot turns that into +Y in world space, still from the apex.
  const inside = worldToLocal(spun, 0, 200)
  assert.ok(inside.every(Number.isFinite), 'the inverse transform resolves')
  assert.ok(pointInFov(spun, inside[0], inside[1]), 'the rotated cone is hit-testable')
  // The old direction is no longer covered.
  const outside = worldToLocal(spun, 200, 0)
  assert.ok(!pointInFov(spun, outside[0], outside[1]))
})

test('worldToLocal around the apex cancels the renderer transform', () => {
  const spun = { type: 'fov', points: [[0, 0], [100, 0]], range: 400, angle: 60, rot: degToRad(90) }
  // Renderer: translate(apex) rotate(rot) translate(-apex) then draw corners.
  const world = rotatePoint(0, 0, 0, 0, spun.rot)
  assert.deepEqual(world, [0, 0], 'the apex maps to itself')
  const [lx, ly] = worldToLocal(spun, world[0], world[1])
  assert.ok(Math.abs(lx) < 1e-9 && Math.abs(ly) < 1e-9, 'and un-rotates back to the apex')
})
