// ============================================================================
// LAYERS PANEL
// ============================================================================
//
// Show/hide and lock/unlock every layer of the board, and let the user restack
// them. The layer definitions themselves live in `lib/layers.js` — this file is
// presentation only, so the panel can never disagree with what the exporter and
// the renderer actually do.
//
// Locking and hiding are deliberately different things:
//   - Hiding is for the export. "Ship this board without my private notes."
//   - Locking protects your work. A locked layer cannot be grabbed, moved,
//     recoloured or deleted, and no new object can be placed into it.

import { useMemo, useState } from 'react'
import {
  Map, Users, Crosshair, UserRound, RefreshCw, Pentagon, PenLine,
  Type, StickyNote, Car, Frame, Layers as LayersIcon,
  Eye, EyeOff, Lock, LockOpen, ChevronUp, ChevronDown, Info, MousePointer2,
} from 'lucide-react'
import { SectionLabel, Tooltip } from './ui'
import {
  LAYERS, getLayer, layerFlags, layerOfType, moveLayer, isPinned, soloLayer, isSoloed,
} from '../lib/layers'

const ICONS = {
  Map, Users, Crosshair, UserRound, RefreshCw, Pentagon, PenLine,
  Type, StickyNote, Car, Frame,
}

const ALL_VISIBLE = 'Show all'
const ALL_HIDDEN = 'Hide all'

/** How many objects sit in a layer, so an empty layer is obvious at a glance. */
function useCounts(annos, circles) {
  return useMemo(() => {
    const counts = {}
    for (const id of Object.keys(LAYERS.reduce((m, l) => ((m[l.id] = 1), m), {}))) counts[id] = 0
    for (const a of annos || []) {
      const id = layerOfType(a.type)
      counts[id] = (counts[id] || 0) + 1
    }
    if (circles?.length) counts.zones = (counts.zones || 0) + circles.length
    return counts
  }, [annos, circles])
}

