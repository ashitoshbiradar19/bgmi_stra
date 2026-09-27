// Layer registry + export selection tests.
//
// The failure modes these exist to prevent are all silent:
//
//  1. A new annotation type is added to `lib/annoTypes.js` and never given a
//     layer, so it silently falls back to Drawings and disappears with it.
//  2. Two layers claim the same type, so hiding one layer hides another.
//  3. A layer is hidden, but the exporter ignores it and ships it anyway — the
//     exact bug the panel was added to fix.
//  4. Reordering the stack corrupts the pinned Map/Frame positions, which would
//     move the frame over the map and shift every exported coordinate.
//
// Pure functions, so this file needs no canvas and no DOM.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LAYERS,
  LAYER_IDS,
  ANNO_LAYER_IDS,
  ALL_ANNO_TYPES,
  TYPE_TO_LAYER,
  layerOfType,
  layerOfAnno,
  getLayer,
  isPinned,
  defaultLayerState,
  defaultLayerDocument,
  normalizeLayerState,
  normalizeLayerOrder,
  normalizeLayerDocument,
  layerFlags,
  isLayerVisible,
  isLayerLocked,
  isAnnoVisible,
  isAnnoLocked,
  partitionAnnos,
  orderAnnos,
  exportSelection,
  moveLayer,
  soloLayer,
  isSoloed,
  packLayerDocument,
  unpackLayerDocument,
} from '../src/lib/layers.js'
import { saveStrategy, getSavedStrategies } from '../src/lib/storage.js'

// The eleven layers the panel promises, in stack order (bottom first).
const EXPECTED_ORDER = [
  'map',
  'teamMarkers',
  'enemyMarkers',
  'players',
  'rotations',
  'zones',
  'drawings',
  'text',
  'notes',
  'vehicles',
  'frame',
]

const anno = (type, extra = {}) => ({ id: type + '-' + Math.random().toString(36).slice(2, 8), type, points: [[0, 0]], ...extra })

test('the panel exposes exactly the eleven requested layers, in order', () => {
  assert.deepEqual(LAYER_IDS, EXPECTED_ORDER)
  assert.equal(LAYERS.length, 11)
  for (const id of EXPECTED_ORDER) {
    const layer = getLayer(id)
    assert.equal(layer.id, id)
    assert.ok(layer.label && layer.label.length, `${id} has a label`)
    assert.ok(layer.icon, `${id} has an icon`)
  }
})

test('Map is pinned to the bottom and Frame/Export to the top', () => {
  const order = defaultLayerDocument().order
  assert.equal(order[0], 'map')
  assert.equal(order[order.length - 1], 'frame')
  assert.ok(isPinned('map'))
  assert.ok(isPinned('frame'))
  for (const id of EXPECTED_ORDER) {
    if (id === 'map' || id === 'frame') continue
    assert.ok(!isPinned(id), `${id} should be reorderable`)
  }
})

test('every annotation type belongs to exactly one layer', () => {
  // The registry throws on a duplicate at import time, so simply reaching this
  // assertion proves there is no double-claim. Verify the full coverage too.
  assert.ok(ALL_ANNO_TYPES.length > 0)
  for (const type of ALL_ANNO_TYPES) {
    const id = layerOfType(type)
    assert.ok(LAYER_IDS.includes(id), `${type} maps into a real layer, got ${id}`)
  }
  // And nothing invented a type that does not exist.
  for (const [type, id] of Object.entries(TYPE_TO_LAYER)) {
    assert.ok(ALL_ANNO_TYPES.includes(type), `${type} is a real annotation type`)
    assert.ok(LAYER_IDS.includes(id))
  }
  assert.deepEqual(Object.keys(TYPE_TO_LAYER).sort(), [...ALL_ANNO_TYPES].sort())
})

test('the layer split matches what the user asked for', () => {
  const expected = {
    map: [],
    teamMarkers: ['team'],
    enemyMarkers: ['pin'],
    players: ['player'],
    rotations: ['rotation'],
    zones: ['danger', 'fov'],
    drawings: ['brush', 'line', 'arrow', 'arrow2', 'ridge', 'smoke', 'rect', 'circle', 'compound'],
    text: ['text'],
    notes: ['measure', 'flight', 'flight1', 'flight2'],
    vehicles: ['vehicle'],
    frame: [],
  }
  for (const [layerId, types] of Object.entries(expected)) {
    assert.deepEqual(getLayer(layerId).types || [], types, `${layerId} owns the right types`)
  }
  // Every type is claimed exactly once across the whole registry.
  const flat = Object.values(expected).flat()
  assert.deepEqual([...flat].sort(), [...ALL_ANNO_TYPES].sort())
})

