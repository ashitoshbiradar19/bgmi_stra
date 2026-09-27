// ============================================================================
// LAYER REGISTRY
// ============================================================================
//
// The single source of truth for what the board is made of, in what order it
// stacks, and whether any of it may be seen or touched.
//
// Every annotation type belongs to exactly one layer, and `tests/layers.test.js`
// enforces that, so a new drawing tool cannot be added without deciding where it
// belongs. That is the whole point: if the mapping is data rather than a pile of
// `if` statements, hiding "Team Markers" can never accidentally take "Vehicles"
// with it.
//
// This module is pure. It knows nothing about React, the canvas, or localStorage.

import { ANNO_TYPES } from './annoTypes'

/**
 * The layer stack, bottom of the z-order first.
 *
 * Two layers are pinned and cannot be reordered:
 *   - `map` is the backdrop. Nothing may ever draw beneath it.
 *   - `frame` is the export chrome. It is not an annotation layer at all: it is
 *     painted outside the map rectangle by `drawFrame()`, so it cannot land on
 *     top of, or shift, a single tactical coordinate.
 *
 * `types` lists the annotation types the layer owns. `null` means the layer holds
 * no annotations.
 */
export const LAYERS = [
  {
    id: 'map',
    label: 'Map',
    short: 'MAP',
    icon: 'Map',
    blurb: 'Map imagery, grid and tournament overlays',
    types: null,
    pinned: 'bottom',
  },
  {
    id: 'teamMarkers',
    label: 'Team Markers',
    short: 'TEAM MARKERS',
    icon: 'Users',
    blurb: 'Dropped team logos and their names',
    types: ['team'],
  },
  {
    id: 'enemyMarkers',
    label: 'Enemy Markers',
    short: 'ENEMY MARKERS',
    icon: 'Crosshair',
    blurb: 'Pins marking enemy positions',
    types: ['pin'],
  },
  {
    id: 'players',
    label: 'Players',
    short: 'PLAYERS',
    icon: 'UserRound',
    blurb: 'Individual player positions',
    types: ['player'],
  },
  {
    id: 'rotations',
    label: 'Rotations',
    short: 'ROTATIONS',
    icon: 'RefreshCw',
    blurb: 'Rotation paths and their facing',
    types: ['rotation'],
  },
  {
    id: 'zones',
    label: 'Zones',
    short: 'ZONES',
    icon: 'Pentagon',
    blurb: 'Playzone circles, danger areas and vision cones',
    types: ['danger', 'fov'],
  },
  {
    id: 'drawings',
    label: 'Drawings',
    short: 'DRAWINGS',
    icon: 'PenLine',
    blurb: 'Freehand, lines, arrows and shapes',
    types: ['brush', 'line', 'arrow', 'arrow2', 'ridge', 'smoke', 'rect', 'circle', 'compound'],
  },
  {
    id: 'text',
    label: 'Text',
    short: 'TEXT',
    icon: 'Type',
    blurb: 'Text labels on the map',
    types: ['text'],
  },
  {
    id: 'notes',
    label: 'Notes',
    short: 'NOTES',
    icon: 'StickyNote',
    blurb: 'Measurements and flight-path notes',
    // `flight` is a legacy id: boards saved before the split into flight1/flight2
    // can still carry it, and it renders as a flight path, so it belongs here.
    types: ['measure', 'flight', 'flight1', 'flight2'],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    short: 'VEHICLES',
    icon: 'Car',
    blurb: 'Vehicle positions',
    types: ['vehicle'],
  },
  {
    id: 'frame',
    label: 'Frame / Export',
    short: 'FRAME / EXPORT',
    icon: 'Frame',
    blurb: 'Export frame, captions and brand logo',
    types: null,
    pinned: 'top',
  },
]

export const LAYER_IDS = LAYERS.map((l) => l.id)

/** Layers that own annotation types, i.e. everything except map and frame. */
export const ANNO_LAYER_IDS = LAYERS.filter((l) => l.types).map((l) => l.id)

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l]))

/** Every drawable annotation type in the app, including unregistered legacies. */
export const ALL_ANNO_TYPES = [
  ...Object.keys(ANNO_TYPES).filter((t) => t !== 'select'),
  'flight', // legacy, see above
]

