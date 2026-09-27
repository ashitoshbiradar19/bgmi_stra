// Reusable property controls for the selection inspector.
//
// Every control here is driven by the `kind` on a property descriptor in
// `lib/annoTypes.js`, so adding a property to a type is a one-line change in
// that registry and it appears in BOTH the canvas inspector and the sidebar
// inspector automatically. That is the point: the two used to be hand-copied
// and drifted apart, which is why some objects were editable in one panel and
// not the other.
//
// Styling follows the existing design language — dense, tactical, monospace
// readouts, 44px touch targets on the interactive rows.

import { useState } from 'react'
import { Minus, Plus, RotateCw } from 'lucide-react'
import { SectionLabel } from './ui'
import { COLOR_PRESETS, FONT_PRESETS, STROKE_WIDTH_PRESETS, OPACITY_PRESETS } from '../data/colors'
import { FONT_WEIGHTS, withDefaults } from '../lib/annoTypes'
import { radToDeg, degToRad, radiusOf, clamp } from '../lib/geometry'
import { groupProps, CONTROL_KINDS } from '../lib/inspectorSchema'

// A 44px-tall row is the project's minimum touch target (AGENTS rule 6).
const ROW = 'min-h-[44px]'

function Row({ label, value, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </label>
        {value != null && <span className="font-mono text-[10px] font-bold text-cyan-400">{value}</span>}
      </div>
      {children}
    </div>
  )
}

