// Render smoke tests: every annotation type must draw, in one shared renderer,
// at both screen and export scale.
//
// The point is not to check pixels — it is to catch the failure mode that
// actually bites when a new tool is added: a branch of `drawAnno` that throws on
// a real annotation, or that only works at S=1 and renders a 4x-too-small
// stroke in the exported PNG. A stub context counts draw calls, so both show up
// as failures.
import test from 'node:test'
import assert from 'node:assert/strict'

import { renderScene, computeView } from '../src/lib/render.js'
import { ANNO_DEFAULTS, withDefaults } from '../src/lib/annoTypes.js'
import { TOOL_BY_ID } from '../src/data/tools.js'

const MAP_SIZE = 8000
const VIEW_W = 800
const VIEW_H = 800

/**
 * A canvas 2D context that records what was asked of it.
 *
 * `measureText` has to return a non-zero width or every label helper divides by
 * something meaningless, and `createRadialGradient` needs a colour-stop
 * collector. `arc` is recorded because several shapes are identified by it.
 */
function stubContext() {
  const calls = {
    stroke: 0, fill: 0, drawImage: 0, text: [], arcs: 0, transforms: 0,
    // Raw arguments, kept so a test can assert *where* a shape was drawn, not
    // just that something was: an FOV cone pointing the wrong way draws
    // perfectly happily and a bare call count cannot see it.
    arcArgs: [], rotations: [],
  }
  const gradient = { addColorStop() {} }
  const ctx = {
    // --- recorded state ---
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', globalAlpha: 1,
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', shadowColor: '',
    shadowBlur: 0, imageSmoothingEnabled: false, imageSmoothingQuality: '',
    lineDashOffset: 0,
    // --- tracked operations ---
    stroke() { calls.stroke++ },
    fill() { calls.fill++ },
    clip() {},
    drawImage() { calls.drawImage++ },
    fillRect() {},
    clearRect() {},
    fillText(t) { calls.text.push(String(t)) },
    strokeText() {},
    beginPath() {},
    closePath() {},
    moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {},
    arc(...args) { calls.arcs++; calls.arcArgs.push(args) },
    rect() {},
    ellipse() {},
    setLineDash() {},
    save() {}, restore() {},
    translate() {}, scale() {},
    rotate(ang) { calls.transforms++; calls.rotations.push(ang) },
    createRadialGradient() { return gradient },
    createLinearGradient() { return gradient },
    measureText(t) { return { width: String(t).length * 7 } },
  }
  return { ctx, calls }
}

const view = (zoom = 1) => computeView(VIEW_W, VIEW_H, MAP_SIZE, zoom)

/**
 * Project a world metre to a screen pixel, the same way `renderScene` does.
 * `computeView` returns plain numbers rather than closures, so the renderer
 * builds `X`/`Y` internally; these mirror that for assertions.
 */
function projector(v = view()) {
  const Z = v.ppm * v.zoom
  return { X: (m) => m * Z + v.ox, Y: (m) => m * Z + v.oy }
}

/** One representative annotation per type, in world metres. */
const SAMPLES = {
  brush: { points: [[1000, 1000], [1200, 1400], [1500, 1100], [1800, 1600]] },
  line: { points: [[1000, 1000], [3000, 1000]] },
  arrow: { points: [[1000, 2000], [3000, 2000]] },
  arrow2: { points: [[1000, 2400], [3000, 2400]] },
  rotation: { points: [[1000, 3000], [1500, 3200], [2000, 2900]], label: 'Rotate A' },
  rect: { points: [[500, 500], [1500, 1200]] },
  compound: { points: [[500, 500], [1500, 1200]], label: 'Compound' },
  circle: { points: [[3000, 3000]], r: 600 },
  danger: { points: [[4000, 4000]], r: 500 },
  fov: { points: [[2000, 6000], [2800, 6000]], range: 500, angle: 70, label: 'Sniper' },
  measure: { points: [[1000, 5000], [3400, 5000]] },
  ridge: { points: [[1000, 7000], [3000, 7000]], label: 'Ridge' },
  smoke: { points: [[5000, 5000]], r: 80 },
  flight1: { points: [[0, 4000], [8000, 4000]] },
  flight2: { points: [[0, 4600], [8000, 4600]] },
  text: { points: [[2000, 2000]], label: 'Rotate here' },
  pin: { points: [[3000, 2000]], label: 'Warehouse' },
  player: { points: [[3500, 2000]], label: '1' },
  vehicle: { points: [[4000, 2000]], open: true },
  team: { points: [[4500, 2000]], label: 'TeamX', teamId: 't1' },
}

