// Tests for the live selection overlay.
//
// Two things matter here and neither is "does it look nice":
//   1. the overlay draws at the handle positions the POINTER uses, so what you
//      grab is what you see (a frame drawn from different numbers than the
//      pick test is the classic selection bug);
//   2. it is reachable only from the editor — the export must stay clean.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { drawSelectionOverlay, drawSelectionOverlays, HANDLE_PX } from '../src/lib/selectionOverlay.js'
import { allHandles, handleWorldPos, pickHandle, onPivot, SEL_GRAB_PX } from '../src/lib/selection.js'
import { pivotOf, degToRad } from '../src/lib/geometry.js'
import { renderScene, computeView } from '../src/lib/render.js'

const VIEW_W = 800
const VIEW_H = 800
const MAP_SIZE = 8000
const PPM = 26 / 20 // pixels per metre at zoom 1
const TOL = SEL_GRAB_PX / PPM

function stubContext() {
  const calls = {
    stroke: 0, fill: 0, rects: [], circles: [], moves: [], lines: [],
    dashes: [], restore: 0, save: 0, lineWidths: [],
  }
  const gradient = { addColorStop() {} }
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', globalAlpha: 1,
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', shadowColor: '',
    shadowBlur: 0, imageSmoothingEnabled: false, imageSmoothingQuality: '',
    lineDashOffset: 0,
    stroke() { calls.stroke++; calls.lineWidths.push(ctx.lineWidth) },
    fill() { calls.fill++ },
    clip() {},
    drawImage() {},
    fillRect() {},
    clearRect() {},
    fillText() {},
    strokeText() {},
    beginPath() {},
    closePath() {},
    moveTo(x, y) { calls.moves.push([x, y]) },
    lineTo(x, y) { calls.lines.push([x, y]) },
    quadraticCurveTo() {},
    bezierCurveTo() {},
    arc(...args) { calls.circles.push(args) },
    rect(...args) { calls.rects.push(args) },
    ellipse() {},
    setLineDash(d) { calls.dashes.push(d) },
    save() { calls.save++ },
    restore() { calls.restore++ },
    translate() {},
    scale() {},
    rotate() {},
    createRadialGradient() { return gradient },
    createLinearGradient() { return gradient },
    measureText(t) { return { width: String(t).length * 7 } },
  }
  return { ctx, calls }
}

/** Identity-ish projection: world metres to screen pixels at PPM. */
const X = (m) => m * PPM
const Y = (m) => m * PPM

const RECT = { id: 'r1', type: 'rect', points: [[1000, 1000], [3000, 2200]] }

test('the overlay draws a frame through the projected box corners', () => {
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y)
  assert.ok(calls.moves.length >= 1, 'the frame starts with a moveTo')
  assert.ok(calls.lines.length >= 3, 'and has at least three edges')
  assert.deepEqual(calls.moves[0], [X(1000), Y(1000)], 'from the first corner')
  // The frame is closed back onto the start, so no 5th stray corner.
  assert.ok(calls.lines.length >= 3 && calls.lines.length <= 4)
})

test('the overlay draws exactly one handle per frame corner and edge midpoint', () => {
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y)
  // 8 handles + the pivot circle.
  assert.equal(calls.rects.length, 8, 'eight resize grips')
  assert.equal(calls.circles.length, 1, 'one pivot pip')
})

test('every grip is drawn where the pointer will find it', () => {
  // The important one: the drawn position and the pick test must agree, or the
  // UI lies about where you can grab.
  // `rect(x, y, w, h)` is top-left based, so a grip's CENTRE is x + w/2.
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y)
  const drawn = calls.rects.map(([x, y, w, h]) => [x + w / 2, y + h / 2])
  const handles = allHandles(RECT)
  assert.equal(drawn.length, handles.length)
  for (let i = 0; i < handles.length; i++) {
    const [wx, wy] = handleWorldPos(RECT, i)
    assert.ok(Math.abs(drawn[i][0] - X(wx)) < 1e-6, `handle ${i} x: ${drawn[i][0]} vs ${X(wx)}`)
    assert.ok(Math.abs(drawn[i][1] - Y(wy)) < 1e-6, `handle ${i} y: ${drawn[i][1]} vs ${Y(wy)}`)
  }
})

test('the grip drawn at a point is pickable at that point', () => {
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y)
  // Walk the drawn grips and confirm the pointer resolves each one.
  for (const [sx, sy] of calls.rects.map(([x, y]) => [x, y])) {
    const wx = sx / PPM
    const wy = sy / PPM
    const idx = pickHandle(RECT, wx, wy, PPM)
    assert.ok(idx >= 0, `a drawn grip at ${sx},${sy} is not pickable in world space`)
  }
})

test('a rotated object is framed and gripped in its rotated position', () => {
  const a = { ...RECT, rot: degToRad(35) }
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, a, X, Y)
  const drawn = calls.rects.map(([x, y, w, h]) => [x + w / 2, y + h / 2])
  for (let i = 0; i < 8; i++) {
    const [wx, wy] = handleWorldPos(a, i)
    assert.ok(Math.abs(drawn[i][0] - X(wx)) < 1e-6, `rotated handle ${i} x: ${drawn[i][0]} vs ${X(wx)}`)
    assert.ok(Math.abs(drawn[i][1] - Y(wy)) < 1e-6, `rotated handle ${i} y: ${drawn[i][1]} vs ${Y(wy)}`)
  }
})

