// ============================================================================
// UNDO / REDO HISTORY
// ============================================================================
//
// A real history stack: it holds immutable snapshots of the board document
// (`circles` + `annos`) plus a human-readable label for each entry, and it can
// step backwards and forwards without touching the page.
//
// Two details matter and are the reason this is not just a `useState` array:
//
// 1. **Snapshots are taken at the right moment.** The naive version pushes the
//    current state at the end of an interaction, which for a drag captures the
//    already-moved object and makes undo a no-op. `beginTransaction()` captures
//    the pre-drag document; `endTransaction()` is what commits it.
//
// 2. **The stack lives in a ref, not in state.** Reading it synchronously
//    inside a pointer handler must see the latest entries, and `useState`
//    updates are asynchronous. A monotonically increasing `version` counter is
//    bumped afterwards purely to make React re-render the Undo/Redo buttons.
//
// Snapshots are cheap enough to copy whole: annotations are small plain objects
// and the document is capped at HISTORY_LIMIT entries.
// ============================================================================

/** How many steps the user can walk back. */
export const HISTORY_LIMIT = 120

const clone = (v) => {
  if (typeof structuredClone === 'function') return structuredClone(v)
  return JSON.parse(JSON.stringify(v))
}

/**
 * Create a history store.
 *
 * @param {{circles: Array, annos: Array}} doc the document to start from
 */
export function createHistory(doc = { circles: [], annos: [] }) {
  return {
    past: [],
    present: clone(doc),
    future: [],
    /** Snapshot captured by beginTransaction(), or null. */
    openTransaction: null,
    version: 0,
  }
}

/**
 * Read the current document.
 *
 * Treat the result as READ-ONLY. It is the live object, not a copy, so the
 * render loop can use it without paying for a clone on every frame. Mutate the
 * document only through `commit()` / `replacePresent()`, which clone — that is
 * what keeps the stored snapshots independent of the live object.
 */
export function currentDoc(h) {
  return h.present
}

/** Can we step back / forward? */
export const canUndo = (h) => h.past.length > 0
export const canRedo = (h) => h.future.length > 0

/** Label of the step that undo would reverse, e.g. "Add Arrow". */
export const undoLabel = (h) => (h.past.length ? h.past[h.past.length - 1].label : null)
/** Label of the step redo would re-apply. */
export const redoLabel = (h) => (h.future.length ? h.future[h.future.length - 1].label : null)

/**
 * Record a step without changing the document.
 *
 * Use this when the caller is about to apply its own mutation — the state being
 * pushed is the "before" picture, so undo returns here.
 */
export function push(h, doc, label = 'Edit') {
  h.past.push({ doc: clone(doc), label })
  if (h.past.length > HISTORY_LIMIT) h.past.shift()
  h.future = []
  h.version++
  return h
}

/** Convenience: push the current document, then return a *new* document. */
export function commit(h, nextDoc, label = 'Edit') {
  push(h, h.present, label)
  h.present = clone(nextDoc)
  return h
}

/**
 * Open a transaction at the start of a continuous interaction (a drag, a
 * resize, a rotate). The pre-interaction document is remembered; any number of
 * `commitInProgress` steps can happen in between.
 */
export function beginTransaction(h, label = 'Edit') {
  if (!h.openTransaction) {
    h.openTransaction = { doc: clone(h.present), label }
  }
  return h
}

/**
 * Close a transaction opened with `beginTransaction()`. If nothing actually
 * changed, nothing is recorded — so a stray click does not eat an undo step.
 */
export function endTransaction(h) {
  const open = h.openTransaction
  h.openTransaction = null
  if (!open) return h
  if (sameDoc(open.doc, h.present)) {
    h.version++
    return h
  }
  h.past.push(open)
  if (h.past.length > HISTORY_LIMIT) h.past.shift()
  h.future = []
  h.version++
  return h
}

/** Abandon a transaction without recording it. */
export function cancelTransaction(h) {
  h.openTransaction = null
  return h
}

/** Update the live document in place. Records nothing — caller owns history. */
export function replacePresent(h, doc) {
  h.present = clone(doc)
  h.version++
  return h
}

/** Step back one entry. Returns false when there is nothing to undo. */
export function undo(h) {
  if (!h.past.length) return false
  const entry = h.past.pop()
  h.future.push({ doc: clone(h.present), label: entry.label })
  if (h.future.length > HISTORY_LIMIT) h.future.shift()
  h.present = entry.doc
  h.openTransaction = null
  h.version++
  return true
}

/** Step forward one entry. Returns false when there is nothing to redo. */
export function redo(h) {
  if (!h.future.length) return false
  const entry = h.future.pop()
  h.past.push({ doc: clone(h.present), label: entry.label })
  if (h.past.length > HISTORY_LIMIT) h.past.shift()
  h.present = entry.doc
  h.openTransaction = null
  h.version++
  return true
}

/** Drop every entry but the current document. Used when a map is switched. */
export function resetHistory(h, doc) {
  h.past = []
  h.future = []
  h.openTransaction = null
  h.present = clone(doc)
  h.version++
  return h
}

/**
 * Structural equality over the two collections.
 *
 * This has to compare CONTENT, not identity. Every setter clones its document,
 * so a drag that moves the pointer but not the object still produces a fresh
 * (but structurally identical) document. Comparing by reference would record a
 * useless undo step for every such interaction.
 *
 * The cost is one serialise per closed transaction, which is once per finished
 * interaction — cheap next to the redraw it follows.
 */
export function sameDoc(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return serialise(a) === serialise(b)
}

const serialise = (d) => JSON.stringify([d.circles || [], d.annos || []])

/**
 * Default window for treating a run of field edits as one gesture.
 *
 * Long enough to cover a continuous slider drag, short enough that two
 * deliberate clicks seconds apart stay two separate undo steps.
 */
export const FIELD_EDIT_WINDOW_MS = 600

/**
 * Decide whether a field edit needs its own undo entry, and return the updated
 * run marker.
 *
 * A slider, stepper or text input fires a change event per pixel, per step, or
 * per keystroke. Recording each one doesn't merely make undo tedious — with a
 * bounded stack, a single drag evicts every action taken before it, so undo
 * appears to have forgotten the earlier work.
 *
 * The snapshot is taken *before* the mutation, so the first event of a run
 * already captures the pre-drag state. Later events only need to mutate the
 * document; the entry they would push is already on the stack.
 *
 * Pure and clock-injected so the rule can be tested without timers.
 *
 * @returns {{record: boolean, run: {id: *, keys: *, at: number}}}
 */
export function shouldRecordFieldEdit(run, id, keys, now, windowMs = FIELD_EDIT_WINDOW_MS) {
  if (run && run.id === id && run.keys === keys && now - run.at < windowMs) {
    // Extend the window while events keep arriving, so a slow drag stays one
    // entry instead of splitting into a second one partway through.
    return { record: false, run: { id, keys, at: now } }
  }
  return { record: true, run: { id, keys, at: now } }
}

/** Marker meaning "no edit run in progress". */
export const NO_FIELD_RUN = { id: null, keys: null, at: 0 }
