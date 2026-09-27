// The frame layer must not interfere with tactical drawing coordinates.
//
// The point of these tests is the one property that is easy to break by accident
// and impossible to eyeball in a screenshot: the FRAME / EXPORT layer is pure
// chrome in the gutter, and toggling it must never change how a world coordinate
// lands *inside* the map, nor distort it.
//
// A note on what is deliberately NOT asserted: the map rectangle is a different
// size for a framed template than for `none`, because a frame reserves a gutter
// around the map. That is the whole point of a frame. What must hold is that the
// tactical content keeps its aspect ratio and its position within the map rect,
// so hiding the frame changes the border, never the board.
import test from 'node:test'
import assert from 'node:assert/strict'

import { computeFrameLayout, getTemplate, FRAME_TEMPLATES, DESIGN_WIDTH } from '../src/lib/frames.js'
import { renderScene } from '../src/lib/render.js'
import {
  defaultLayerDocument,
  normalizeLayerDocument,
  soloLayer,
  exportSelection,
  isLayerVisible,
} from '../src/lib/layers.js'

// --- one stable canvas stub, installed once --------------------------------
//
// `frames.js` caches its text-measuring canvas in module scope on first use, so
// a stub installed and torn down per test would leave that cache pointing at a
// context that no longer exists. Each test file gets its own process under
// `node --test`, so one file-scoped stub is safe and stable.
const measureCtx = {
  measureText: (t) => ({ width: String(t).length * 7 }),
  font: '',
  textAlign: '',
  textBaseline: '',
  save() {}, restore() {}, scale() {}, translate() {}, setTransform() {},
  fillText() {}, strokeText() {}, beginPath() {}, closePath() {},
  moveTo() {}, lineTo() {}, arc() {}, rect() {}, fill() {}, stroke() {},
  clip() {}, fillRect() {}, strokeRect() {}, clearRect() {}, setLineDash() {},
  drawImage() {},
  createLinearGradient: () => ({ addColorStop() {} }),
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
}
globalThis.document = {
  fonts: { ready: Promise.resolve(), load: async () => [] },
  createElement: () => ({ width: 0, height: 0, getContext: () => measureCtx }),
}

const mapRect = (l) => ({ mapX: l.mapX, mapY: l.mapY, mapW: l.mapW, mapH: l.mapH })

const layoutFor = (templateId, outputWidth = 2048, contentAspect = 1) =>
  computeFrameLayout({
    template: getTemplate(templateId),
    fields: { header: {}, footer: {} },
    content: {},
    outputWidth,
    contentAspect,
  })

test('hiding FRAME / EXPORT yields the bare map, edge to edge', () => {
  // This is precisely what the composer does when the frame layer is hidden: it
  // passes a null template, which resolves to `none`.
  const bare = layoutFor('none')
  assert.equal(bare.mapX, 0, 'the bare map has no left gutter')
  assert.equal(bare.mapY, 0, 'the bare map has no header gutter')
  assert.equal(bare.mapW, 2048, 'the bare map uses the full width')
  assert.equal(bare.mapH, 2048, 'and the full height')
})

test('no template distorts the map: the rect keeps the requested aspect', () => {
  // A stretched map rect would stretch every arrow and zone with it, which is
  // the single worst thing a frame could do to a tactical board.
  //
  // `contentAspect` is height / width: the board is 1:1 for a square map and
  // wider-than-tall (0.5625) for a 16:9 board.
  for (const aspect of [1, 9 / 16, 3 / 4, 16 / 9]) {
    for (const t of FRAME_TEMPLATES) {
      const { mapW, mapH } = layoutFor(t.id, 2048, aspect)
      assert.ok(mapW > 0 && mapH > 0, `${t.id} produced an empty map rect`)
      assert.ok(
        Math.abs(mapH / mapW - aspect) < 0.02,
        `${t.id} at aspect ${aspect}: map rect is ${mapW}x${mapH} (h/w ${(mapH / mapW).toFixed(3)})`,
      )
    }
  }
})