test('defaults are visible, unlocked and in registry order', () => {
  const doc = defaultLayerDocument()
  assert.deepEqual(doc.order, EXPECTED_ORDER)
  for (const id of EXPECTED_ORDER) {
    assert.deepEqual(layerFlags(doc.layers, id), { visible: true, locked: false })
  }
})

test('normalizeLayerDocument survives junk without throwing', () => {
  for (const junk of [null, undefined, 0, '', 'x', [], { layers: null }, { order: 'nope' }]) {
    const doc = normalizeLayerDocument(junk)
    assert.deepEqual(doc.order, EXPECTED_ORDER, `order repaired for ${JSON.stringify(junk)}`)
    assert.equal(Object.keys(doc.layers).length, 11)
  }
  // Unknown layer ids are dropped rather than rendered as empty rows, and the
  // gap is backfilled in registry order, so the stack is always complete.
  const doc = normalizeLayerDocument({
    order: ['frame', 'ghost', 'map'],
    layers: { frame: { visible: false, locked: true }, ghost: { visible: false } },
  })
  assert.deepEqual(doc.order, EXPECTED_ORDER)
  assert.equal(layerFlags(doc.layers, 'frame').locked, true)

  // A valid partial order is preserved, not re-sorted. Map and Frame are still
  // forced to the ends, so the caller's order shows up in the middle.
  const custom = normalizeLayerDocument({ order: ['text', 'zones', 'map', 'frame'] })
  assert.deepEqual(custom.order[0], 'map')
  assert.deepEqual(custom.order[custom.order.length - 1], 'frame')
  assert.deepEqual(custom.order.slice(1, 3), ['text', 'zones'], 'the requested order survives')
  assert.equal(custom.order.length, 11)
})

test('layerFlags defaults to visible and unlocked', () => {
  assert.deepEqual(layerFlags(undefined, 'drawings'), { visible: true, locked: false })
  assert.deepEqual(layerFlags({}, 'drawings'), { visible: true, locked: false })
  assert.equal(isLayerVisible({ drawings: { visible: false } }, 'drawings'), false)
  assert.equal(isLayerLocked({ drawings: { locked: true } }, 'drawings'), true)
})

test('hiding and locking are independent', () => {
  const hidden = normalizeLayerState({ drawings: { visible: false } })
  assert.equal(isLayerLocked(hidden, 'drawings'), false)
  const locked = normalizeLayerState({ drawings: { locked: true } })
  assert.equal(isLayerVisible(locked, 'drawings'), true)
})

test('partitionAnnos splits into visible, selectable and the rest', () => {
  const a = anno('brush')
  const b = anno('text')
  const c = anno('pin')

  // Hidden: not drawn, not touchable.
  const hiddenDoc = normalizeLayerState({ drawings: { visible: false } })
  const h = partitionAnnos([a, b, c], hiddenDoc)
  assert.deepEqual(h.visible.map((x) => x.id), [b.id, c.id])
  assert.deepEqual(h.selectable.map((x) => x.id), [b.id, c.id])
  assert.deepEqual(h.hidden.map((x) => x.id), [a.id])

  // Locked: still drawn, but not selectable.
  const lockedDoc = normalizeLayerState({ text: { locked: true } })
  const l = partitionAnnos([a, b, c], lockedDoc)
  assert.deepEqual(l.visible.map((x) => x.id), [a.id, b.id, c.id])
  assert.deepEqual(l.selectable.map((x) => x.id), [a.id, c.id])
  assert.deepEqual(l.hidden, [], 'locked objects are not hidden, just untouchable')

  // A layer that is both: gone entirely.
  const both = normalizeLayerState({ text: { visible: false, locked: true } })
  const bo = partitionAnnos([a, b, c], both)
  assert.deepEqual(bo.visible.map((x) => x.id), [a.id, c.id])
  assert.deepEqual(bo.selectable.map((x) => x.id), [a.id, c.id])

  assert.equal(isAnnoVisible(hiddenDoc, a), false)
  assert.equal(isAnnoLocked(lockedDoc, b), true)
  assert.equal(isAnnoLocked(lockedDoc, a), false)
})

test('a null layer state is treated as "everything visible"', () => {
  const list = [anno('brush'), anno('text')]
  const r = partitionAnnos(list, null)
  assert.equal(r.visible.length, 2)
  assert.equal(r.selectable.length, 2)
})