/** type -> layer id. Built once, reverse of the `types` lists. */
export const TYPE_TO_LAYER = (() => {
  const map = {}
  for (const layer of LAYERS) {
    for (const type of layer.types || []) {
      if (map[type]) {
        // A duplicate would make hiding one layer silently hide another, which is
        // exactly the class of bug this registry exists to prevent.
        throw new Error(
          `annotation type "${type}" is claimed by both "${map[type]}" and "${layer.id}"`,
        )
      }
      map[type] = layer.id
    }
  }
  return map
})()

/** Which layer owns this annotation. Unknown types fall back to Drawings. */
export function layerOfType(type) {
  return TYPE_TO_LAYER[type] || 'drawings'
}

export function layerOfAnno(anno) {
  return anno ? layerOfType(anno.type) : 'drawings'
}

export function getLayer(id) {
  return LAYER_BY_ID[id] || LAYER_BY_ID.drawings
}

/** Is this layer one of the two that cannot be reordered? */
export function isPinned(id) {
  return Boolean(LAYER_BY_ID[id]?.pinned)
}

/** The default state: everything visible and unlocked, in registry order. */
export function defaultLayerState() {
  return Object.fromEntries(
    LAYERS.map((l) => [l.id, { visible: true, locked: false }]),
  )
}

/**
 * Merge a stored/partial layer state over the defaults.
 *
 * Merging rather than replacing is deliberate: a board saved before layers
 * existed has no `layers` key at all, and a payload that is missing a layer must
 * not silently blank it. Unknown keys are dropped so a stale payload cannot
 * resurrect a layer that no longer exists.
 */
export function normalizeLayerState(partial) {
  const out = defaultLayerState()
  if (!partial || typeof partial !== 'object') return out
  for (const id of LAYER_IDS) {
    const v = partial[id]
    if (!v || typeof v !== 'object') continue
    if (typeof v.visible === 'boolean') out[id].visible = v.visible
    if (typeof v.locked === 'boolean') out[id].locked = v.locked
  }
  return out
}

/**
 * Normalise the z-order.
 *
 * `order` is a list of layer ids, bottom first. Missing or duplicated ids fall
 * back to registry order so the panel can never end up in a state that hides an
 * object, and the two pinned layers are forced back to the ends.
 */