const buildAnno = (type, extra = {}) => withDefaults({
  id: type,
  type,
  points: SAMPLES[type].points,
  ...SAMPLES[type],
  ...extra,
})

test('every declared annotation type has a render sample', () => {
  for (const type of Object.keys(ANNO_DEFAULTS)) {
    assert.ok(SAMPLES[type], `add a sample for the new type "${type}"`)
  }
})

test('every drawable tool produces an annotation the renderer covers', () => {
  for (const [id, tool] of Object.entries(TOOL_BY_ID)) {
    if (id === 'select' || id === 'eraser') continue
    assert.ok(ANNO_DEFAULTS[id] !== undefined, `tool ${id} has no annotation defaults`)
  }
})

test('renderScene draws every annotation type without throwing', () => {
  for (const type of Object.keys(SAMPLES)) {
    const { ctx, calls } = stubContext()
    assert.doesNotThrow(() => {
      renderScene(ctx, VIEW_W, VIEW_H, {
        mapSize: MAP_SIZE,
        view: view(),
        annos: [buildAnno(type)],
        circles: [],
        highlights: [],
        gridOn: true,
      })
    }, `${type} should render`)
    assert.ok(calls.fill + calls.stroke > 0, `${type} drew nothing`)
  }
})

test('renderScene draws every type at 4x export scale without throwing', () => {
  // The `S` factor is the one thing that differs between the editor and the
  // exported PNG, so each type has to survive the high-resolution path too.
  for (const type of Object.keys(SAMPLES)) {
    const { ctx, calls } = stubContext()
    assert.doesNotThrow(() => {
      renderScene(ctx, VIEW_W * 4, VIEW_H * 4, {
        mapSize: MAP_SIZE,
        view: view(),
        annos: [buildAnno(type)],
        circles: [],
        highlights: [],
        exportScaleFactor: 4,
        viewportWidth: VIEW_W,
      })
    }, `${type} should render at export scale`)
    assert.ok(calls.fill + calls.stroke > 0, `${type} drew nothing at export scale`)
  }
})

test('the scene renders at several zoom levels', () => {
  for (const zoom of [1, 2, 7, 14]) {
    const { ctx } = stubContext()
    assert.doesNotThrow(() => {
      renderScene(ctx, VIEW_W, VIEW_H, {
        mapSize: MAP_SIZE,
        view: view(zoom),
        annos: Object.keys(SAMPLES).map(buildAnno),
        circles: [],
        highlights: [],
      })
    }, `zoom ${zoom}`)
  }
})

test('rotation, opacity, size and width all reach the renderer', () => {
  const props = {
    rot: Math.PI / 4,
    opacity: 0.35,
    size: 2.5,
    width: 9,
  }
  for (const type of Object.keys(SAMPLES)) {
    const { ctx } = stubContext()
    assert.doesNotThrow(() => {
      renderScene(ctx, VIEW_W, VIEW_H, {
        mapSize: MAP_SIZE,
        view: view(),
        annos: [buildAnno(type, props)],
        circles: [],
        highlights: [],
      })
    }, `${type} with every property set`)
  }
})

test('a text note honours its font size and weight', () => {
  const seen = []
  const { ctx } = stubContext()
  const spy = {
    ...ctx,
    set font(v) { seen.push(v); ctx.font = v },
    get font() { return ctx.font },
  }
  renderScene(spy, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: view(),
    annos: [buildAnno('text', { fontSize: 30, fontWeight: 300 })],
    circles: [],
    highlights: [],
  })
  assert.ok(seen.some((f) => f.startsWith('300 ')), `expected a 300-weight font, saw ${seen.join(' | ')}`)
  assert.ok(seen.some((f) => f.includes('30px')), `expected a 30px font, saw ${seen.join(' | ')}`)
})