test('orderAnnos stacks bottom to top without losing or duplicating objects', () => {
  const items = [anno('brush'), anno('text'), anno('team'), anno('vehicle'), anno('pin')]
  const order = defaultLayerDocument().order
  const out = orderAnnos(items, order)

  assert.equal(out.length, items.length, 'nothing is lost')
  assert.deepEqual(new Set(out.map((x) => x.id)).size, items.length, 'nothing is duplicated')
  // brush(6) < text(7) and team(1) < pin(2) < vehicle(9), so the stack order is
  // team, pin, brush, text, vehicle — and the two brushes keep their own order.
  assert.deepEqual(out.map((x) => x.type), ['team', 'pin', 'brush', 'text', 'vehicle'])

  // Reversing the stack regroups by layer rather than reversing the input list:
  // vehicle(1) < text(3) < brush(4) < pin(7) < team(8).
  const flipped = [...order].reverse()
  assert.deepEqual(
    orderAnnos(items, flipped).map((x) => x.type),
    ['vehicle', 'text', 'brush', 'pin', 'team'],
  )

  // A stack that names only two layers still sorts correctly against the rest.
  const textOnTop = orderAnnos(items, ['teamMarkers', 'enemyMarkers', 'players', 'rotations', 'zones', 'drawings', 'text', 'notes', 'vehicles'])
  assert.equal(textOnTop[textOnTop.length - 1].type, 'vehicle')
})

test('orderAnnos puts a whole layer above another, not just one object', () => {
  const first = [anno('text'), anno('text')]
  const second = [anno('brush')]
  const order = ['text', 'drawings'] // text at the bottom, drawings on top
  const out = orderAnnos([...first, ...second], order)
  assert.deepEqual(out.map((x) => x.id), [...first, ...second].map((x) => x.id))
})

test('moveLayer respects the pinned ends and is a no-op at the boundaries', () => {
  const order = defaultLayerDocument().order

  // Map and Frame never move.
  assert.deepEqual(moveLayer(order, 'map', -1), order)
  assert.deepEqual(moveLayer(order, 'map', 1), order)
  assert.deepEqual(moveLayer(order, 'frame', 1), order)
  assert.deepEqual(moveLayer(order, 'frame', -1), order)

  // A reorderable layer swaps exactly one step.
  const moved = moveLayer(order, 'zones', 1)
  assert.notDeepEqual(moved, order)
  assert.equal(moved[0], 'map')
  assert.equal(moved[moved.length - 1], 'frame')
  assert.equal(moved.indexOf('zones'), order.indexOf('zones') + 1)
  assert.equal(moved.filter((x) => x === 'zones').length, 1)
  assert.equal(moved.length, order.length)

  // Unknown ids are ignored.
  assert.deepEqual(moveLayer(order, 'ghost', 1), order)
  // teamMarkers sits directly above the pinned Map, so it cannot move down.
  assert.deepEqual(moveLayer(order, 'teamMarkers', -1), order, 'nothing can swap with the pinned Map')
  // The other pinned end, mirrored: the topmost free layer cannot move down past
  // Frame, and Frame itself never moves either way.
  assert.deepEqual(moveLayer(order, 'vehicles', 1), order, 'nothing can swap with the pinned Frame')
  assert.deepEqual(moveLayer(order, 'frame', 1), order)
})

test('moveLayer can never push a layer past the pinned ends', () => {
  const order = defaultLayerDocument().order
  let cur = order
  for (let i = 0; i < 40; i++) cur = moveLayer(cur, 'players', 1)
  assert.equal(cur[0], 'map')
  assert.equal(cur[cur.length - 1], 'frame')
  assert.equal(cur.indexOf('players'), cur.length - 2, 'stops just below Frame')

  for (let i = 0; i < 40; i++) cur = moveLayer(cur, 'players', -1)
  assert.equal(cur[0], 'map')
  assert.equal(cur.indexOf('players'), 1, 'stops just above Map')
})

test('the order array is always a complete permutation of the layers', () => {
  let cur = defaultLayerDocument().order
  for (let i = 0; i < 20; i++) {
    cur = moveLayer(cur, 'drawings', i % 2 ? -1 : 1)
    assert.deepEqual([...cur].sort(), [...EXPECTED_ORDER].sort())
  }
})