test('the pivot pip is drawn at the object pivot', () => {
  const a = { id: 'c', type: 'circle', points: [[2000, 2000]], r: 400 }
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, a, X, Y)
  const pip = calls.circles[0]
  const [px, py] = pivotOf(a)
  assert.ok(Math.abs(pip[0] - X(px)) < 1e-6, `pivot x ${pip[0]}`)
  assert.ok(Math.abs(pip[1] - Y(py)) < 1e-6, `pivot y ${pip[1]}`)
})

test('grips are a constant screen size, independent of zoom', () => {
  // A grip that grew with zoom would be unusable when zoomed out; one that
  // shrank would be untappable when zoomed in.
  const small = stubContext()
  const big = stubContext()
  drawSelectionOverlay(small.ctx, RECT, X, Y, { S: 1 })
  drawSelectionOverlay(big.ctx, RECT, X, Y, { S: 4 })
  const size = (c) => c.rects[0][2]
  assert.equal(size(small.calls), HANDLE_PX * 2, 'half-size 4.5 means a 9px square')
  assert.equal(size(big.calls), HANDLE_PX * 2 * 4, 'and it scales with S for export-scale shots')
})

test('handles can be hidden without hiding the frame', () => {
  // While dragging a grip you do not want the other seven grabbing the cursor.
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y, { showHandles: false })
  assert.equal(calls.rects.length, 0, 'no grips')
  assert.equal(calls.circles.length, 1, 'pivot still drawn')
  assert.ok(calls.moves.length >= 1, 'frame still drawn')
})

test('the pivot can be hidden independently', () => {
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y, { showPivot: false })
  assert.equal(calls.circles.length, 0, 'no pip')
  assert.equal(calls.rects.length, 8, 'grips still drawn')
})

test('the overlay leaves the canvas state as it found it', () => {
  // Drawing chrome must not leak a dash pattern or a transform into the next
  // frame, or a stray dashed line appears over the map.
  const { ctx, calls } = stubContext()
  drawSelectionOverlay(ctx, RECT, X, Y)
  assert.equal(calls.save, calls.restore, 'balanced save/restore')
  assert.deepEqual(calls.dashes[calls.dashes.length - 1], [], 'the dash pattern is cleared')
})

test('a null or empty annotation draws nothing rather than throwing', () => {
  const { ctx, calls } = stubContext()
  assert.doesNotThrow(() => drawSelectionOverlay(ctx, null, X, Y))
  assert.doesNotThrow(() => drawSelectionOverlay(ctx, { id: 'x' }, X, Y))
  assert.doesNotThrow(() => drawSelectionOverlay(ctx, { id: 'x', points: [] }, X, Y))
  assert.equal(calls.rects.length, 0)
  assert.equal(calls.stroke, 0)
})

test('drawSelectionOverlays selects by id from the annotation list', () => {
  const annos = [RECT, { id: 'r2', type: 'circle', points: [[500, 500]], r: 100 }]
  const { ctx, calls } = stubContext()
  drawSelectionOverlays(ctx, X, Y, { selectedId: 'r2', annos })
  // A circle: 8 grips, pivot, and the centre of the one on screen is its own.
  assert.equal(calls.rects.length, 8, 'the circle is framed')
  assert.equal(calls.circles.length, 1)
})

test('drawSelectionOverlays draws nothing when nothing is selected', () => {
  const { ctx, calls } = stubContext()
  drawSelectionOverlays(ctx, X, Y, { selectedId: null, annos: [RECT] })
  drawSelectionOverlays(ctx, X, Y, { annos: [RECT] })
  assert.equal(calls.rects.length, 0)
  assert.equal(calls.stroke, 0)
})

test('a stale selection id does not throw', () => {
  // Selection can outlive a deleted annotation for a frame. That must be a
  // no-op, not a crash on the render loop.
  const { ctx } = stubContext()
  assert.doesNotThrow(() => drawSelectionOverlays(ctx, X, Y, { selectedId: 'gone', annos: [RECT] }))
})

// --- the export must stay clean ----------------------------------------------

test('renderScene does NOT draw the selection overlay', () => {
  // The overlay is editor chrome. If this ever fails, exported PNGs have cyan
  // squares on them.
  const view = computeView(VIEW_W, VIEW_H, MAP_SIZE, 1)
  const withSel = stubContext()
  const withoutSel = stubContext()
  const base = {
    mapSize: MAP_SIZE,
    view,
    annos: [RECT],
    circles: [],
    highlights: [],
    gridOn: true,
  }
  renderScene(withoutSel.ctx, VIEW_W, VIEW_H, { ...base, selectedId: null })
  renderScene(withSel.ctx, VIEW_W, VIEW_H, { ...base, selectedId: 'r1' })

  // A selected anno may legitimately draw a little more (e.g. a glow), but it
  // must never draw the overlay: no cyan grips, no pivot pip, no frame.
  assert.ok(
    withoutSel.calls.rects.length >= withSel.calls.rects.length,
    'selection added rectangles to the export path',
  )
  assert.equal(withSel.calls.rects.length, withoutSel.calls.rects.length, 'overlay grips leaked')
})

test('the export composer never references the overlay', () => {
  // Belt and braces: `renderExportCanvas` is the only thing that produces the
  // downloadable image, so an import here would mean grips on every PNG.
  const src = readFileSync(new URL('../src/lib/export.js', import.meta.url), 'utf8')
  assert.ok(!/selectionOverlay/.test(src), 'export.js must not reference the overlay')
  const shared = readFileSync(new URL('../src/lib/render.js', import.meta.url), 'utf8')
  assert.ok(!/selectionOverlay/.test(shared), 'the shared renderer must not import it either')
})