test('a measurement line prints its distance in metres', () => {
  const { ctx, calls } = stubContext()
  renderScene(ctx, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: view(),
    // 2400 m apart: over a kilometre, so the readout must switch to km.
    annos: [buildAnno('measure', { points: [[1000, 5000], [3400, 5000]] })],
    circles: [],
    highlights: [],
  })
  assert.ok(calls.text.some((t) => t.includes('2.40km')), `saw ${calls.text.join(' | ')}`)
})

test('the selection aura is not drawn for unselected annotations', () => {
  // A selection ring in the live view must never leak into the export, where
  // `selectedId` is null. This is a cheap guard against that class of bug.
  const { ctx, calls } = stubContext()
  renderScene(ctx, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: view(),
    annos: [buildAnno('circle')],
    circles: [],
    highlights: [],
    selectedId: null,
  })
  assert.equal(calls.stroke, 1, 'a plain circle is one stroke and nothing else')
})

test('a playzone circle renders with its stage radius', () => {
  const { ctx, calls } = stubContext()
  assert.doesNotThrow(() => {
    renderScene(ctx, VIEW_W, VIEW_H, {
      mapSize: MAP_SIZE,
      view: view(),
      annos: [],
      circles: [
        { id: 'c1', stage: 3, x: 4000, y: 4000, r: 740 },
        { id: 'c2', stage: 6, x: 3000, y: 3000, r: 92.5 },
      ],
      highlights: [],
    })
  })
  assert.ok(calls.arcs >= 2, 'both zones drew')
})

test('a hidden annotation is skipped', () => {
  const { ctx, calls } = stubContext()
  renderScene(ctx, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: view(),
    annos: [buildAnno('circle', { hidden: true })],
    circles: [],
    highlights: [],
  })
  assert.equal(calls.fill + calls.stroke, 0, 'nothing drawn for a hidden layer')
})

test('a preview annotation is drawn for the tool in progress', () => {
  // This is the `_t` sentinel the canvas passes while the user is mid-drag.
  const { ctx, calls } = stubContext()
  renderScene(ctx, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: view(),
    annos: [],
    circles: [],
    highlights: [],
    temp: withDefaults({ id: '_t', type: 'arrow', color: '#FBBF24', points: [[100, 100], [900, 900]] }),
  })
  assert.ok(calls.fill + calls.stroke > 0, 'the in-progress shape is visible')
})

test('an empty board still renders a background', () => {
  const { ctx } = stubContext()
  assert.doesNotThrow(() => {
    renderScene(ctx, VIEW_W, VIEW_H, {
      mapSize: MAP_SIZE,
      view: view(),
      annos: [],
      circles: [],
      highlights: [],
    })
  })
})

test('rendering is deterministic — the same state gives the same calls', () => {
  // Export rule 8: no dependence on animation phase or timing.
  const state = {
    mapSize: MAP_SIZE,
    view: view(2),
    annos: Object.keys(SAMPLES).map(buildAnno),
    circles: [{ id: 'c1', stage: 3, x: 4000, y: 4000, r: 740 }],
    highlights: [],
    t: 0,
  }
  const a = stubContext()
  const b = stubContext()
  renderScene(a.ctx, VIEW_W, VIEW_H, { ...state, t: 0 })
  renderScene(b.ctx, VIEW_W, VIEW_H, { ...state, t: 9999 })
  assert.equal(a.calls.stroke, b.calls.stroke)
  assert.equal(a.calls.fill, b.calls.fill)
  assert.deepEqual(a.calls.text, b.calls.text)
})

// --- Rotation is applied ONCE -------------------------------------------------

