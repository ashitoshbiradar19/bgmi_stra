import { Trash2, CircleDot, Move, AlertTriangle, ShieldAlert, CheckCircle2, MousePointerClick, Palette, RotateCcw, Maximize2 } from 'lucide-react'
import { STAGE_RADII, STAGE_DIAMETERS, STAGE_COLORS } from '../lib/render'
import { COLOR_PRESETS } from '../data/colors'

const fmtR = (r) => (r >= 100 ? `${Math.round(r)}m` : `${r % 1 ? r.toFixed(1) : r}m`)

export default function ZonePanel({
  circles,
  derivedCircles,
  selectedId,
  setSelectedId,
  addCircleAt,
  removeCircle,
  updateCircleColor,
  updateCircleRadius,
  handleColorSelect,
}) {
  const present = new Set(circles.map((c) => c.stage))
  const selectedCircle = derivedCircles.find((c) => c.id === selectedId)

  return (
    <div className="space-y-5">
      {/* Overview Card */}
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
        <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15">
              <CheckCircle2 size={12} className="text-cyan-400" />
            </div>
            Playzone Engine
          </div>
          <span className="rounded-lg bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-400 border border-cyan-500/20">
            SOLID LINES
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Clean terrain view with customizable zone outlines. Stage 1 (White) → Stage 8 (Red).
        </p>
      </div>

      {/* Circle Specs */}
      <div className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-3.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span>Circle Specifications</span>
          <span className="font-mono text-[9px] text-cyan-400">Stages 1-8</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Diameters: Stage 1 (4560m) → Stage 8 (46m). Drag chips or click <span className="text-cyan-400 font-bold">+</span> to place.
        </p>
      </div>

      {/* Active Zones */}
      {derivedCircles.length > 0 && (
        <div className="space-y-2.5 rounded-2xl border border-slate-800/40 bg-[#0D1525] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Active Zones</span>
            <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-400">
              {derivedCircles.length}/8
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            {[...derivedCircles]
              .sort((a, b) => a.stage - b.stage)
              .map((c) => {
                const isSelected = selectedId === c.id
                const breach = c.violating
                const warn = !breach && c.waterWarn
                const diam = `⌀${Math.round(c.r * 2)}m`
                const circleColor = c.color || STAGE_COLORS[c.stage - 1] || '#FFFFFF'
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`group flex flex-col rounded-xl border px-3 py-2.5 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
                        : breach
                        ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                        : warn
                        ? 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10'
                        : 'border-slate-800/40 bg-slate-800/20 hover:border-slate-700/60 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20 transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: breach ? '#ef4444' : warn ? '#f59e0b' : circleColor,
                          boxShadow: `0 0 8px ${circleColor}88`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-100">Stage {c.stage}</span>
                        <span className="ml-2 font-mono text-[10px] text-amber-400 font-bold">{diam}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(c.id)
                        }}
                        className={`shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-extrabold transition-all duration-150 ${
                          isSelected
                            ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                            : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300'
                        }`}
                        title="Select this circle to edit or move it"
                      >
                        <MousePointerClick size={10} /> SEL
                      </button>

                      {isSelected && (
                        <span className="flex items-center gap-1 rounded-lg bg-cyan-500/15 px-2 py-0.5 text-[9px] font-extrabold text-cyan-300 border border-cyan-500/30">
                          <CheckCircle2 size={9} /> ACTIVE
                        </span>
                      )}

                      {breach && (
                        <span className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-0.5 text-[9px] font-extrabold text-red-400 border border-red-500/20">
                          <ShieldAlert size={9} /> BOUNDARY
                        </span>
                      )}

                      {c.waterWarn && !breach && (
                        <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[9px] font-extrabold text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={9} /> {Math.round((c.waterRatio || 0) * 100)}% WATER
                        </span>
                      )}

                      {!breach && !warn && !isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 size={11} /> OK
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-2.5 space-y-2 rounded-xl border border-cyan-500/20 bg-slate-950/60 p-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300">
                          <span className="flex items-center gap-1.5">
                            <Palette size={11} /> Circle Color
                          </span>
                          <span className="font-mono text-[9px] uppercase text-amber-400">
                            {c.color || 'Default Stage'}
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {COLOR_PRESETS.map((cp) => (
                            <button
                              key={cp.hex}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (updateCircleColor) updateCircleColor(c.id, cp.hex)
                                else if (handleColorSelect) handleColorSelect(cp.hex)
                              }}
                              title={cp.name}
                              className={`h-5 w-5 rounded-full border transition-all duration-150 ${
                                (c.color || STAGE_COLORS[c.stage - 1])?.toLowerCase() === cp.hex.toLowerCase()
                                  ? 'scale-125 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)] z-10'
                                  : 'border-transparent hover:scale-110 opacity-75 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: cp.hex }}
                            />
                          ))}
                          <label
                            title="Custom Circle Color"
                            onClick={(e) => e.stopPropagation()}
                            className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-slate-600 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-red-500 via-green-500 to-blue-500 hover:scale-110"
                          >
                            <input
                              type="color"
                              value={c.color || STAGE_COLORS[c.stage - 1] || '#FFFFFF'}
                              onChange={(e) => {
                                if (updateCircleColor) updateCircleColor(c.id, e.target.value)
                                else if (handleColorSelect) handleColorSelect(e.target.value)
                              }}
                              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>
                        {c.color && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (updateCircleColor) updateCircleColor(c.id, undefined)
                            }}
                            className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-amber-400 transition-colors"
                          >
                            <RotateCcw size={10} /> Reset to Stage Default Color
                          </button>
                        )}

                        {/* Circle Radius / Size Control */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300">
                            <span className="flex items-center gap-1.5">
                              <Maximize2 size={11} /> Circle Size / Radius
                            </span>
                            <span className="font-mono text-[10px] font-bold text-amber-400">
                              r = {Math.round(c.r)}m (⌀{Math.round(c.r * 2)}m)
                            </span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={3000}
                            step={10}
                            value={Math.round(c.r)}
                            onChange={(e) => {
                              if (updateCircleRadius) updateCircleRadius(c.id, parseInt(e.target.value, 10))
                            }}
                            className="w-full cursor-pointer accent-cyan-400"
                          />
                          <div className="grid grid-cols-4 gap-1">
                            {[100, 300, 700, STAGE_RADII[c.stage - 1]].map((sz) => (
                              <button
                                key={sz}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (updateCircleRadius) updateCircleRadius(c.id, sz)
                                }}
                                className={`rounded-md border py-1 text-[9px] font-extrabold transition-all ${
                                  Math.abs(c.r - sz) < 5
                                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                }`}
                              >
                                {sz === STAGE_RADII[c.stage - 1] ? 'Default' : `${sz}m`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {selectedId && (
            <button
              onClick={() => removeCircle && removeCircle(selectedId)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 py-2 text-[11px] font-bold text-red-400 transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
            >
              <Trash2 size={12} /> Remove Zone
            </button>
          )}
        </div>
      )}

      {/* Stage Chips */}
      <div className="space-y-2.5">
        <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Playzone Stages</div>
        <div className="grid grid-cols-2 gap-1.5">
          {STAGE_RADII.map((r, i) => {
            const stage = i + 1
            const placed = present.has(stage)
            const diam = STAGE_DIAMETERS[i]
            return (
              <div
                key={stage}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/x-zone-stage', String(stage))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className={`group flex cursor-grab items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 active:cursor-grabbing min-h-[44px] active:scale-[0.97] ${
                  placed
                    ? 'border-slate-800/40 bg-slate-900/20 opacity-50'
                    : 'border-slate-800/40 bg-[#0D1525] hover:border-amber-400/30 hover:bg-slate-800/30'
                }`}
                title={placed ? 'Already placed — drag for another' : 'Drag onto map or click +'}
              >
                <Move size={13} className="shrink-0 text-slate-600 group-hover:text-amber-400" />
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                  style={{ backgroundColor: STAGE_COLORS[i], boxShadow: `0 0 8px ${STAGE_COLORS[i]}66` }}
                />
                <div className="min-w-0 leading-tight flex-1">
                  <div className="text-[11px] font-bold text-slate-200">Stage {stage}</div>
                  <div className="font-mono text-[9px] text-amber-400 font-extrabold">⌀ {diam}m</div>
                </div>
                <button
                  onClick={() => addCircleAt(stage)}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/40 text-[11px] font-black text-slate-300 transition-all duration-200 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300 active:scale-95 min-h-[32px] min-w-[32px]"
                  title="Place at center"
                >
                  +
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Validation Rules */}
      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300">
          <ShieldAlert size={13} /> Validation Rules
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          <span className="text-red-400 font-semibold">Containment:</span> Stage N+1 must fit inside Stage N.
          <br />
          <span className="text-amber-400 font-semibold">Water:</span> Stage 4+ zones with {'>'}50% water trigger alerts.
        </p>
      </div>
    </div>
  )
}
