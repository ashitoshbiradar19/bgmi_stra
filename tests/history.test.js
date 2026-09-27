// Unit tests for the undo/redo stack in src/lib/history.js.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HISTORY_LIMIT,
  createHistory,
  currentDoc,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  push,
  commit,
  beginTransaction,
  endTransaction,
  cancelTransaction,
  replacePresent,
  undo,
  redo,
  resetHistory,
  sameDoc,
  shouldRecordFieldEdit,
  NO_FIELD_RUN,
} from '../src/lib/history.js'

const doc = (...annos) => ({ circles: [], annos })
const line = (id, x = 0) => ({ id, type: 'line', points: [[x, 0], [x + 10, 10]] })

test('a fresh history has no steps in either direction', () => {
  const h = createHistory(doc(line('a')))
  assert.equal(canUndo(h), false)
  assert.equal(canRedo(h), false)
  assert.equal(undoLabel(h), null)
  assert.equal(redoLabel(h), null)
  assert.equal(currentDoc(h).annos.length, 1)
})

test('createHistory snapshots its input, so later edits cannot leak in', () => {
  const start = doc(line('a'))
  const h = createHistory(start)
  start.annos.push(line('b'))
  assert.equal(currentDoc(h).annos.length, 1, 'the history owns its own copy')
})

test('snapshots are independent of the live document', () => {
  const h = createHistory(doc(line('a')))
  commit(h, doc(line('a'), line('b')), 'Add b')
  // Mutating the live object must not corrupt the stored "before" snapshot.
  currentDoc(h).annos[0].points[0][0] = 9999
  undo(h)
  assert.equal(currentDoc(h).annos[0].points[0][0], 0, 'undo still restores the true previous state')
})

test('commit records the previous document and installs the new one', () => {
  const h = createHistory(doc(line('a')))
  const before = currentDoc(h)
  commit(h, doc(line('a'), line('b')), 'Add Line')
  assert.equal(currentDoc(h).annos.length, 2, 'the new document is live')
  assert.equal(canUndo(h), true)
  assert.equal(undoLabel(h), 'Add Line')
  assert.notEqual(currentDoc(h), before, 'present is a new object')
})

test('undo and redo walk the document back and forth', () => {
  const h = createHistory(doc(line('a')))
  commit(h, doc(line('a'), line('b')), 'Add b')
  commit(h, doc(line('a'), line('b'), line('c')), 'Add c')

  assert.equal(undo(h), true)
  assert.equal(currentDoc(h).annos.length, 2)
  assert.equal(undoLabel(h), 'Add b')
  assert.equal(canRedo(h), true)

  assert.equal(undo(h), true)
  assert.equal(currentDoc(h).annos.length, 1)
  assert.equal(canUndo(h), false, 'the beginning is reached')

  assert.equal(redo(h), true)
  assert.equal(currentDoc(h).annos.length, 2)
  assert.equal(redo(h), true)
  assert.equal(currentDoc(h).annos.length, 3)
  assert.equal(canRedo(h), false)
})

test('undo past the start and redo past the end are no-ops that report false', () => {
  const h = createHistory(doc(line('a')))
  assert.equal(undo(h), false)
  assert.equal(redo(h), false)
  assert.equal(currentDoc(h).annos.length, 1, 'the document is untouched')
})

test('a new edit after undo clears the redo branch', () => {
  const h = createHistory(doc(line('a')))
  commit(h, doc(line('a'), line('b')), 'Add b')
  undo(h)
  assert.equal(canRedo(h), true)
  commit(h, doc(line('a'), line('z')), 'Add z')
  assert.equal(canRedo(h), false, 'the abandoned future is dropped')
  assert.equal(undoLabel(h), 'Add z')
})

test('a transaction captures the PRE-drag document — the whole point', () => {
  const h = createHistory(doc(line('a')))
  const start = currentDoc(h)

  // The user grabs the object and drags it from x=0 to x=500. Snapshots taken
  // on pointerup would capture the moved object and make undo a no-op.
  beginTransaction(h, 'Move Line')
  for (const x of [50, 200, 350, 500]) {
    replacePresent(h, doc(line('a', x)))
  }
  endTransaction(h)

  assert.equal(currentDoc(h).annos[0].points[0][0], 500, 'the drag took effect')
  assert.equal(h.past.length, 1, 'the whole drag is ONE undo step')
  assert.equal(undoLabel(h), 'Move Line')

  undo(h)
  assert.equal(currentDoc(h).annos[0].points[0][0], 0, 'undo returns to the pre-drag position')
  assert.equal(start.annos[0].points[0][0], 0)
})