test('exportSelection drops hidden layers and the per-annotation hidden flag', () => {
  const team = anno('team')
  const pin = anno('pin')
  const brush = anno('brush')
  const text = anno('text')
  text.hidden = true
  const circles = [{ id: 'c1', stage: 1, r: 100, x: 500, y: 500 }]

  const out = exportSelection([team, pin, brush, text], circles, {
    ...defaultLayerDocument(),
    layers: normalizeLayerState({
      teamMarkers: { visible: false },
      zones: { visible: false },
      drawings: { visible: false },
      text: { visible: false },
    }),
  })

  // The four hidden layers are gone, and so is the `hidden` text.
  assert.deepEqual(out.annos, [pin])
  // Hiding Zones drops the playzone circles with it.
  assert.deepEqual(out.circles, [])
  // Map and Frame are untouched.
  assert.equal(out.mapVisible, true)
  assert.equal(out.frameVisible, true)
})

test('exportSelection with a clean document exports everything', () => {
  const items = [anno('team'), anno('pin'), anno('brush'), anno('text'), anno('measure')]
  const circles = [{ id: 'c1', stage: 2, r: 200, x: 1, y: 2 }]
  const out = exportSelection(items, circles, defaultLayerDocument())
  assert.equal(out.annos.length, 5)
  assert.equal(out.circles.length, 1)
  assert.equal(out.mapVisible, true)
  assert.equal(out.frameVisible, true)
})

test('exportSelection with no layer document exports everything (old boards)', () => {
  const items = [anno('team'), anno('brush')]
  const out = exportSelection(items, [], undefined)
  assert.equal(out.annos.length, 2)
  assert.equal(out.mapVisible, true)
  assert.equal(out.frameVisible, true)
  assert.equal(out.circles.length, 0)
})

test('locking a layer does not change the export', () => {
  const items = [anno('team'), anno('brush')]
  const locked = exportSelection(items, [], {
    ...defaultLayerDocument(),
    layers: normalizeLayerState({ teamMarkers: { locked: true }, drawings: { locked: true } }),
  })
  assert.equal(locked.annos.length, 2, 'locked objects still export')
})

test('Map and Frame resolve to booleans for the composer', () => {
  const none = [{ id: 'c1' }]
  const off = exportSelection([], none, {
    ...defaultLayerDocument(),
    layers: normalizeLayerState({ map: { visible: false }, frame: { visible: false } }),
  })
  assert.equal(off.mapVisible, false)
  assert.equal(off.frameVisible, false)

  // Hiding Map and Frame does not touch the annotation list at all.
  const items = [anno('brush')]
  const stillThere = exportSelection(items, [], {
    ...defaultLayerDocument(),
    layers: normalizeLayerState({ map: { visible: false }, frame: { visible: false } }),
  })
  assert.equal(stillThere.annos.length, 1)
})

test('the export order follows a reordered stack', () => {
  const items = [anno('text'), anno('team')]
  // Team on top of Text instead of the other way round.
  const order = ['text', 'teamMarkers']
  const out = exportSelection(items, [], { ...defaultLayerDocument(), order: normalizeLayerOrder(order) })
  assert.deepEqual(out.annos.map((a) => a.type), ['text', 'team'])
})

test('packLayerDocument round-trips through a share link', () => {
  const doc = normalizeLayerDocument({
    order: ['map', 'text', 'teamMarkers', 'enemyMarkers', 'players', 'rotations', 'zones', 'drawings', 'notes', 'vehicles', 'frame'],
    layers: {
      teamMarkers: { visible: false, locked: false },
      drawings: { visible: true, locked: true },
      frame: { visible: false, locked: false },
      map: { visible: true, locked: true },
    },
  })
  const back = unpackLayerDocument(packLayerDocument(doc))
  assert.deepEqual(back, doc)
  assert.equal(layerFlags(back.layers, 'teamMarkers').visible, false)
  assert.equal(layerFlags(back.layers, 'drawings').locked, true)
  assert.equal(layerFlags(back.layers, 'frame').visible, false)
  assert.equal(layerFlags(back.layers, 'map').locked, true)
})

test('unpackLayerDocument defaults a missing or corrupt payload', () => {
  for (const junk of [null, undefined, 0, 'x', [], {}, { l: null }, { o: ['ghost'], l: { ghost: 1 } }]) {
    const doc = unpackLayerDocument(junk)
    assert.deepEqual(doc.order, EXPECTED_ORDER)
    assert.equal(Object.keys(doc.layers).length, 11)
  }
})

test('ANNO_LAYER_IDS names every layer that owns annotations', () => {
  const owning = LAYERS.filter((l) => (l.types || []).length).map((l) => l.id)
  assert.deepEqual([...ANNO_LAYER_IDS].sort(), [...owning].sort())
  // Map and Frame own no annotations, by design.
  assert.ok(!ANNO_LAYER_IDS.includes('map'))
  assert.ok(!ANNO_LAYER_IDS.includes('frame'))
})