export function normalizeLayerOrder(order) {
  const seen = new Set()
  const out = []
  if (Array.isArray(order)) {
    for (const id of order) {
      if (LAYER_BY_ID[id] && !seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  for (const id of LAYER_IDS) if (!seen.has(id)) out.push(id)

  // MAP is always the backdrop and FRAME is always the topmost chrome.
  const pinnedBottom = 'map'
  const pinnedTop = 'frame'
  const rest = out.filter((id) => id !== pinnedBottom && id !== pinnedTop)
  return [pinnedBottom, ...rest, pinnedTop]
}

/** Full editor state: visibility + lock per layer, plus the z-order. */
export function defaultLayerDocument() {
  return { layers: defaultLayerState(), order: normalizeLayerOrder() }
}

export function normalizeLayerDocument(partial) {
  return {
    layers: normalizeLayerState(partial?.layers),
    order: normalizeLayerOrder(partial?.order),
  }
}

/** Read a layer's flags, defaulting to visible and unlocked. */
export function layerFlags(state, id) {
  const s = state?.[id]
  return {
    visible: s?.visible !== false,
    locked: s?.locked === true,
  }
}

export function isLayerVisible(state, id) {
  return layerFlags(state, id).visible
}

export function isLayerLocked(state, id) {
  return layerFlags(state, id).locked
}

export function isAnnoVisible(layerState, anno) {
  return isLayerVisible(layerState, layerOfAnno(anno))
}

export function isAnnoLocked(layerState, anno) {
  return isLayerLocked(layerState, layerOfAnno(anno))
}

/**
 * Split a board's annotations into the three lists the rest of the app needs.
 *
 * - `visible`   what should be drawn. Layer order then decides the stacking.
 * - `selectable` what the pointer may grab, drag, edit or delete. A locked layer
 *                is off limits, which is the entire point of locking: hiding is
 *                for the export, locking is for protecting your work.
 * - `hidden`    kept for completeness; nothing downstream should need this.
 */
export function partitionAnnos(annos, layerState) {
  const visible = []
  const selectable = []
  const hidden = []
  for (const a of annos || []) {
    const layer = layerOfAnno(a)
    const { visible: vis, locked } = layerFlags(layerState, layer)
    if (!vis) {
      hidden.push(a)
      continue
    }
    visible.push(a)
    if (!locked) selectable.push(a)
  }
  return { visible, selectable, hidden }
}

/**
 * Reorder annotations to match the layer stack.
 *
 * `renderScene()` draws flight paths beneath the playzones and everything else
 * above them, so the array order alone cannot express "below the map". Sorting by
 * layer order still gives a real, predictable z-order within each of those two
 * groups, which is what a user reordering the panel expects to see.
 *
 * Sort is stable, so annotations inside one layer keep their creation order.
 */
export function orderAnnos(annos, order) {
  if (!Array.isArray(order) || !order.length) return annos || []
  const rank = new Map(order.map((id, i) => [id, i]))
  return (annos || [])
    .map((a, i) => [a, i])
    .sort((p, q) => {
      const rp = rank.get(layerOfAnno(p[0])) ?? 0
      const rq = rank.get(layerOfAnno(q[0])) ?? 0
      return rp !== rq ? rp - rq : p[1] - q[1]
    })
    .map((p) => p[0])
}

/**
 * What the export should draw.
 *
 * The one deliberate departure from the old rule: a layer the user has hidden is
 * left out of the PNG. That is the whole point of a layers panel. The `hidden`
 * per-annotation flag is still honoured, and the map/frame layers are passed
 * through as flags for the composer to read.
 */
export function exportSelection(annos, circles, layerDocument) {
  const layers = normalizeLayerState(layerDocument?.layers)
  const order = normalizeLayerOrder(layerDocument?.order)
  const { visible } = partitionAnnos(annos, layers)
  return {
    annos: orderAnnos(visible, order).filter((a) => !a.hidden),
    circles: isLayerVisible(layers, 'zones') ? circles || [] : [],
    mapVisible: isLayerVisible(layers, 'map'),
    frameVisible: isLayerVisible(layers, 'frame'),
  }
}

/** Move a layer one step through the stack. Pinned layers never move. */
export function moveLayer(order, id, delta) {
  const next = normalizeLayerOrder(order)
  const i = next.indexOf(id)
  if (i < 0 || isPinned(id)) return next
  const j = i + delta
  if (j < 0 || j >= next.length) return next
  if (isPinned(next[j])) return next
  const out = next.slice()
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/**
 * Show one layer and nothing else ("solo").
 *
 * The fastest way to check what a single layer contributes before exporting,
 * which is the whole workflow a layers panel exists for. Locking is untouched:
 * soloing is a visibility change, and it must not quietly unlock anything.
 *
 * Returns a new state object; the input is not mutated.
 */
export function soloLayer(layers, id) {
  const out = {}
  for (const lid of LAYER_IDS) {
    const v = layers?.[lid] || {}
    out[lid] = { visible: lid === id, locked: v.locked === true }
  }
  return out
}

/** Is this layer the only visible one? Used to disable the solo control. */
export function isSoloed(layers, id) {
  if (!layerFlags(layers, id).visible) return false
  return LAYER_IDS.every((lid) => lid === id || !layerFlags(layers, lid).visible)
}

// --- share-link packing --------------------------------------------------
//
// A share link is one LZW-compressed JSON blob, so the layer document travels
// inside it rather than as a second payload. It still gets packed down: a
// two-flag layer becomes a single small integer, which is a large saving once
// the blob is compressed and keeps old links readable (a missing `L` is fine).

const VISIBLE = 1
const LOCKED = 2

export function packLayerDocument(layerDocument) {
  const doc = normalizeLayerDocument(layerDocument)
  const l = {}
  for (const [id, v] of Object.entries(doc.layers)) {
    l[id] = (v.visible ? VISIBLE : 0) | (v.locked ? LOCKED : 0)
  }
  return { o: doc.order, l }
}

export function unpackLayerDocument(packed) {
  if (!packed || typeof packed !== 'object') return defaultLayerDocument()
  const base = defaultLayerDocument()
  const layers = { ...base.layers }
  for (const [id, bits] of Object.entries(packed.l || {})) {
    if (!layers[id] || typeof bits !== 'number') continue
    layers[id] = { visible: Boolean(bits & VISIBLE), locked: Boolean(bits & LOCKED) }
  }
  return normalizeLayerDocument({ order: packed.o, layers })
}