test('a transaction that changes nothing records nothing', () => {
  const h = createHistory(doc(line('a')))
  beginTransaction(h, 'Move Line')
  // The pointer moved but the object did not. The document is a fresh clone of
  // an identical one, so this must be recognised as a no-op.
  replacePresent(h, doc(line('a')))
  endTransaction(h)
  assert.equal(canUndo(h), false, 'a stray click must not eat an undo step')
})

test('a transaction that really moved a point does record', () => {
  const h = createHistory(doc(line('a')))
  beginTransaction(h, 'Move Line')
  const d = currentDoc(h)
  d.annos[0].points[0][0] = 999
  replacePresent(h, d)
  endTransaction(h)
  assert.equal(canUndo(h), true, 'a real change IS recorded')
})

test('nested beginTransaction calls only capture once', () => {
  const h = createHistory(doc(line('a')))
  beginTransaction(h, 'Move')
  replacePresent(h, doc(line('a', 1)))
  beginTransaction(h, 'Move again')
  replacePresent(h, doc(line('a', 2)))
  endTransaction(h)
  assert.equal(h.past.length, 1, 'the inner call did not re-snapshot')
  assert.equal(undoLabel(h), 'Move', 'the outer label wins')
  undo(h)
  assert.equal(currentDoc(h).annos[0].points[0][0], 0)
})

test('cancelTransaction discards the open step', () => {
  const h = createHistory(doc(line('a')))
  beginTransaction(h, 'Move')
  replacePresent(h, doc(line('a', 99)))
  cancelTransaction(h)
  endTransaction(h)
  assert.equal(canUndo(h), false, 'nothing was committed')
})

test('undo and redo abandon an open transaction', () => {
  const h = createHistory(doc(line('a')))
  commit(h, doc(line('a'), line('b')), 'Add b')
  beginTransaction(h, 'Dragging')
  undo(h)
  assert.equal(h.openTransaction, null, 'a stale transaction cannot corrupt the next one')
  commit(h, doc(line('a'), line('c')), 'Add c')
  endTransaction(h)
  assert.equal(h.past.length, 1, 'the abandoned transaction added no step')
  assert.equal(undoLabel(h), 'Add c')
})

test('push records without changing the document', () => {
  const h = createHistory(doc(line('a')))
  const before = currentDoc(h)
  push(h, before, 'Checkpoint')
  assert.equal(currentDoc(h), before, 'push is a pure snapshot')
  assert.equal(h.past.length, 1)
})

test('history is capped so a long session cannot grow without bound', () => {
  const h = createHistory(doc())
  for (let i = 0; i < HISTORY_LIMIT + 40; i++) {
    commit(h, doc(line(`a${i}`)), `Add ${i}`)
  }
  assert.equal(h.past.length, HISTORY_LIMIT, 'oldest steps fall off the back')
  // The oldest surviving snapshot is the oldest one still inside the window.
  const survivor = h.past[0]
  assert.ok(survivor.doc.annos.length > 0)
})

test('resetHistory clears both branches for a new map', () => {
  const h = createHistory(doc(line('a')))
  commit(h, doc(line('a'), line('b')), 'Add b')
  undo(h)
  assert.equal(canRedo(h), true)

  resetHistory(h, doc(line('other')))
  assert.equal(canUndo(h), false)
  assert.equal(canRedo(h), false)
  assert.equal(currentDoc(h).annos[0].id, 'other')
})

test('version increments so React can re-render the buttons', () => {
  const h = createHistory(doc())
  const v0 = h.version
  commit(h, doc(line('a')), 'Add')
  assert.ok(h.version > v0)
  undo(h)
  assert.ok(h.version > v0 + 1)
})

test('circles are part of the snapshot, not just annotations', () => {
  const h = createHistory({ circles: [{ id: 'c1', stage: 3, x: 10, y: 10, r: 100 }], annos: [] })
  commit(h, { circles: [{ id: 'c1', stage: 4, x: 20, y: 20, r: 200 }], annos: [] }, 'Move Zone')
  assert.equal(currentDoc(h).circles[0].r, 200)
  undo(h)
  assert.equal(currentDoc(h).circles[0].r, 100, 'zone edits undo too')
})