function LayerRow({
  layer,
  index,
  total,
  flags,
  count,
  selected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onMove,
}) {
  const Icon = ICONS[layer.icon] || LayersIcon
  const pinned = isPinned(layer.id)
  const dimmed = !flags.visible

  return (
    <li
      // A stable hook so the row can be addressed by layer id, in tests and by
      // anything else that needs to target one specific layer.
      data-layer={layer.id}
      data-selected={selected ? 'true' : 'false'}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors duration-150 ${
        selected
          ? 'border-cyan-500/50 bg-cyan-500/[0.08] ring-1 ring-cyan-500/25'
          : flags.locked
            ? 'border-amber-500/30 bg-amber-500/[0.06]'
            : dimmed
              ? 'border-slate-800/50 bg-slate-900/20 opacity-60'
              : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/70'
      }`}
    >
      {/* Stacking order. Pinned layers (Map, Frame) cannot move. */}
      <div className="flex shrink-0 flex-col">
        <Tooltip label={pinned ? `${layer.label} is pinned` : 'Move up'} side="left">
          <button
            type="button"
            onClick={() => onMove(layer.id, -1)}
            disabled={pinned || index <= 1}
            aria-label={`Move ${layer.label} up`}
            className="flex h-4 w-5 items-center justify-center rounded text-slate-600 transition-colors hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronUp size={11} />
          </button>
        </Tooltip>
        <Tooltip label={pinned ? `${layer.label} is pinned` : 'Move down'} side="left">
          <button
            type="button"
            onClick={() => onMove(layer.id, 1)}
            disabled={pinned || index >= total - 2}
            aria-label={`Move ${layer.label} down`}
            className="flex h-4 w-5 items-center justify-center rounded text-slate-600 transition-colors hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronDown size={11} />
          </button>
        </Tooltip>
      </div>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          dimmed ? 'bg-slate-800/60 text-slate-600' : 'bg-slate-800 text-cyan-300'
        }`}
      >
        <Icon size={13} />
      </span>

      {/* Selecting a layer is a real selection, not decoration: it is the scope
          for the actions underneath (solo this layer, see what it holds). It is
          a button rather than a click handler on the row so it is reachable by
          keyboard and announced with `aria-pressed`. */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select ${layer.label} layer`}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={`block truncate text-[10.5px] font-extrabold tracking-wide ${
            selected ? 'text-cyan-300' : dimmed ? 'text-slate-500' : 'text-slate-200'
          }`}
        >
          {layer.label}
        </span>
        {count > 0 && (
          <span className="block text-[8.5px] font-semibold text-slate-600">
            {count} object{count === 1 ? '' : 's'}
          </span>
        )}
      </button>

      <Tooltip label={flags.visible ? `Hide ${layer.label}` : `Show ${layer.label}`} side="left">
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={`${flags.visible ? 'Hide' : 'Show'} ${layer.label}`}
          aria-pressed={flags.visible}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
            flags.visible
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
              : 'border-slate-700/60 bg-slate-900/60 text-slate-600 hover:text-slate-300'
          }`}
        >
          {flags.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </Tooltip>

      <Tooltip
        label={flags.locked ? `Unlock ${layer.label}` : `Lock ${layer.label}`}
        side="left"
      >
        <button
          type="button"
          onClick={onToggleLock}
          aria-label={`${flags.locked ? 'Unlock' : 'Lock'} ${layer.label}`}
          aria-pressed={flags.locked}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
            flags.locked
              ? 'border-amber-400/50 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
              : 'border-slate-700/60 bg-slate-900/60 text-slate-600 hover:text-slate-300'
          }`}
        >
          {flags.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
      </Tooltip>
    </li>
  )
}

export default function LayersPanel({
  layerDocument,
  onChange,
  annos,
  circles,
  showCounts = true,
}) {
  const layers = layerDocument?.layers
  const order = layerDocument?.order
  const [showHelp, setShowHelp] = useState(false)
  // Which layer the user is working with. Deliberately local to the panel: it is
  // a transient view concern, like which tab is open, and must never reach the
  // board document, a share link or the autosave.
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const counts = useCounts(annos, circles)

  if (!layers || !order) return null

  // Rendered top-of-stack first, because that is how a layers panel is read in
  // every other design tool: the thing drawn on top is at the top of the list.
  const stack = [...order].reverse()

  const setFlag = (id, key) => {
    onChange({ ...layerDocument, layers: { ...layers, [id]: { ...layers[id], [key]: !layers[id][key] } } })
  }

  const setAll = (visible) => {
    const next = {}
    for (const [id, v] of Object.entries(layers)) next[id] = { ...v, visible }
    onChange({ ...layerDocument, layers: next })
  }

  const move = (id, delta) => onChange({ ...layerDocument, order: moveLayer(order, id, delta) })

  // "Show only this" is the quickest way to see what one layer contributes,
  // which is the workflow a layers panel exists for.
  const solo = (id) => onChange({ ...layerDocument, layers: soloLayer(layers, id) })

  const visibleCount = order.filter((id) => layerFlags(layers, id).visible).length
  const lockedCount = order.filter((id) => layerFlags(layers, id).locked).length
  const allOn = visibleCount === order.length
  const noneOn = visibleCount === 0
  const selectedLayer = selectedLayerId ? getLayer(selectedLayerId) : null

  return (
    <div className="space-y-4">
      {/* Summary + bulk actions */}
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
              <LayersIcon size={14} className="text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-cyan-300">Layer Stack</div>
              <div className="text-[9px] font-semibold text-slate-500">
                {visibleCount} of {order.length} visible
                {lockedCount > 0 ? ` · ${lockedCount} locked` : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={allOn}
            className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 py-1.5 text-[9.5px] font-extrabold text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-30"
          >
            {ALL_VISIBLE}
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={noneOn}
            className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 py-1.5 text-[9.5px] font-extrabold text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:pointer-events-none disabled:opacity-30"
          >
            {ALL_HIDDEN}
          </button>
        </div>
      </div>

      {/* The list, top of the z-order first */}
      <div className="space-y-2">
        <SectionLabel>Layers</SectionLabel>
        <ul className="space-y-1.5">
          {stack.map((id, i) => {
            const layer = getLayer(id)
            return (
              <LayerRow
                key={id}
                layer={layer}
                index={stack.length - 1 - i}
                total={stack.length}
                flags={layerFlags(layers, id)}
                count={showCounts ? counts[id] || 0 : 0}
                selected={selectedLayerId === id}
                onSelect={() =>
                  setSelectedLayerId((cur) => (cur === id ? null : id))
                }
                onToggleVisible={() => setFlag(id, 'visible')}
                onToggleLock={() => setFlag(id, 'locked')}
                onMove={move}
              />
            )
          })}
        </ul>
      </div>

      {/* Actions for the selected layer. Without this, selecting a layer would
          be inert; with it, selection is the scope for the two things a user
          actually wants to do to one layer in isolation. */}
      {selectedLayer && (
        <div
          data-layer-actions={selectedLayer.id}
          className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/15">
              <MousePointer2 size={12} className="text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-extrabold text-cyan-300">
                {selectedLayer.label}
              </div>
              <div className="text-[8.5px] font-semibold text-slate-500">
                {counts[selectedLayer.id] || 0} object
                {(counts[selectedLayer.id] || 0) === 1 ? '' : 's'}
                {selectedLayer.types ? '' : ' · board chrome'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLayerId(null)}
              aria-label="Clear layer selection"
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-500 transition-colors hover:text-slate-200"
            >
              Done
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => solo(selectedLayer.id)}
              disabled={isSoloed(layers, selectedLayer.id)}
              title={`Show only ${selectedLayer.label} in the editor and the export`}
              className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 py-1.5 text-[9.5px] font-extrabold text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-30"
            >
              Show only this
            </button>
            <button
              type="button"
              onClick={() => setAll(true)}
              disabled={allOn}
              className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 py-1.5 text-[9.5px] font-extrabold text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:pointer-events-none disabled:opacity-30"
            >
              {ALL_VISIBLE}
            </button>
          </div>
        </div>
      )}

      {/* Explicit about the one rule a user will otherwise get wrong. */}
      <button
        type="button"
        onClick={() => setShowHelp((s) => !s)}
        aria-expanded={showHelp}
        className="flex w-full items-center gap-1.5 text-left text-[9.5px] font-bold text-slate-500 transition-colors hover:text-cyan-300"
      >
        <Info size={11} className="shrink-0" />
        {showHelp ? 'Hide' : 'How visibility and locking work'}
      </button>
      {showHelp && (
        <div className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-[9.5px] font-semibold leading-relaxed text-slate-400">
          <p>
            <span className="font-extrabold text-cyan-300">Hidden</span> layers are left out of
            the exported PNG as well as the canvas. Use this to ship a clean board.
          </p>
          <p>
            <span className="font-extrabold text-amber-300">Locked</span> layers cannot be
            selected, moved, restyled or deleted, and you cannot place new objects into them.
            Locking never changes what is exported.
          </p>
          <p>
            <span className="font-extrabold text-slate-300">Order</span> is bottom to top. Map
            stays at the bottom and Frame / Export stays on top; everything between can be
            restacked. Flight paths always render beneath the playzone circles regardless of
            order.
          </p>
          <p>
            <span className="font-extrabold text-slate-300">Frame / Export</span> is chrome
            drawn outside the map rectangle, so hiding it never moves a single tactical
            coordinate.
          </p>
        </div>
      )}
    </div>
  )
}
