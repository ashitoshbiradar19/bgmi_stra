// Round-trip tests for the document's persistence paths.
//
// Every property the inspector can edit has to survive being saved and loaded.
// The risk is silent: a share link or an autosave that drops `rot` or `fontWeight`
// produces a board that *looks* fine until you reload and find a rotated cone
// pointing the wrong way. Share links are the nastier of the two because the
// state is LZW-compressed into the URL, so a bug there does not throw — it just
// quietly decodes to something slightly different.
import test from 'node:test'
import assert from 'node:assert/strict'

import { encodeState, decodeState } from '../src/lib/share.js'
import { withDefaults, ANNO_PROPS, propsFor } from '../src/lib/annoTypes.js'

/**
 * One annotation per drawable type, carrying every property its inspector
 * advertises. Built from the registry so a new property is covered the moment it
 * is declared, rather than the day someone remembers to add a fixture.
 */
const everyTypeWithEveryProperty = () =>
  Object.keys(ANNO_PROPS).map((type) => {
    const anno = withDefaults({ id: `${type}-1`, type, points: [[1000, 1000], [2200, 1800]] })
    for (const prop of propsFor(type)) anno[prop.key] = sampleValueFor(prop)
    return anno
  })

function sampleValueFor(prop) {
  switch (prop.kind) {
    case 'color':
    case 'logoUrl':
    case 'text':
      return '#A1B2C3'
    case 'opacity':
      return 0.42
    case 'stroke':
      return 7.5
    case 'size':
      return 1.85
    case 'rotation':
      return 0.7853981633974483
    case 'fontSize':
      return 33
    case 'fontWeight':
      return 400
    case 'radius':
      return 321
    case 'fovAngle':
      return 95
    case 'fovRange':
      return 640
    case 'bool':
      return true
    default:
      throw new Error(`no sample value for kind "${prop.kind}" — add one so new properties are covered`)
  }
}

const doc = () => ({
  circles: [{ id: 'c1', stage: 4, x: 4000, y: 4000, r: 740, color: '#00E5FF' }],
  annos: everyTypeWithEveryProperty(),
})

test('every editable property survives a share-link round trip', () => {
  const before = doc()
  const after = decodeState(encodeState(before))

  assert.equal(after.annos.length, before.annos.length, 'no annotation lost')
  for (let i = 0; i < before.annos.length; i++) {
    const a = before.annos[i]
    const b = after.annos[i]
    assert.equal(b.type, a.type, `${a.type} changed type`)
    for (const prop of propsFor(a.type)) {
      assert.deepEqual(b[prop.key], a[prop.key], `${a.type}.${prop.key} did not survive`)
    }
    assert.deepEqual(b.points, a.points, `${a.type} points did not survive`)
    assert.equal(b.id, a.id, `${a.type} id did not survive`)
  }
})

test('a rotated cone comes back rotated, not reset', () => {
  // The specific regression worth naming: rotation is a radian float, it is the
  // newest property on the newest type, and a defaulting layer anywhere in the
  // decode path would quietly reset it to 0.
  const before = {
    circles: [],
    annos: [{ id: 'f', type: 'fov', points: [[2000, 2000], [3000, 2000]], rot: 1.2, range: 640, angle: 95 }],
  }
  const after = decodeState(encodeState(before))
  assert.equal(after.annos[0].rot, 1.2)
  assert.equal(after.annos[0].range, 640)
  assert.equal(after.annos[0].angle, 95)
})

test('a circle radius survives, and the legacy two-point form is left alone', () => {
  const before = {
    circles: [],
    annos: [
      { id: 'modern', type: 'circle', points: [[2000, 2000]], r: 321 },
      // A board saved before `r` existed: radius implied by the second point.
      { id: 'legacy', type: 'circle', points: [[2000, 2000], [2500, 2000]] },
    ],
  }
  const after = decodeState(encodeState(before))
  assert.equal(after.annos[0].r, 321)
  assert.deepEqual(after.annos[1].points, [[2000, 2000], [2500, 2000]], 'legacy geometry untouched')
  assert.equal(after.annos[1].r, undefined, 'and no radius is invented for it')
})

test('fractional and zero values are not lost to rounding', () => {
  // A naive "drop falsy values" sanitiser would delete opacity: 0 and size: 0.
  const before = {
    circles: [],
    annos: [{ id: 'z', type: 'rect', points: [[0, 0], [10, 10]], opacity: 0, size: 0, width: 0, label: '' }],
  }
  const after = decodeState(encodeState(before))
  const a = after.annos[0]
  assert.equal(a.opacity, 0, 'opacity 0 is a real value, not a missing one')
  assert.equal(a.size, 0)
  assert.equal(a.width, 0)
  assert.equal(a.label, '', 'an empty label is still a label')
})

test('circles round trip unchanged', () => {
  const before = doc()
  const after = decodeState(encodeState(before))
  assert.deepEqual(after.circles, before.circles)
})

test('an encoded state is a URL-safe string', () => {
  const encoded = encodeState(doc())
  assert.equal(typeof encoded, 'string')
  assert.match(encoded, /^[A-Za-z0-9\-_]+$/, 'must be safe in a URL hash without escaping')
})

test('encoding is deterministic, so the same board gives the same link', () => {
  const before = doc()
  assert.equal(encodeState(before), encodeState(doc()), 'no timestamps or ids leaking in')
})

test('decode tolerates rubbish rather than throwing', () => {
  // A truncated or hand-edited share link must land on a safe empty board, not
  // crash the app on load.
  for (const junk of ['', '!!!', 'abc', '%%%', 'a'.repeat(500)]) {
    assert.doesNotThrow(() => decodeState(junk), JSON.stringify(junk.slice(0, 20)))
  }
})
