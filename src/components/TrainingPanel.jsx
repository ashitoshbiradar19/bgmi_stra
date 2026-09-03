import { Zap, Telescope, Route, Crosshair, MapPin, ExternalLink, Target } from 'lucide-react'
import { TRAINING_CATEGORIES } from '../data/maps'
import { useRef, useEffect, useState } from 'react'

const ICONS = { zap: Zap, telescope: Telescope, route: Route }

function AccordionContent({ active, children }) {
  const contentRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (active && contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    } else {
      setHeight(0)
    }
  }, [active])

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: active ? height : 0, opacity: active ? 1 : 0 }}
    >
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  )
}

export default function TrainingPanel({ training, onPick, activeMapId, onSelectMap }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
        <div className="flex items-center gap-2.5 text-xs font-extrabold text-cyan-300">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
            <Target size={13} className="text-cyan-400" />
          </div>
          Skill Training
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Map-specific practice recommendations. Click to highlight locations on the canvas.
        </p>
      </div>

      {TRAINING_CATEGORIES.map((cat) => {
        const Icon = ICONS[cat.icon] || Crosshair
        const active = training === cat.id
        return (
          <div
            key={cat.id}
            className={`rounded-2xl border transition-all duration-200 ${
              active
                ? 'border-slate-600/50 bg-[#0D1525] shadow-lg'
                : 'border-slate-800/40 bg-slate-900/20 hover:border-slate-700/50'
            }`}
          >
            <button
              onClick={() => onPick(cat.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              aria-expanded={active}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200"
                style={{
                  backgroundColor: cat.bg,
                  borderColor: cat.border,
                  color: cat.accent,
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-slate-100">{cat.title}</span>
                <span className="block truncate text-[10px] font-medium text-slate-500">{cat.subtitle}</span>
              </div>
              <MapPin size={14} className={`shrink-0 transition-colors duration-200 ${active ? 'text-amber-400' : 'text-slate-600'}`} />
            </button>

            <AccordionContent active={active}>
              <div className="space-y-4 border-t border-slate-800/40 px-4 pb-4 pt-3.5">
                <p className="text-[11px] leading-relaxed text-slate-400">{cat.desc}</p>

                <div className="space-y-2">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Tactical Tips</div>
                  <ul className="space-y-1.5">
                    {cat.tips.map((tip) => (
                      <li key={tip} className="flex gap-2 text-[11px] text-slate-400">
                        <span className="font-bold shrink-0" style={{ color: cat.accent }}>›</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Practice Locations</div>
                  <div className="space-y-1.5">
                    {cat.spots.map((s) => {
                      const isCurrentMap = activeMapId === s.map
                      return (
                        <div
                          key={s.name}
                          className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all duration-200 ${
                            isCurrentMap
                              ? 'border-amber-400/20 bg-amber-400/5 text-slate-100'
                              : 'border-slate-800/30 bg-slate-900/15 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cat.accent }} />
                            <span className="truncate text-[11px] font-bold text-slate-200">{s.name}</span>
                            <span className="ml-auto flex items-center gap-1 rounded-md bg-slate-950/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-slate-500">
                              {s.map}
                              {!isCurrentMap && onSelectMap && (
                                <button
                                  onClick={() => onSelectMap(s.map)}
                                  className="ml-0.5 text-cyan-400 hover:underline active:scale-95 transition-all"
                                  title={`Switch to ${s.map}`}
                                >
                                  <ExternalLink size={8} />
                                </button>
                              )}
                            </span>
                          </div>
                          {s.desc && <p className="pl-3.5 text-[10px] text-slate-500">{s.desc}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="text-[10px] font-medium text-amber-400/70">
                  Target markers are highlighted on the canvas.
                </p>
              </div>
            </AccordionContent>
          </div>
        )
      })}
    </div>
  )
}
