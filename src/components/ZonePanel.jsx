import { Trash2, CircleDot, Move, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { STAGE_RADII, STAGE_DIAMETERS, STAGE_COLORS } from '../lib/render'

const fmtR = (r) => (r >= 100 ? `${Math.round(r)}m` : `${r % 1 ? r.toFixed(1) : r}m`)

export default function ZonePanel({
  circles,
  derivedCircles,
  selectedId,
  setSelectedId,
  addCircleAt,
  removeCircle,
}) {
  const present = new Set(circles.map((c) => c.stage))

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
          Clean terrain view with solid line outlines. Stage 1 (White) → Stage 8 (Red).
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
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`group flex flex-col rounded-xl border px-3 py-2.5 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500/40 bg-cyan-500/5 shadow-lg'
                        : breach
                        ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                        : warn
                        ? 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10'
                        : 'border-slate-800/40 bg-slate-800/20 hover:border-slate-700/60 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <CircleDot
                        size={14}
                        style={{ color: breach ? '#ef4444' : warn ? '#f59e0b' : STAGE_COLORS[c.stage - 1] }}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-100">Stage {c.stage}</span>
                        <span className="ml-2 font-mono text-[10px] text-amber-400 font-bold">{diam}</span>
                      </div>

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

                      {!breach && !warn && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 size={11} /> OK
                        </span>
                      )}
                    </div>


                  </div>
                )
              })}
          </div>

          {selectedId && (
            <button
              onClick={() => removeCircle(selectedId)}
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