test('a frame reserves a gutter rather than rescaling the map', () => {
  // Framed templates inset the map; that inset is the chrome. The important
  // consequence is that the map is *smaller*, never a different shape, so the
  // world→screen scale inside it is uniform on both axes.
  const bare = layoutFor('none')
  for (const t of FRAME_TEMPLATES) {
    if (t.id === 'none') continue
    const r = mapRect(layoutFor(t.id))
    assert.ok(r.mapW <= bare.mapW, `${t.id} made the map wider than the bare map`)
    assert.equal(r.mapW, r.mapH, `${t.id} map rect is not square, so the board is distorted`)
    // The side gutter is symmetric, so the map stays horizontally centred.
    assert.equal(r.mapX, 2048 - r.mapX - r.mapW, `${t.id} map is off-centre horizontally`)
  }
})

test('pixel dimensions stay integral at any size', () => {
  // A fractional canvas.height is truncated by the browser, which crops the last
  // band and shifts every rule below it. `scaleF` is a scale factor and is
  // legitimately fractional, so it is excluded.
  const GEOMETRY = ['width', 'height', 'mapX', 'mapY', 'mapW', 'mapH', 'contentW', 'headerH', 'footerH', 'pad', 'inset', 'bandW', 'gutter']
  for (const width of [620, 1024, 2048, 4096]) {
    for (const t of FRAME_TEMPLATES) {
      const l = layoutFor(t.id, width)
      for (const k of GEOMETRY) {
        assert.ok(
          Number.isInteger(l[k]),
          `${t.id} @${width}: ${k} is fractional (${l[k]})`,
        )
      }
    }
  }
})

test('the frame scales from the design width, not from hard-coded pixels', () => {
  // Two exports of the same board at different sizes must be the same image
  // scaled, or the download would not match the preview.
  const a = layoutFor('analyst', DESIGN_WIDTH)
  const b = layoutFor('analyst', DESIGN_WIDTH * 2)
  assert.equal(b.mapW, a.mapW * 2, 'the map did not scale with the export size')
  assert.equal(b.mapX, a.mapX * 2)
})

// --- the live scene --------------------------------------------------------
//
// The editor and the exporter share `renderScene()`, so anything asserted here
// holds for the exported PNG too.

function sceneCtx() {
  const calls = []
  // A Proxy rather than a hand-written method list: `render.js` uses much more
  // of the 2D API than is worth enumerating, and a stub that throws on an
  // unlisted method turns every new drawing feature into a broken test. Only
  // `translate` is recorded, because that is the scene projection under test.
  const target = {
    calls,
    canvas: { width: 0, height: 0 },
    measureText: (t) => ({ width: String(t).length * 7 }),
    translate(...a) { calls.push({ name: 'translate', args: a }) },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop]
      if (typeof prop !== 'string') return undefined
      const fn = (...args) => { calls.push({ name: prop, args }) }
      obj[prop] = fn
      return fn
    },
    set(obj, prop, value) { obj[prop] = value; return true },
  })
}

const BOARD = {
  mapSize: 8000,
  circles: [{ id: 'z1', stage: 4, x: 4000, y: 4000, r: 800 }],
  annos: [
    // Text annos carry `label`, which is what the renderer actually draws.
    { id: 'tx1', type: 'text', points: [[3000, 3000]], label: 'hold here' },
    { id: 'b1', type: 'brush', points: [[10, 10], [60, 90], [120, 40]] },
  ],
  highlights: [],
  view: { ppm: 0.1, zoom: 1, ox: 0, oy: 0 },
  exportScaleFactor: 1,
  selectedId: null,
  mapId: 'erangel',
  image: null,
}

function drawScene(layerDocument) {
  const sel = exportSelection(BOARD.annos, BOARD.circles, layerDocument)
  const ctx = sceneCtx()
  renderScene(ctx, 800, 800, {
    ...BOARD,
    circles: sel.circles,
    annos: sel.annos,
    image: sel.mapVisible ? BOARD.image : null,
  })
  return ctx
}

const drewLabel = (ctx, text) => ctx.calls.some((c) => c.name === 'fillText' && c.args[0] === text)

/** Hide exactly one layer, leaving every other layer visible. */
const withHidden = (id) => {
  const base = defaultLayerDocument()
  return normalizeLayerDocument({
    ...base,
    layers: { ...base.layers, [id]: { visible: false, locked: false } },
  })
}

