// Wiring tests: a tool in the toolbar must actually be creatable.
//
// The failure this exists to prevent is silent and very easy to ship — a row is
// added to `data/tools.js`, it gets a button and a shortcut, the key does
// nothing because `onPointerDown` has no branch for it. Nothing throws; the
// button just does nothing. These tests read the component source and assert
// every tool is reachable.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { TOOLS, PRIMARY_TOOLS, MORE_TOOLS, TOOL_BY_ID, KEY_TO_TOOL, toolLabel } from '../src/data/tools.js'
import { createMode, CREATE_MODES, ANNO_TYPES, propsFor } from '../src/lib/annoTypes.js'

const canvasSrc = readFileSync(new URL('../src/components/MapCanvas.jsx', import.meta.url), 'utf8')

const NON_ANNOTATION = new Set(['select', 'eraser'])

test('every tool that makes an annotation is reachable from onPointerDown', () => {
  // Either the tool has a hand-written branch, or it is handled by the generic
  // registry block. The generic block is gated on `HANDLED_TOOLS`, so a tool
  // listed there MUST also have a real branch, or it is a dead button.
  const handled = canvasSrc.match(/const HANDLED_TOOLS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(handled, 'HANDLED_TOOLS is declared in MapCanvas')
  const declared = new Set(handled[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1)))

  for (const tool of TOOLS) {
    const id = tool.id
    if (NON_ANNOTATION.has(id)) continue
    const hasBranch = canvasSrc.includes(`tool === '${id}'`)
    assert.ok(
      declared.has(id) ? hasBranch : createMode(id) !== CREATE_MODES.SELECT,
      `${id} has neither a branch nor a create mode — the button would do nothing`,
    )
    if (declared.has(id)) {
      assert.ok(hasBranch, `${id} is listed in HANDLED_TOOLS but has no branch to handle it`)
    }
  }
})

test('every tool listed in HANDLED_TOOLS has a real branch behind it', () => {
  // Listing a tool as "already handled" without a branch is how a button ends up
  // doing nothing. Note `flight` is a legacy id: boards saved before the split
  // into flight1/flight2 can still carry it, so it is handled but has no
  // toolbar button, and that is correct.
  const handled = canvasSrc.match(/const HANDLED_TOOLS = new Set\(\[([\s\S]*?)\]\)/)
  const declared = handled[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1))
  for (const id of declared) {
    assert.ok(
      canvasSrc.includes(`tool === '${id}'`),
      `HANDLED_TOOLS lists "${id}" but onPointerDown has no branch for it`,
    )
  }
})

test('every tool has a create mode the registry recognises', () => {
  for (const tool of TOOLS) {
    if (NON_ANNOTATION.has(tool.id)) continue
    assert.ok(createMode(tool.id), `${tool.id} has no create mode`)
    assert.ok(ANNO_TYPES[tool.id], `${tool.id} is not in ANNO_TYPES`)
  }
})

test('select is an interaction mode, and eraser is not a drawable type', () => {
  assert.equal(createMode('select'), CREATE_MODES.SELECT)
  // Both are intercepted before the generic creation block, so `eraser` having
  // no entry in the type registry is correct — it deletes, it does not draw.
  assert.equal(ANNO_TYPES.eraser, undefined, 'eraser must not be a creatable annotation type')
  assert.deepEqual(ANNO_TYPES.select, { mode: CREATE_MODES.SELECT })
})

test('every creatable tool has a renderer branch or a shared polyline type', () => {
  // A tool with neither would be created but never drawn: invisible, but still
  // in the document, the autosave and any export.
  const renderSrc = readFileSync(new URL('../src/lib/render.js', import.meta.url), 'utf8')
  for (const tool of TOOLS) {
    if (NON_ANNOTATION.has(tool.id)) continue
    const quoted = renderSrc.includes("'" + tool.id + "'")
    // Either an explicit `a.type === 'x'` branch or membership in a shared
    // type set counts as a drawing path.
    assert.ok(quoted, `${tool.id} is creatable but render.js never mentions it`)
  }
})

test('every creatable tool is hit-testable, so the select tool can grab it', () => {
  // An object you can create but cannot select is effectively write-only.
  const typesSrc = readFileSync(new URL('../src/lib/annoTypes.js', import.meta.url), 'utf8')
  for (const tool of TOOLS) {
    if (NON_ANNOTATION.has(tool.id)) continue
    const inSet = ['POLYLINE_TYPES', 'BOX_TYPES', 'CIRCLE_TYPES', 'POINT_TYPES'].some((name) => {
      const m = typesSrc.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`))
      return m && m[1].includes(`'${tool.id}'`)
    })
    assert.ok(inSet, `${tool.id} is in no hit-test set, so it cannot be selected`)
  }
})

test('the tool groups partition the tool list exactly once each', () => {
  assert.equal(PRIMARY_TOOLS.length + MORE_TOOLS.length, TOOLS.length)
  const ids = [...PRIMARY_TOOLS, ...MORE_TOOLS].map((t) => t.id)
  assert.equal(new Set(ids).size, TOOLS.length, 'a tool appears in two groups')
})

test('every tool has a label for its readout', () => {
  for (const tool of TOOLS) {
    assert.ok(tool.label, `${tool.id} has no label`)
    assert.ok(tool.desc, `${tool.id} has no description for the help modal`)
    assert.ok(tool.icon, `${tool.id} has no icon`)
  }
  assert.equal(toolLabel('select'), 'Select')
  // An unknown id must still yield something printable rather than undefined,
  // since this string is rendered straight into the active-tool readout.
  assert.equal(typeof toolLabel('mystery'), 'string')
  assert.ok(toolLabel('mystery').length > 0)
})

test('the help modal shortcut list is driven by the registry', () => {
  // If the modal hardcoded its own table it would drift; assert the shape the
  // table needs is present for every tool.
  for (const tool of TOOLS) {
    assert.match(tool.key, /^[A-Z0-9]$/, `${tool.id} shortcut must be a single key`)
    assert.equal(KEY_TO_TOOL[tool.key], tool.id)
  }
})

test('properties exist for every creatable tool', () => {
  for (const tool of TOOLS) {
    if (NON_ANNOTATION.has(tool.id)) continue
    assert.ok(propsFor(tool.id).length > 0, `${tool.id} has no editable properties`)
  }
})