test('layerOfAnno and getLayer tolerate rubbish', () => {
  assert.equal(layerOfAnno(null), 'drawings')
  assert.equal(layerOfAnno({ type: 'wat' }), 'drawings')
  assert.equal(getLayer('nope').id, 'drawings')
  assert.equal(layerOfType(undefined), 'drawings')
})

// --- wiring: the panel is actually reachable, and actually used ------------
//
// The registry above can be perfect while the panel is never mounted, or while
// the exporter keeps ignoring it. Both failures are invisible in the unit tests,
// so assert against the real component source.

import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sidebarSrc = read('../src/components/Sidebar.jsx')
const panelSrc = read('../src/components/LayersPanel.jsx')
const appSrc = read('../src/App.jsx')
const canvasSrc = read('../src/components/MapCanvas.jsx')
const exportSrc = read('../src/lib/export.js')
const previewSrc = read('../src/components/ExportPreview.jsx')

test('the Layers panel is mounted in the sidebar as its own tab', () => {
  assert.match(sidebarSrc, /import LayersPanel from '\.\/LayersPanel'/)
  assert.match(sidebarSrc, /\{ id: 'layers', label: 'Layers' \}/)
  assert.match(sidebarSrc, /\{tab === 'layers' &&/, 'the tab body renders the panel')
  assert.match(sidebarSrc, /<LayersPanel/)
})

test('the panel is fed the layer document and the objects it counts', () => {
  assert.match(sidebarSrc, /layerDocument=\{layerDoc\}/)
  assert.match(sidebarSrc, /onChange=\{setLayerDoc\}/)
  assert.match(sidebarSrc, /annos=\{annos\}/, 'counts come from the full list, not the filtered one')
})

test('the old per-type layer toggles are gone', () => {
  assert.doesNotMatch(sidebarSrc, /LAYER_TYPES/)
  assert.doesNotMatch(sidebarSrc, /toggleLayer/)
  assert.doesNotMatch(appSrc, /const \[layers, setLayers\]/, 'replaced by the layer document')
})

test('the panel exposes a visibility and a lock control for every layer', () => {
  // One row component, driven by the registry, so this holds for all eleven.
  assert.match(panelSrc, /onToggleVisible/)
  assert.match(panelSrc, /onToggleLock/)
  assert.match(panelSrc, /aria-pressed=\{flags\.visible\}/)
  assert.match(panelSrc, /aria-pressed=\{flags\.locked\}/)
  // Driven by data, not a hand-written list that could drift from the registry.
  assert.match(panelSrc, /LAYERS/)
  assert.doesNotMatch(panelSrc, /id: 'teamMarkers'/, 'no hard-coded layer ids in the view')
})

test('the panel offers layer selection and ordering', () => {
  assert.match(panelSrc, /moveLayer/, 'ordering goes through the tested helper')
  assert.match(panelSrc, /Move \$\{layer\.label\} up/)
  assert.match(panelSrc, /Move \$\{layer\.label\} down/)
  assert.match(panelSrc, /isPinned/, 'pinned layers are not draggable')
  // Every row is a real <li>, i.e. an addressable layer entry.
  assert.match(panelSrc, /<li/)
})

test('a layer can actually be selected, not just listed', () => {
  // Selection has to be a real control with real state, or the panel offers
  // nothing to select and the affordance is decorative.
  assert.match(panelSrc, /useState\(null\)/, 'the panel tracks a selected layer')
  assert.match(panelSrc, /onSelect=/, 'each row receives a select handler')
  assert.match(panelSrc, /aria-pressed=\{selected\}/, 'and reports its state to assistive tech')
  assert.match(panelSrc, /data-selected=/, 'the selected row is addressable in tests')
  assert.match(panelSrc, /setSelectedLayerId/, 'selecting updates the panel state')
  // Clicking the selected row again clears it, so a mis-click is recoverable.
  assert.match(panelSrc, /cur === id \? null : id/)
})

test('the selected layer is the scope for its actions', () => {
  // Without this, selecting a layer would be inert.
  assert.match(panelSrc, /soloLayer\(layers, /, 'solo goes through the tested helper')
  assert.match(panelSrc, /data-layer-actions=\{selectedLayer\.id\}/)
  assert.match(panelSrc, /isSoloed\(layers, selectedLayer\.id\)/, 'and the control disables itself')
})

test('layer selection is panel-local and never reaches the board', () => {
  // Selection is a transient view concern, like which tab is open. If it were
  // written into the layer document it would travel in share links and autosave.
  assert.match(panelSrc, /useState\(null\)/)
  assert.doesNotMatch(panelSrc, /selectedLayer[A-Za-z]*:\s*selectedLayerId/)
  const onChangeCalls = panelSrc.match(/onChange\(\{/g) || []
  // Every onChange call passes the document it was given, never a selection.
  for (const call of panelSrc.split('onChange({').slice(1)) {
    const head = call.split('}')[0]
    assert.doesNotMatch(head, /selectedLayerId/, 'a selection leaked into the document')
  }
  assert.ok(onChangeCalls.length > 0)
})

test('App draws visible layers in stack order and hit-tests the selectable subset', () => {
  assert.match(appSrc, /const \{ visible: visibleAnnos, selectable: selectableAnnos \} = useMemo\(\s*\(\) => partitionAnnos\(/)
  assert.match(appSrc, /orderAnnos\(\s*visibleAnnos,\s*layerDoc\.order,?\s*\)/)
  // Render gets the ordered visible list, interaction gets the selectable one.
  assert.match(appSrc, /annos=\{orderedAnnos\}/)
  assert.match(appSrc, /selectableAnnos=\{selectableAnnos\}/)
  assert.match(appSrc, /visibleCircles=\{visibleCircles\}/)
  assert.match(appSrc, /toolLocked=\{activeToolLocked\}/)
})

test('MapCanvas hit-tests the selectable list, never the drawn list', () => {
  assert.match(canvasSrc, /selectableAnnos: touch/)
  // Every hit-test goes through `touch`, so a locked object cannot be grabbed.
  for (const fn of ['hitPointAnno', 'hitLineAnno', 'hitCompound', 'hitCircleAnno']) {
    const calls = canvasSrc.match(new RegExp(`${fn}\\(wx, wy, \\w+\\)`, 'g')) || []
    assert.ok(calls.length > 0, `${fn} is called`)
    for (const c of calls) assert.match(c, /\w+, touch\)/, `${fn} hit-tests the selectable list`)
  }
  // Auto-labelling still counts every object, so labels stay unique.
  assert.match(canvasSrc, /as\.filter\(\(a\) => a\.type === 'pin'\)/)
})

test('a locked layer cannot receive new objects', () => {
  assert.match(appSrc, /if \(isLayerLocked\(layerDoc\.layers, 'zones'\)\)/)
  assert.match(canvasSrc, /if \(toolLocked && tool !== 'select' && tool !== 'eraser'\) return/)
})

test('the exporter is the single place that resolves layer visibility', () => {
  assert.match(exportSrc, /import \{ exportSelection \} from '\.\/layers'/)
  assert.match(exportSrc, /const sel = exportSelection\(board\.annos, board\.circles, board\.layerDocument\)/)
  assert.match(exportSrc, /annos: sel\.annos/)
  assert.match(exportSrc, /circles: sel\.circles/)
  assert.match(exportSrc, /image: sel\.mapVisible \? board\.mapImage : null/)
  // The old always-export-everything filter must be gone.
  assert.doesNotMatch(exportSrc, /board\.annos\.filter\(\(a\) => !a\.hidden\)/)
})

test('hiding Frame/Export only drops the template, never the map rectangle', () => {
  assert.match(exportSrc, /const frameWanted = sel\.frameVisible/)
  assert.match(exportSrc, /const template = frame && frameWanted \? getTemplate\(frame\.templateId\) : null/)
  // The layout is computed from the (null-template) template either way, so
  // computeFrameLayout still sees contentAspect and the map rect is unchanged.
  assert.match(exportSrc, /computeFrameLayout\(\{\s*template: template \|\| getTemplate\('none'\)/)
  // No mapX/mapY adjustment is gated on frame visibility.
  // Anchor on the call, not the import, or the block swallows the whole file.
  const layoutBlock = exportSrc.slice(
    exportSrc.indexOf('const layout = computeFrameLayout('),
    exportSrc.indexOf('renderScene(ctx'),
  )
  assert.ok(layoutBlock.length > 0, 'the layout block was located')
  assert.doesNotMatch(layoutBlock, /frameVisible|frameWanted/, 'the layout never reads frame visibility')
})

test('layer state survives a reload, a share link and a named strategy', () => {
  assert.match(appSrc, /layerDoc,\n\s*mapsData:/, 'autosave')
  assert.match(appSrc, /if \(auto\.layerDoc\) setLayerDoc\(normalizeLayerDocument\(auto\.layerDoc\)\)/)
  assert.match(appSrc, /L: packLayerDocument\(layerDoc\),/, 'share link')
  assert.match(appSrc, /if \(s\.L\) setLayerDoc\(unpackLayerDocument\(s\.L\)\)/)
  assert.match(appSrc, /saveStrategy\(title, \{ mapId, circles, annos, layerDoc \}\)/)
})

test('the export preview re-renders when layer state changes', () => {
  assert.match(previewSrc, /JSON\.stringify\(board\.layerDocument\?\.layers \|\| null\)/)
  assert.match(previewSrc, /\(board\.layerDocument\?\.order \|\| \[\]\)\.join\(','\)/)
})

// --- every symbol used from lib/layers.js is actually imported --------------
//
// Vite/esbuild does not resolve free identifiers, so a missing import compiles
// cleanly and only blows up at runtime, in the browser, as a blank screen. That
// happened twice while building this feature (App.jsx and export.js each lost
// their import block to a failed edit) and the unit tests were green. This test
// turns that class of mistake into a build failure.

const EXPORTS = [
  'LAYERS', 'LAYER_IDS', 'ANNO_LAYER_IDS', 'ALL_ANNO_TYPES', 'TYPE_TO_LAYER',
  'layerOfType', 'layerOfAnno', 'getLayer', 'isPinned', 'defaultLayerState',
  'defaultLayerDocument', 'normalizeLayerState', 'normalizeLayerOrder',
  'normalizeLayerDocument', 'layerFlags', 'isLayerVisible', 'isLayerLocked',
  'isAnnoVisible', 'isAnnoLocked', 'partitionAnnos', 'orderAnnos',
  'exportSelection', 'moveLayer', 'packLayerDocument', 'unpackLayerDocument',
]

const CONSUMERS = [
  ['../src/App.jsx', appSrc],
  ['../src/components/LayersPanel.jsx', panelSrc],
  ['../src/components/Sidebar.jsx', sidebarSrc],
  ['../src/components/MapCanvas.jsx', canvasSrc],
  ['../src/lib/export.js', exportSrc],
]

test('lib/layers.js exports everything the panel and the editor use', async () => {
  const mod = await import('../src/lib/layers.js')
  for (const name of EXPORTS) {
    assert.ok(name in mod, `layers.js should export ${name}`)
  }
})

for (const [file, src] of CONSUMERS) {
  test(`${file} imports every lib/layers.js symbol it uses`, () => {
    // Which named bindings does this file import from ../lib/layers or ./layers?
    // Path-agnostic: consumers sit at src/ or src/components/, so the specifier
    // is './layers', './lib/layers' or '../lib/layers' depending on depth.
    const re = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*layers['"]/g
    const imported = new Set()
    let sawImport = false
    let m
    while ((m = re.exec(src))) {
      sawImport = true
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim()
        if (name) imported.add(name)
      }
    }

    // Which of those symbols does the file actually reference?
    const used = EXPORTS.filter((name) => {
      const re = new RegExp(`(?<![\\w$.'"\`])${name}(?![\\w$])`)
      // Count references outside the import statement itself.
      const stripped = src.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"]/g, '')
      return re.test(stripped)
    })

    if (used.length === 0) {
      assert.ok(!sawImport || imported.size === 0, `${file} should not import layers unused`)
      return
    }
    assert.ok(sawImport, `${file} uses ${used.join(', ')} but never imports from lib/layers`)
    for (const name of used) {
      assert.ok(imported.has(name), `${file} uses ${name}() but does not import it from lib/layers`)
    }
  })
}

test('every lib/layers.js symbol is used somewhere', () => {
  // Not a correctness rule, just a smell check: a helper nobody calls is
  // either dead code or a feature that was never wired up.
  const all = read('../src/lib/layers.js') + CONSUMERS.map(([, s]) => s).join('\n')
  const unused = EXPORTS.filter((name) => {
    const re = new RegExp(`(?<![\\w$.'"\`])${name}(?![\\w$])`)
    return !re.test(all)
  })
  assert.deepEqual(unused, [], 'unused exports suggest an unfinished feature')
})

test('a locked Zones layer keeps its playzones drawn but out of reach', () => {
  // A lock protects work; it must never make work disappear. Hiding is the only
  // control that removes a layer from the canvas.
  const appSrc = read('../src/App.jsx')
  assert.match(appSrc, /const selectableCircles = useMemo\(/)
  assert.match(
    appSrc,
    /\(\) => \(zonesLocked \? \[\] : visibleCircles\)/,
    'locked Zones must be excluded from the grabbable list',
  )
  assert.doesNotMatch(
    appSrc,
    /visible:\s*layerFlags\(layerDoc\.layers, 'zones'\)\.visible && !isLayerLocked/,
    'locking Zones must not feed into what is drawn',
  )
  const canvasSrc = read('../src/components/MapCanvas.jsx')
  assert.match(canvasSrc, /const hitCs = selCs \|\| visCs \|\| cs/)
})

test('saved strategies carry the layer document and read it back', () => {
  const storageSrc = read('../src/lib/storage.js')
  assert.match(storageSrc, /layerDoc: state\.layerDoc \|\| null/)
  const appSrc = read('../src/App.jsx')
  assert.match(appSrc, /if \(strat\.layerDoc\) setLayerDoc\(normalizeLayerDocument\(strat\.layerDoc\)\)/)
})

test('a saved strategy round-trips the layer document through localStorage', () => {
  // Guards the regression where `saveStrategy` accepted a `layerDoc` and then
  // wrote an object without it, so every saved board came back with the default
  // stack no matter what the panel said before saving.
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const hidden = normalizeLayerDocument({
    ...defaultLayerDocument(),
    layers: { ...defaultLayerDocument().layers, zones: { visible: false, locked: true } },
  })
  const [saved] = saveStrategy('lockdown', {
    mapId: 'erangel',
    circles: [],
    annos: [],
    layerDoc: hidden,
  })
  assert.deepEqual(saved.layerDoc.layers.zones, { visible: false, locked: true })

  // What comes back out of storage has to survive normalization unchanged,
  // which is what the load path does before handing it to the panel.
  const reloaded = normalizeLayerDocument(JSON.parse(JSON.stringify(getSavedStrategies()[0].layerDoc)))
  assert.deepEqual(reloaded.layers.zones, { visible: false, locked: true })
  assert.deepEqual(reloaded.order, hidden.order)
})

// --- soloing ---------------------------------------------------------------

test('soloLayer shows one layer and hides every other', () => {
  const state = defaultLayerState()
  const soloed = soloLayer(state, 'zones')
  assert.equal(soloed.zones.visible, true)
  for (const id of LAYER_IDS) {
    if (id === 'zones') continue
    assert.equal(soloed[id].visible, false, `${id} stayed visible when soloing zones`)
  }
})

test('soloLayer is reversible, so a solo can be undone by showing all', () => {
  // The panel pairs "Show only this" with "Show all", so the round trip has to
  // land back on the default rather than on a half-hidden board.
  const state = defaultLayerState()
  const back = Object.fromEntries(
    Object.entries(soloLayer(state, 'text')).map(([id, v]) => [id, { ...v, visible: true }]),
  )
  assert.deepEqual(back, state)
})

test('soloLayer does not unlock anything', () => {
  // Soloing is a visibility change. If it also unlocked a layer, a locked
  // layer would quietly become editable as a side effect of looking at it.
  const state = { ...defaultLayerState(), teamMarkers: { visible: true, locked: true } }
  const soloed = soloLayer(state, 'teamMarkers')
  assert.equal(soloed.teamMarkers.locked, true, 'soloing unlocked a locked layer')
})

test('soloLayer does not mutate the state it was given', () => {
  const state = defaultLayerState()
  const snapshot = JSON.stringify(state)
  soloLayer(state, 'map')
  assert.equal(JSON.stringify(state), snapshot)
})

test('soloLayer tolerates an unknown or missing layer id', () => {
  const state = defaultLayerState()
  const out = soloLayer(state, 'not-a-layer')
  // Nothing matched, so nothing is visible, and every key still exists.
  for (const id of LAYER_IDS) assert.equal(out[id].visible, false)
  assert.doesNotThrow(() => soloLayer(null, 'zones'))
})

test('isSoloed is true only for the single visible layer', () => {
  const state = soloLayer(defaultLayerState(), 'vehicles')
  assert.equal(isSoloed(state, 'vehicles'), true)
  for (const id of LAYER_IDS) {
    if (id === 'vehicles') continue
    assert.equal(isSoloed(state, id), false, `${id} reported as soloed`)
  }
  // Nothing soloed, and everything visible, are both "not soloed".
  assert.equal(isSoloed(defaultLayerState(), 'zones'), false)
  const noneVisible = Object.fromEntries(LAYER_IDS.map((id) => [id, { visible: false, locked: false }]))
  assert.equal(isSoloed(noneVisible, 'zones'), false)
})