test('hiding a layer removes only its own objects', () => {
  const base = defaultLayerDocument()
  assert.ok(drewLabel(drawScene(base), 'hold here'), 'the text note should be drawn')

  // TEXT owns the note, so hiding it must take the note with it...
  assert.ok(
    !drewLabel(drawScene(withHidden('text')), 'hold here'),
    'hiding TEXT left the note on the canvas',
  )
  // ...and hiding anything else must leave it alone.
  for (const id of Object.keys(base.layers)) {
    if (id === 'text') continue
    assert.ok(
      drewLabel(drawScene(withHidden(id)), 'hold here'),
      `hiding ${id} wrongly removed the TEXT layer`,
    )
  }
})

test('hiding a layer only ever removes drawing, never moves or re-orders it', () => {
  // The editor and the exporter share `renderScene`, so if hiding a layer moved
  // the projection the board would visibly jump as the user toggled it. The
  // invariant is that the surviving call sequence is unchanged *and in the same
  // order* — hiding may delete calls, but it must not renumber, reorder or
  // re-project anything.
  const base = defaultLayerDocument()
  const reference = drawScene(base).calls
  for (const id of Object.keys(base.layers)) {
    const hidden = drawScene(withHidden(id)).calls
    assert.ok(
      hidden.length <= reference.length,
      `hiding ${id} produced more drawing than the full board`,
    )
    // Every surviving call is still in the reference, at a monotonically
    // increasing index: a subsequence, which is exactly "removed, not moved".
    let cursor = -1
    for (const call of hidden) {
      const at = reference.findIndex(
        (r, i) => i > cursor && r.name === call.name && JSON.stringify(r.args) === JSON.stringify(call.args),
      )
      assert.ok(at > cursor, `hiding ${id} changed the order of a surviving ${call.name} call`)
      cursor = at
    }
  }
})

test('the scene projection is byte-identical whatever is hidden', () => {
  // The strongest form of the same guarantee, isolated to the one call that
  // positions the world: the world→screen translate never moves.
  const base = defaultLayerDocument()
  const projection = (ctx) => ctx.calls.filter((c) => c.name === 'translate')
  const reference = projection(drawScene(base))
  for (const id of Object.keys(base.layers)) {
    assert.deepEqual(projection(drawScene(withHidden(id))), reference, `hiding ${id} moved the projection`)
  }
})

test('soloing a layer shows that layer and nothing else', () => {
  // The panel's "Show only this" affordance, asserted through the scene.
  const base = defaultLayerDocument()
  for (const id of Object.keys(base.layers)) {
    const soloed = drawScene(
      normalizeLayerDocument({ ...base, layers: soloLayer(base.layers, id) }),
    )
    if (id === 'text') {
      assert.ok(drewLabel(soloed, 'hold here'), 'soloing TEXT should keep the note')
    } else {
      assert.ok(!drewLabel(soloed, 'hold here'), `soloing ${id} should hide the TEXT layer`)
    }
  }
})

test('MAP controls the imagery, never the geometry', () => {
  const base = defaultLayerDocument()
  const withMap = drawScene(base)
  const noMap = drawScene(
    normalizeLayerDocument({ ...base, layers: { ...base.layers, map: { visible: false, locked: false } } }),
  )
  // Identical drawing calls: the map is a backdrop, so removing it must leave
  // every annotation exactly where it was.
  const drawing = (ctx) => ctx.calls.filter((c) => c.name !== 'drawImage' && c.name !== 'fillRect')
  assert.deepEqual(drawing(noMap), drawing(withMap))
  assert.ok(!isLayerVisible({ ...base.layers, map: { visible: false } }, 'map'))
})

test('hiding FRAME / EXPORT does not change what the scene draws', () => {
  // The frame is chrome painted outside the map rect, so it is not an input to
  // `renderScene` at all. This is the invariant behind "hiding the frame never
  // moves a tactical coordinate".
  const base = defaultLayerDocument()
  const withFrame = drawScene(base)
  const without = drawScene(
    normalizeLayerDocument({ ...base, layers: { ...base.layers, frame: { visible: false, locked: false } } }),
  )
  assert.deepEqual(without.calls, withFrame.calls)
})