/** The preset-chip row used by most controls. */
function Presets({ items, current, onPick, columns = 'grid-cols-4' }) {
  return (
    <div className={`grid ${columns} gap-1`}>
      {items.map((p) => {
        const active = current === p.value
        return (
          <button
            key={String(p.value)}
            type="button"
            onClick={() => onPick(p.value)}
            aria-pressed={active}
            className={`${ROW} rounded-lg border px-1 py-1.5 text-[10px] font-bold transition-colors duration-150 ${
              active
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

/** A number with a slider plus −/+ steppers, for values with a natural unit. */
function NumberRow({ label, value, min, max, step, unit, onChange, presets, hint }) {
  const clampToRange = (v) => clamp(v, min, max)
  return (
    <Row label={label} value={`${Number(value).toFixed(step < 1 ? 2 : 0)}${unit || ''}`} htmlFor={`prop-${label}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clampToRange(value - step))}
          aria-label={`Decrease ${label}`}
          className={`${ROW} flex w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-white`}
        >
          <Minus size={13} />
        </button>
        <input
          id={`prop-${label}`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clampToRange(parseFloat(e.target.value)))}
          className="h-8 min-w-0 flex-1 cursor-pointer accent-cyan-400"
        />
        <button
          type="button"
          onClick={() => onChange(clampToRange(value + step))}
          aria-label={`Increase ${label}`}
          className={`${ROW} flex w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-white`}
        >
          <Plus size={13} />
        </button>
      </div>
      {presets && <Presets items={presets} current={Math.round(value)} onPick={onChange} />}
      {hint && <p className="text-[9px] leading-tight text-slate-600">{hint}</p>}
    </Row>
  )
}

function ColorRow({ value, onChange }) {
  return (
    <Row label="Colour">
      <div className="grid grid-cols-6 gap-1">
        {COLOR_PRESETS.map((c) => {
          const active = c.hex.toLowerCase() === String(value).toLowerCase()
          return (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={active}
              onClick={() => onChange(c.hex)}
              style={{ background: c.hex }}
              className={`h-7 w-full rounded-md border-2 transition-transform duration-150 hover:scale-110 ${
                active ? 'border-cyan-400' : 'border-transparent'
              }`}
            />
          )
        })}
      </div>
      <label className="flex items-center gap-2 pt-1">
        <span className="sr-only">Custom colour</span>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#FBBF24'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-slate-800/60 bg-slate-900/60"
        />
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-slate-800/60 bg-slate-900/60 px-2 py-2 font-mono text-[11px] text-slate-200 focus:border-cyan-500/50 focus:outline-none"
        />
      </label>
    </Row>
  )
}

function TextRow({ value, onChange, placeholder }) {
  return (
    <Row label="Label" htmlFor="prop-label">
      <input
        id="prop-label"
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${ROW} w-full rounded-lg border border-slate-800/60 bg-slate-900/60 px-2.5 text-[12px] font-semibold text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none`}
      />
    </Row>
  )
}

function ToggleRow({ label, value, onChange, hint }) {
  return (
    <Row label={label} value={value ? 'ON' : 'OFF'}>
      <button
        type="button"
        role="switch"
        aria-checked={!!value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`${ROW} flex w-full items-center justify-between rounded-lg border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          value
            ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
            : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700'
        }`}
      >
        <span>{value ? 'Enabled' : 'Disabled'}</span>
        <span className={`h-3 w-6 rounded-full ${value ? 'bg-cyan-400' : 'bg-slate-700'}`} />
      </button>
      {hint && <p className="text-[9px] leading-tight text-slate-600">{hint}</p>}
    </Row>
  )
}

function RotationRow({ value, onChange }) {
  const deg = radToDeg(value || 0)
  return (
    <Row label="Rotation" value={`${Math.round(deg)}°`} htmlFor="prop-rot">
      <div className="flex items-center gap-2">
        <RotateCw size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
        <input
          id="prop-rot"
          type="range"
          min={-180}
          max={180}
          step={1}
          value={Math.round(deg)}
          onChange={(e) => onChange(degToRad(parseInt(e.target.value, 10)))}
          className="h-8 min-w-0 flex-1 cursor-pointer accent-amber-400"
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {[0, 90, 180, 270].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(degToRad(d))}
            aria-pressed={Math.round(deg) === d}
            className={`${ROW} rounded-lg border text-[10px] font-bold transition-colors ${
              Math.round(deg) === d
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700'
            }`}
          >
            {d}°
          </button>
        ))}
      </div>
    </Row>
  )
}

/**
 * Render the controls for one property descriptor.
 * `kind` decides which control appears; `key` decides what is read and written.
 *
 * `anno` must already be default-resolved by the caller (see SelectionInspector),
 * so a missing field shows the number the renderer will actually use instead of
 * a guess. The defaults are per-type and genuinely differ — a rect is 12%
 * opaque while a brush is 88% — so a single hardcoded fallback would show a
 * value the drawing never uses.
 */
function PropControl({ prop, anno, onChange }) {
  const { key, kind } = prop
  const read = (fallback) => (anno[key] === undefined || anno[key] === null ? fallback : anno[key])
  const set = (v) => onChange({ [key]: v })

  // A kind with no control would otherwise fall through to the boolean toggle
  // and write `true` over a numeric field. The schema test forbids this, but
  // fail loudly rather than corrupting a value if one ever slips through.
  if (!CONTROL_KINDS.has(kind)) {
    return (
      <Row label={key} value="unsupported">
        <p className="text-[9px] text-amber-500">No control for &ldquo;{kind}&rdquo;</p>
      </Row>
    )
  }

  switch (kind) {
    case 'color':
      return <ColorRow value={read('#FBBF24')} onChange={set} />
    case 'opacity':
      return (
        <NumberRow
          label="Opacity"
          value={read(1)}
          min={0.05}
          max={1}
          step={0.05}
          onChange={set}
          presets={OPACITY_PRESETS}
        />
      )
    case 'stroke':
      return (
        <NumberRow
          label="Stroke Width"
          value={read(3.5)}
          min={1}
          max={24}
          step={0.5}
          unit="px"
          onChange={set}
          presets={STROKE_WIDTH_PRESETS.map((p) => ({ label: p.label.split(' ')[0], value: p.width }))}
        />
      )
    case 'size':
      return (
        <NumberRow
          label="Size"
          value={read(1)}
          min={0.25}
          max={4}
          step={0.05}
          unit="×"
          onChange={set}
          hint="Multiplier on the object's own dimensions."
        />
      )
    case 'rotation':
      return <RotationRow value={read(0)} onChange={set} />
    case 'text':
      return <TextRow value={read('')} onChange={set} placeholder="Name this object" />
    case 'fontSize':
      return (
        <NumberRow
          label="Text Size"
          value={read(20)}
          min={8}
          max={160}
          step={1}
          unit="px"
          onChange={set}
          presets={FONT_PRESETS.map((p) => ({ label: p.label.split(' ')[0], value: p.size }))}
        />
      )
    case 'fontWeight':
      return (
        <Row label="Text Weight" value={String(read(700))}>
          <div className="grid grid-cols-4 gap-1">
            {FONT_WEIGHTS.map((f) => {
              const active = read(700) === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set(f.value)}
                  aria-pressed={active}
                  className={`${ROW} rounded-lg border text-[10px] transition-colors ${
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                      : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700'
                  }`}
                  style={{ fontWeight: f.value }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </Row>
      )
    case 'radius':
      // A circle drawn by the original segment tool stores its radius as a
      // two-point distance, so read through `radiusOf` and always write `r`.
      return (
        <NumberRow
          label="Radius"
          value={Math.round(radiusOf(anno))}
          min={10}
          max={4000}
          step={10}
          unit="m"
          onChange={set}
        />
      )
    case 'fovAngle':
      return (
        <NumberRow
          label="Cone Angle"
          value={read(60)}
          min={5}
          max={180}
          step={5}
          unit="°"
          onChange={set}
          hint="Total opening of the wedge, not the half-angle."
        />
      )
    case 'fovRange':
      return (
        <NumberRow label="Cone Range" value={read(420)} min={50} max={4000} step={25} unit="m" onChange={set} />
      )
    case 'logoUrl':
      return <TextRow value={read('')} onChange={set} placeholder="https://… (blank = team default)" />
    case 'bool':
    default:
      return <ToggleRow label={key} value={!!read(false)} onChange={set} />
  }
}

/**
 * The type-driven selection inspector.
 *
 * @param {object} anno       the selected annotation
 * @param {Array}  props      descriptors from `propsFor(anno.type)`
 * @param {Function} onChange receives a patch object, e.g. `{ color: '#f00' }`
 *
 * Every change is coalesced into ONE undo step per interaction by the caller
 * (MapCanvas opens a transaction on pointerdown), so dragging a slider does not
 * fill the undo stack with hundreds of entries.
 */
export default function SelectionInspector({ anno, props, onChange }) {
  const [openGroups, setOpenGroups] = useState({})
  if (!anno) return null

  // Resolve defaults once, so every control reads the same effective object the
  // renderer draws. Without this a `fov` with no explicit range would show 400
  // in the slider while the cone was drawn at 420.
  const eff = withDefaults(anno)
  const { groups } = groupProps(props)
  const active = Object.entries(groups)

  return (
    <div className="space-y-4">
      {active.map(([name, list]) => {
        const isOpen = openGroups[name] !== false
        return (
          <div key={name} className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenGroups((g) => ({ ...g, [name]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between py-1"
            >
              <SectionLabel>{name}</SectionLabel>
              <span className="text-[10px] text-slate-600">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="space-y-3.5">
                {list.map((prop) => (
                  <PropControl key={prop.key} prop={prop} anno={eff} onChange={onChange} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
