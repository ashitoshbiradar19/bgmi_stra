// The inspector layout is data-driven, so its correctness is a data question:
// does every property the registry advertises have a control that can actually
// render it, and does it land in a section? These tests are the guard for the
// "control that silently does nothing" failure mode.
import test from 'node:test'
import assert from 'node:assert/strict'

import { CONTROL_KINDS, SECTIONS, sectionFor, groupProps } from '../src/lib/inspectorSchema.js'
import { ANNO_PROPS, CIRCLE_PROPS, propsFor, ANNO_TYPES, withDefaults } from '../src/lib/annoTypes.js'
import { TOOLS, KEY_TO_TOOL } from '../src/data/tools.js'

const allProps = [...Object.values(ANNO_PROPS).flat(), ...CIRCLE_PROPS]

test('every property kind in the registry has a control that renders it', () => {
  const kinds = new Set(allProps.map((p) => p.kind))
  for (const kind of kinds) {
    assert.ok(CONTROL_KINDS.has(kind), `no control implements kind "${kind}"`)
  }
})

test('every control kind is reachable from the registry', () => {
  // Guards against a typo'd CONTROL_KINDS entry that nothing can ever produce.
  const kinds = new Set(allProps.map((p) => p.kind))
  for (const kind of CONTROL_KINDS) {
    assert.ok(kinds.has(kind), `control "${kind}" has no property using it`)
  }
})

test('every property kind maps to a real section', () => {
  for (const prop of allProps) {
    const section = sectionFor(prop.kind)
    assert.ok(section, `kind "${prop.kind}" has no section`)
    assert.ok(SECTIONS.includes(section), `kind "${prop.kind}" -> unknown section "${section}"`)
  }
})

test('no section is empty in the declared order', () => {
  assert.deepEqual(SECTIONS, ['Identity', 'Geometry', 'Typography', 'Appearance', 'Transform', 'Options'])
})

test('groupProps places every property exactly once, in section order', () => {
  const { groups, orphans } = groupProps(ANNO_PROPS.fov)
  assert.deepEqual(orphans, [], 'nothing should be orphaned')
  assert.deepEqual(Object.keys(groups), ['Identity', 'Geometry', 'Appearance', 'Transform'])
  const flat = Object.values(groups).flat()
  assert.equal(flat.length, ANNO_PROPS.fov.length, 'no property dropped or duplicated')
  // Within a section the registry's own order is preserved.
  assert.deepEqual(flat.filter((p) => p.kind === 'fovRange').map((p) => p.key), ['range'])
  assert.deepEqual(flat.filter((p) => p.kind === 'fovAngle').map((p) => p.key), ['angle'])
})

test('groupProps never emits an empty section', () => {
  const { groups } = groupProps(ANNO_PROPS.pin) // no width, no geometry props
  for (const list of Object.values(groups)) assert.ok(list.length > 0)
  assert.ok(!('Typography' in groups), 'pin has no text properties')
  assert.ok(!('Geometry' in groups), 'pin has no geometry properties')
})

test('groupProps reports an orphan instead of dropping it silently', () => {
  const { groups, orphans } = groupProps([{ key: 'weird', kind: 'notAKind' }])
  assert.equal(orphans.length, 1, 'a kind with no section is surfaced, not hidden')
  assert.deepEqual(groups, {}, 'and it is not rendered under a wrong heading')
})

test('groupProps tolerates an empty list', () => {
  assert.deepEqual(groupProps([]), { groups: {}, orphans: [] })
  assert.deepEqual(groupProps(undefined), { groups: {}, orphans: [] })
})

test('every drawable tool type exposes at least one editable property', () => {
  for (const tool of TOOLS) {
    // `select` is an interaction mode and `eraser` deletes; neither makes annos.
    if (tool.id === 'select' || tool.id === 'eraser') continue
    assert.ok(propsFor(tool.id).length > 0, `${tool.id} has no editable properties`)
  }
})

test('every type the canvas can create has a property list', () => {
  for (const type of Object.keys(ANNO_TYPES)) {
    if (type === 'select') continue
    assert.ok(propsFor(type).length > 0, `${type} is creatable but has no properties`)
  }
})

test('every type the canvas can create has default values', () => {
  for (const type of Object.keys(ANNO_TYPES)) {
    if (type === 'select') continue
    const eff = withDefaults(type)
    assert.ok(eff.type === undefined || eff.type === type)
    assert.ok(Object.keys(eff).length > 0, `${type} has no defaults`)
  }
})

test('defaults resolve so the inspector shows what the renderer draws', () => {
  // rect is genuinely 12% opaque and fov's cone is 420m; a hardcoded fallback
  // in the inspector would display a different number from the real one.
  assert.equal(withDefaults('rect').opacity, 0.12)
  assert.equal(withDefaults('brush').opacity, 0.88)
  assert.equal(withDefaults('fov').range, 420)
  assert.equal(withDefaults('smoke').r, 15)
  assert.equal(withDefaults('danger').r, 220)
  // A stored value always wins over the default.
  assert.equal(withDefaults({ type: 'rect', opacity: 0.5 }).opacity, 0.5)
  // An explicit undefined must not blank out a usable default.
  assert.equal(withDefaults({ type: 'rect', opacity: undefined }).opacity, 0.12)
})

test('every type defaulting a colour also advertises the colour control', () => {
  // Team markers are the one documented exception: their colour comes from the
  // roster, so offering a colour input would be an input that does nothing.
  for (const type of Object.keys(ANNO_PROPS)) {
    const hasColorDefault = withDefaults(type).color !== undefined
    const hasColorControl = propsFor(type).some((p) => p.kind === 'color')
    if (type === 'team') {
      assert.equal(hasColorControl, false, 'team colour is roster-owned')
      continue
    }
    assert.equal(hasColorControl, hasColorDefault, `${type}: colour control/default mismatch`)
  }
})

test('team markers expose the properties that genuinely apply', () => {
  const kinds = propsFor('team').map((p) => p.kind)
  assert.ok(kinds.includes('opacity'), 'opacity applies')
  assert.ok(kinds.includes('size'), 'size applies')
  assert.ok(kinds.includes('rotation'), 'rotation applies')
  assert.ok(!kinds.includes('color'), 'colour is roster-owned')
})

test('numeric properties are not also offered as booleans', () => {
  for (const prop of allProps) {
    if (prop.kind === 'bool') {
      assert.ok(
        ['dashed', 'hatched', 'open', 'showName', 'plainText'].includes(prop.key),
        `unexpected boolean "${prop.key}"`,
      )
    } else {
      assert.notEqual(prop.kind, 'bool', `${prop.key} is declared twice`)
    }
  }
})

test('the keyboard registry stays in sync with the tool registry', () => {
  const toolIds = new Set(TOOLS.map((t) => t.id))
  for (const [key, id] of Object.entries(KEY_TO_TOOL)) {
    assert.ok(toolIds.has(id), `shortcut "${key}" maps to unknown tool "${id}"`)
    assert.equal(key, key.toUpperCase(), `shortcut "${key}" is not upper case`)
  }
  for (const tool of TOOLS) {
    assert.ok(tool.key, `${tool.id} has no keyboard shortcut`)
    assert.equal(
      KEY_TO_TOOL[tool.key.toUpperCase()],
      tool.id,
      `${tool.id}'s shortcut ${tool.key} does not map back to it`,
    )
  }
})

test('no two tools claim the same shortcut', () => {
  const seen = new Set()
  for (const tool of TOOLS) {
    const key = tool.key.toUpperCase()
    assert.ok(!seen.has(key), `duplicate shortcut "${key}"`)
    seen.add(key)
  }
})