test('sameDoc compares content, not identity', () => {
  const a = line('a')
  // Two independently-built but identical annos must compare EQUAL: that is
  // exactly the shape of a drag that moved the pointer but not the object.
  assert.ok(sameDoc({ circles: [], annos: [a] }, { circles: [], annos: [line('a')] }))
  assert.ok(!sameDoc({ circles: [], annos: [a] }, { circles: [], annos: [line('b')] }))
  assert.ok(!sameDoc({ circles: [], annos: [a] }, { circles: [], annos: [] }))
  assert.ok(sameDoc({}, {}), 'two empties match')
  assert.ok(sameDoc(null, null))
  assert.ok(!sameDoc(null, { annos: [] }))
})

test('sameDoc notices a moved point', () => {
  const before = doc(line('a', 0))
  const after = doc(line('a', 500))
  assert.ok(!sameDoc(before, after))
})

// --- Field-edit coalescing -------------------------------------------------
// A slider, stepper or text input fires a change event per pixel, step or
// keystroke. These tests pin the rule that keeps a whole drag as ONE undo entry.

test('shouldRecordFieldEdit', async (t) => {
  const runDrag = (id, keys, { events, gapMs, startAt = 1000 }) => {
    let run = NO_FIELD_RUN
    let entries = 0
    for (let i = 0; i < events; i++) {
      const next = shouldRecordFieldEdit(run, id, keys, startAt + i * gapMs)
      if (next.record) entries++
      run = next.run
    }
    return { entries, run }
  }

  await t.test('collapses a whole slider drag into one undo entry', () => {
    // The regression this prevents: 100 change events on a 50-entry stack
    // evicted every action taken before the drag.
    const { entries } = runDrag('a1', 'opacity', { events: 100, gapMs: 16 })
    assert.equal(entries, 1, 'a 1.6 s drag is one undo step, not 100')
  })

  await t.test('does not let a slow drag split into two entries', () => {
    // The window must extend while events keep arriving, otherwise pausing
    // mid-drag would silently create a second undo step.
    const { entries } = runDrag('a1', 'width', { events: 20, gapMs: 500 })
    assert.equal(entries, 1)
  })

  await t.test('treats a second, deliberate click as its own entry', () => {
    // Two clicks on the same stepper a second apart are two user actions.
    let run = NO_FIELD_RUN
    assert.equal(shouldRecordFieldEdit(run, 'a1', 'r', 1000).record, true)
    run = shouldRecordFieldEdit(run, 'a1', 'r', 1100).run
    assert.equal(shouldRecordFieldEdit(run, 'a1', 'r', 2500).record, true, 'after the window')
  })

  await t.test('separates edits to different fields', () => {
    let run = NO_FIELD_RUN
    assert.equal(shouldRecordFieldEdit(run, 'a1', 'opacity', 1000).record, true)
    run = shouldRecordFieldEdit(run, 'a1', 'opacity', 1010).run
    assert.equal(shouldRecordFieldEdit(run, 'a1', 'width', 1020).record, true, 'different field')
  })

  await t.test('separates edits to different objects', () => {
    let run = NO_FIELD_RUN
    run = shouldRecordFieldEdit(run, 'a1', 'opacity', 1000).run
    assert.equal(shouldRecordFieldEdit(run, 'a2', 'opacity', 1010).record, true, 'different object')
  })

  await t.test('starts a fresh run after NO_FIELD_RUN is restored', () => {
    // `pushHistory` clears the run, so the next slider drag records its own
    // entry even if it lands inside the old window.
    assert.equal(shouldRecordFieldEdit(NO_FIELD_RUN, 'a1', 'r', 1050).record, true)
  })

  await t.test('treats a multi-key patch as one field run', () => {
    const keys = Object.keys({ r: 10, rot: 1 }).join()
    const { entries } = runDrag('a1', keys, { events: 40, gapMs: 16 })
    assert.equal(entries, 1)
  })

  await t.test('never grows the run window past the limit', () => {
    // A long-paused drag (e.g. the user holds the slider, then resumes) must
    // still start a new entry rather than merging unrelated work.
    let run = shouldRecordFieldEdit(NO_FIELD_RUN, 'a1', 'opacity', 0).run
    run = shouldRecordFieldEdit(run, 'a1', 'opacity', 10).run
    assert.equal(shouldRecordFieldEdit(run, 'a1', 'opacity', 10 + 601).record, true)
  })
})