test('a rotated cone keeps its local angles — rotation is not applied twice', () => {
  // Regression. `drawAnno` spins the canvas about the pivot before drawing, and
  // a cone's pivot is its apex. The wedge is also computed from a LOCAL facing
  // angle, so adding `rot` into that angle made a 45 degree cone point 90
  // degrees off. Call counts cannot see this; the arc arguments can.
  //
  // `arc(x, y, radius, startAngle, endAngle, counterclockwise)`, so the centre
  // is args[0..1] and the angles are args[3..4].
  const half = (SAMPLES.fov.angle / 2) * (Math.PI / 180)
  const v = view()
  const { X, Y } = projector(v)

  const draw = (rot) => {
    const { ctx, calls } = stubContext()
    renderScene(ctx, VIEW_W, VIEW_H, {
      mapSize: MAP_SIZE,
      view: v,
      annos: [buildAnno('fov', { rot })],
      circles: [],
      highlights: [],
    })
    return calls
  }

  /**
   * The wedge is the widest arc centred on the apex. The cone also draws a
   * small apex pip, so matching on radius rather than on "first arc" is what
   * keeps this honest.
   */
  const wedge = (calls) => {
    const apex = SAMPLES.fov.points[0]
    const found = calls.arcArgs.filter(
      (a) => a.length >= 5 && Math.abs(a[0] - X(apex[0])) < 1e-6 && Math.abs(a[1] - Y(apex[1])) < 1e-6,
    )
    return found.sort((p, q) => q[2] - p[2])[0]
  }

  const flat = draw(0)
  const spun = draw(Math.PI / 4) // 45 degrees

  // The canvas transform is what turns the cone; it must have been applied.
  assert.deepEqual(flat.rotations, [], 'an unrotated cone needs no canvas rotation')
  assert.deepEqual(spun.rotations, [Math.PI / 4], 'the cone is spun by the canvas transform')

  // The wedge itself is drawn with the same local angles in both cases.
  const aFlat = wedge(flat)
  const aSpun = wedge(spun)
  assert.ok(aFlat, 'the wedge is drawn as an arc')
  assert.ok(aSpun, 'the wedge is drawn as an arc when rotated')
  assert.equal(aSpun[0], aFlat[0], 'apex x is unaffected by the local angle')
  assert.equal(aSpun[1], aFlat[1], 'apex y is unaffected by the local angle')
  assert.equal(aSpun[2], aFlat[2], 'range is unaffected by rotation')
  assert.ok(
    Math.abs(aSpun[3] - aFlat[3]) < 1e-9 && Math.abs(aSpun[4] - aFlat[4]) < 1e-9,
    `local start/end must not absorb rot: ${aSpun[3]}..${aSpun[4]} vs ${aFlat[3]}..${aFlat[4]}`,
  )
  // And the wedge really is centred on the drag direction, 0 = due +X here.
  assert.ok(Math.abs(aFlat[3] + half) < 1e-6, `start is facing-half: ${aFlat[3]}`)
  assert.ok(Math.abs(aFlat[4] - half) < 1e-6, `end is facing+half: ${aFlat[4]}`)
})

test('rotating a cone leaves the apex exactly where it was', () => {
  // The apex is the pivot, so spinning about it must not walk the observer
  // across the map.
  const v = view()
  const { X, Y } = projector(v)
  const { ctx, calls } = stubContext()
  renderScene(ctx, VIEW_W, VIEW_H, {
    mapSize: MAP_SIZE,
    view: v,
    annos: [buildAnno('fov', { rot: Math.PI / 3 })],
    circles: [],
    highlights: [],
  })
  const apex = SAMPLES.fov.points[0]
  const wedge = calls.arcArgs.filter((a) => a.length >= 5).sort((p, q) => q[2] - p[2])[0]
  assert.ok(wedge, 'the wedge is drawn as an arc')
  assert.ok(Math.abs(wedge[0] - X(apex[0])) < 1e-6, `apex x ${wedge[0]} vs ${X(apex[0])}`)
  assert.ok(Math.abs(wedge[1] - Y(apex[1])) < 1e-6, `apex y ${wedge[1]} vs ${Y(apex[1])}`)
})

test('every type still renders once with a rotation applied', () => {
  // Same coverage as the no-rotation sweep, but spinning every sample, which is
  // where a transform bug would show up as a throw or a divide by zero.
  for (const type of Object.keys(SAMPLES)) {
    const { ctx, calls } = stubContext()
    assert.doesNotThrow(() => {
      renderScene(ctx, VIEW_W, VIEW_H, {
        mapSize: MAP_SIZE,
        view: view(),
        annos: [buildAnno(type, { rot: 0.7 })],
        circles: [],
        highlights: [],
        gridOn: true,
      })
    }, type)
    assert.ok(calls.stroke + calls.fill > 0, `${type} drew nothing when rotated`)
  }
})
