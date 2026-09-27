// Unit tests for the annotation type registry and hit-tester.
import test from 'node:test'
import assert from 'node:assert/strict'

import { TOOLS, KEY_TO_TOOL, TOOL_BY_ID, toolLabel } from '../src/data/tools.js'
import {
  ANNO_TYPES,
  ANNO_DEFAULTS,
  ANNO_PROPS,
  STROKE_PROP_DEFAULTS,
  FONT_WEIGHTS,
  withDefaults,
  annoHitScore,
  pickAnno,
  annoReadout,
  propsFor,
  propKeys,
  createMode,
} from '../src/lib/annoTypes.js'

// --- tool registry --------------------------------------------------------

test('every tool has the fields the UI relies on', () => {
  for (const t of TOOLS) {
    assert.ok(t.id, 'id')
    assert.ok(t.label, `${t.id} label`)
    assert.ok(t.desc, `${t.id} desc`)
    assert.ok(t.key, `${t.id} key`)
    assert.equal(typeof t.group, 'string', `${t.id} group`)
    assert.ok(t.icon, `${t.id} icon`)
  }
})

test('tool ids are unique', () => {
  const ids = TOOLS.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('keyboard shortcuts are unique and uppercase', () => {
  const keys = TOOLS.map((t) => t.key)
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${keys.join(',')}`)
  for (const t of TOOLS) assert.equal(t.key, t.key.toUpperCase(), `${t.id} key must be uppercase`)
})

test('KEY_TO_TOOL is the inverse of the tool list', () => {
  for (const t of TOOLS) {
    assert.equal(KEY_TO_TOOL[t.key], t.id, `key ${t.key} should select ${t.id}`)
  }
})

test('the original tools all survived the expansion', () => {
  for (const id of [
    'select', 'brush', 'line', 'arrow', 'circle', 'text', 'pin', 'compound',
    'eraser', 'smoke', 'ridge', 'vehicle', 'flight1', 'flight2',
  ]) {
    assert.ok(TOOL_BY_ID[id], `${id} must still exist (preservation rule 2)`)
  }
})

test('the new tools are registered', () => {
  for (const id of ['arrow2', 'rect', 'player', 'rotation', 'danger', 'fov', 'measure']) {
    assert.ok(TOOL_BY_ID[id], `${id} should be registered`)
  }
})

test('toolLabel never throws on an unknown id', () => {
  assert.equal(toolLabel('brush'), 'Pen')
  assert.equal(toolLabel('nope'), 'NOPE')
  assert.equal(toolLabel(''), '')
})

// --- properties -----------------------------------------------------------

test('every annotation type has a create mode and a default bag', () => {
  for (const [type, def] of Object.entries(ANNO_TYPES)) {
    assert.ok(def.mode, `${type} needs a create mode`)
    // 'select' is an interaction mode, not something that lands in the document.
    if (def.mode === 'select') continue
    assert.ok(ANNO_DEFAULTS[type], `${type} needs defaults`)
  }
})

test('every renderable type offers opacity, size and rotation', () => {
  for (const [type, def] of Object.entries(ANNO_TYPES)) {
    if (def.mode === 'select') continue
    assert.ok(propKeys(type).includes('opacity'), `${type} must offer opacity`)
    assert.ok(propKeys(type).includes('size'), `${type} must offer size`)
  }
})

test('every renderable type offers colour, except where the colour is not ours', () => {
  // A team marker's colour belongs to the team roster, so the one honest
  // exception is allowed. Any new type must opt in to being exempt.
  const EXEMPT = new Set(['team'])
  for (const [type, def] of Object.entries(ANNO_TYPES)) {
    if (def.mode === 'select' || EXEMPT.has(type)) continue
    assert.ok(propKeys(type).includes('color'), `${type} must offer colour`)
  }
})

test('text-only properties are not offered on non-text types', () => {
  assert.ok(propKeys('text').includes('fontSize'))
  assert.ok(propKeys('text').includes('fontWeight'))
  assert.ok(!propKeys('line').includes('fontSize'), 'a line has no text')
  assert.ok(!propKeys('pin').includes('fontSize'))
})

test('stroke width is offered on the types that actually stroke', () => {
  for (const t of ['line', 'arrow', 'arrow2', 'brush', 'rect', 'measure', 'rotation', 'ridge']) {
    assert.ok(propKeys(t).includes('width'), `${t} strokes`)
  }
  // A filled glyph has no stroke, so offering width there would be a dead control.
  for (const t of ['pin', 'player', 'vehicle']) {
    assert.ok(!propKeys(t).includes('width'), `${t} has no stroke to widen`)
  }
})

test('rotation is offered on every drawable type', () => {
  for (const [type, def] of Object.entries(ANNO_TYPES)) {
    if (def.mode === 'select') continue
    assert.ok(propKeys(type).includes('rot'), `${type} must be rotatable`)
  }
})

test('withDefaults fills gaps without overwriting the document', () => {
  const merged = withDefaults({ id: 'a', type: 'line', color: '#123456', points: [[0, 0], [1, 1]] })
  assert.equal(merged.color, '#123456', 'a stored value always wins')
  assert.equal(merged.width, STROKE_PROP_DEFAULTS.width)
  assert.equal(merged.opacity, 1)
  assert.equal(merged.size, 1)
  assert.equal(merged.rot, 0)
})

test('withDefaults leaves an unknown type alone', () => {
  const merged = withDefaults({ id: 'a', type: 'team', points: [[0, 0]] })
  assert.equal(merged.type, 'team')
  assert.ok(merged.points)
})

test('withDefaults treats an explicit undefined as "not specified"', () => {
  // Regression: a spread with an optional field clobbers the default with
  // `undefined`, and a rect that lost its opacity would draw at the renderer's
  // fallback instead of its own 12%.
  const fromAnno = withDefaults({ type: 'rect', opacity: undefined, points: [[0, 0]] })
  assert.equal(fromAnno.opacity, ANNO_DEFAULTS.rect.opacity, 'a lost field falls back to the default')

  const fromPatch = withDefaults({ type: 'rect', points: [[0, 0]] }, { opacity: undefined })
  assert.equal(fromPatch.opacity, ANNO_DEFAULTS.rect.opacity, 'and so does a lost patch field')

  // The key must be absent, not present-and-undefined, so `=== undefined` checks
  // in the renderer do not take a different branch than a missing key.
  assert.ok('opacity' in fromAnno)
  assert.ok(!('nope' in fromAnno), 'unknown keys are not invented')

  // Genuine values still override, including a deliberate 0 or empty string.
  assert.equal(withDefaults({ type: 'rect' }, { opacity: 0 }).opacity, 0)
  assert.equal(withDefaults({ type: 'text' }, { label: '' }).label, '')
})

test('withDefaults does not mutate its inputs', () => {
  const anno = { type: 'line', points: [[0, 0]], color: '#123456' }
  const before = JSON.stringify(anno)
  withDefaults(anno, { color: '#ffffff' })
  assert.equal(JSON.stringify(anno), before)
})

test('propsFor is safe for an unknown type', () => {
  assert.deepEqual(propsFor('mystery'), [])
})

test('font weights are the four the renderer can request', () => {
  assert.deepEqual(FONT_WEIGHTS.map((f) => f.value), [300, 500, 700, 900])
})

// --- hit testing ----------------------------------------------------------

// The hit tolerance is defined in SCREEN pixels and converted to world metres,
// so a test has to pick a pixels-per-metre and then reason in those metres.
// PPM = 26 / 20 makes the tolerance exactly 20 world metres, which keeps the
// "just inside / just outside" cases legible.
const PPM = 26 / 20
const TOL = 20
const hit = (a, wx, wy) => annoHitScore(a, wx, wy, PPM) > 0

test('the hit tolerance is a constant number of SCREEN pixels', () => {
  const a = { id: 'l', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]] }
  // 20 m off the line is a hit at one zoom and a miss at another, because the
  // tolerance is 26 screen px and not 20 metres. That is the whole point of it.
  assert.ok(annoHitScore(a, 500, 20, PPM) > 0, 'within tolerance at this zoom')
  assert.equal(annoHitScore(a, 500, 20, PPM * 4), 0, 'the same 20 m is now 5 screen px')
})

test('hit-tests a line along its length, not at its endpoints only', () => {
  const a = { id: 'l', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]] }
  assert.ok(hit(a, 500, 0), 'the middle of the line')
  assert.ok(hit(a, 500, TOL / 2), 'just off the line, within tolerance')
  assert.ok(hit(a, 0, 0), 'the start endpoint')
  assert.ok(hit(a, 1000, 0), 'the end endpoint')
  assert.ok(!hit(a, 500, TOL * 10), 'far away')
})

test('hit-tests a measurement line along its whole run', () => {
  const a = { id: 'm', type: 'measure', color: '#fff', points: [[0, 0], [1000, 0]] }
  assert.ok(hit(a, 500, 0), 'the middle of the measurement')
  assert.ok(hit(a, 500, TOL / 2), 'just off the line, within tolerance')
  assert.ok(!hit(a, 500, TOL * 10))
})

test('hit-tests a rect inside, on the edge, and outside', () => {
  const a = { id: 'r', type: 'rect', color: '#fff', points: [[0, 0], [400, 400]] }
  assert.ok(hit(a, 200, 200), 'inside')
  assert.ok(hit(a, 0, 200), 'on the left edge')
  assert.ok(hit(a, 400 + TOL / 2, 200), 'just outside the right edge, within tolerance')
  assert.ok(!hit(a, 400 + TOL * 10, 200), 'well outside')
})

test('a rect is draggable from either corner order', () => {
  const a = { id: 'r', type: 'rect', color: '#fff', points: [[400, 400], [0, 0]] }
  assert.ok(hit(a, 200, 200), 'the corners are normalised')
})

test('hit-tests a circle by its ring and its interior', () => {
  const a = { id: 'c', type: 'circle', color: '#fff', r: 200, points: [[500, 500]] }
  assert.ok(hit(a, 500, 500), 'the centre')
  assert.ok(hit(a, 700, 500), 'the ring')
  assert.ok(hit(a, 550, 500), 'inside')
  assert.ok(!hit(a, 700 + TOL * 10, 500), 'outside')
})

test('hit-tests a LEGACY two-point circle', () => {
  const a = { id: 'c', type: 'circle', color: '#fff', points: [[500, 500], [700, 500]] }
  assert.ok(hit(a, 700, 500), 'the ring, radius derived from the two points')
  assert.ok(hit(a, 500, 500), 'the centre')
  assert.ok(!hit(a, 700 + TOL * 10, 500), 'outside')
})

test('hit-tests a freehand brush along the stroke', () => {
  const a = { id: 'b', type: 'brush', color: '#fff', points: [[0, 0], [100, 100], [200, 0]] }
  assert.ok(hit(a, 50, 50), 'on the first leg')
  assert.ok(hit(a, 150, 50), 'on the second leg')
  assert.ok(!hit(a, 100, TOL * 10), 'below the stroke')
})

test('hit-tests a marker at its anchor', () => {
  const p = { id: 'p', type: 'player', color: '#fff', label: '1', points: [[400, 400]] }
  assert.ok(hit(p, 400, 400), 'the anchor')
  assert.ok(hit(p, 405, 405), 'a little off-centre')
  assert.ok(!hit(p, 400 + TOL * 10, 400), 'far away')
})

test('hit-tests text anywhere inside its box', () => {
  const t = { id: 't', type: 'text', color: '#fff', label: 'Rotate here', fontSize: 20, points: [[500, 500]] }
  assert.ok(hit(t, 500, 500), 'the anchor')
  assert.ok(hit(t, 520, 505), 'inside the rendered text')
  assert.ok(!hit(t, 500, 500 + TOL * 10), 'far below')
})

test('hit-tests a vision cone only inside the wedge', () => {
  const f = { id: 'f', type: 'fov', color: '#38bdf8', points: [[500, 500], [900, 500]], range: 400, angle: 60 }
  assert.ok(hit(f, 700, 500), 'straight ahead')
  assert.ok(hit(f, 700, 560), 'inside the 30 deg half-angle')
  assert.ok(hit(f, 500, 500), 'the apex itself')
  assert.ok(!hit(f, 700, 800), 'outside the angular opening')
  assert.ok(!hit(f, 1500, 500), 'beyond the range')
})

test('a vision cone hit-test follows its rotation', () => {
  const base = { id: 'f', type: 'fov', color: '#38bdf8', points: [[500, 500], [900, 500]], range: 400, angle: 60 }
  const spun = { ...base, rot: Math.PI / 2 }
  assert.ok(!hit(spun, 700, 500), 'the old direction is no longer covered')
  // Rotated 90 degrees about its apex, the wedge points down (+Y) from there.
  assert.ok(hit(spun, 500, 700), 'and now points down instead')
})

test('hit-tests a danger zone as a filled area', () => {
  const d = { id: 'd', type: 'danger', color: '#ef4444', r: 300, points: [[500, 500]] }
  assert.ok(hit(d, 500, 500), 'the centre')
  assert.ok(hit(d, 800, 500), 'the ring')
  assert.ok(!hit(d, 800 + TOL * 10, 500), 'outside')
})

test('an FOV cone and a danger zone do not steal each other clicks', () => {
  const f = { id: 'f', type: 'fov', color: '#38bdf8', points: [[500, 500], [900, 500]], range: 400, angle: 60 }
  const small = { id: 'd', type: 'danger', color: '#ef4444', r: 100, points: [[500, 500]] }
  assert.ok(hit(f, 700, 500), 'inside the cone')
  assert.ok(!hit(small, 700, 500), 'outside the small danger zone')
})

test('a hidden annotation is never hit', () => {
  const a = { id: 'l', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]], hidden: true }
  assert.equal(annoHitScore(a, 500, 0, PPM), 0)
})

test('a rotated object is hit-tested in its own local frame', () => {
  // A horizontal 1000 m line rotated 90 degrees about its centre becomes a
  // vertical one, so a click on the original horizontal is no longer on it.
  const a = { id: 'l', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]], rot: Math.PI / 2 }
  assert.ok(!hit(a, 200, 0), 'the old horizontal is empty now')
  // The rotated line runs from (500,-500) to (500,500).
  assert.ok(hit(a, 500, 200), 'along the rotated line')
})

// --- picking --------------------------------------------------------------

test('pickAnno returns the topmost hit', () => {
  const bottom = { id: 'b', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]] }
  const top = { id: 't', type: 'line', color: '#fff', points: [[0, 40], [1000, 40]] }
  const list = [bottom, top]
  assert.equal(pickAnno(list, 500, 0, PPM).id, 'b', 'the lower line is the only one there')
  assert.equal(pickAnno(list, 500, 40, PPM).id, 't', 'later entries paint on top')
  assert.equal(pickAnno(list, 500, 5000, PPM), null, 'empty space')
})

test('pickAnno skips hidden entries', () => {
  const hidden = { id: 'h', type: 'line', color: '#fff', points: [[0, 0], [1000, 0]], hidden: true }
  assert.equal(pickAnno([hidden], 500, 0, PPM), null)
})

test('pickAnno handles an empty list', () => {
  assert.equal(pickAnno([], 0, 0, PPM), null)
  assert.equal(pickAnno(null, 0, 0, PPM), null)
})

// --- readout --------------------------------------------------------------

test('annoReadout describes a length, a diameter, a cone and a point', () => {
  assert.equal(annoReadout({ type: 'line', points: [[0, 0], [1000, 0]] }), '1.00km')
  assert.equal(annoReadout({ type: 'measure', points: [[0, 0], [1240, 0]] }), '1.24km')
  assert.equal(annoReadout({ type: 'circle', r: 220, points: [[0, 0]] }), '⌀ 440m')
  assert.equal(annoReadout({ type: 'fov', points: [[0, 0], [1, 0]], angle: 90, range: 300 }), '90° · 300m')
  assert.equal(annoReadout({ type: 'pin', points: [[120, 340]] }), '120m, 340m')
  assert.equal(annoReadout({ type: 'brush', points: [] }), '—', 'an empty annotation is not a crash')
  assert.equal(annoReadout(null), '—')
})
