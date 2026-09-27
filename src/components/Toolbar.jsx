import { useEffect, useRef, useState } from 'react'
import { Undo2, Redo2, ChevronDown, Check } from 'lucide-react'
import { PRIMARY_TOOLS, MORE_TOOLS, TOOL_BY_ID, toolLabel } from '../data/tools'
import { IconButton, Tooltip, ToolbarDivider } from './ui'

/**
 * The horizontal tool rail that sits directly under the header on desktop and
 * docks to the bottom of the screen on phones.
 *
 * Layout is driven entirely by breakpoint classes rather than JS width checks,
 * so the same markup serves both positions — App.jsx reorders the flex column
 * with `order-*` to move this element between the top and bottom.
 */
export default function Toolbar({
  activeTool,
  setActiveTool,
  penColor,
  canUndo,
  canRedo,
  handleUndo,
  handleRedo,
  className = '',
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  // Close the overflow menu on any outside click / Escape.
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const moreActive = MORE_TOOLS.some((t) => t.id === activeTool)
  const activeDef = TOOL_BY_ID[activeTool]

  return (
    <div
      className={`relative z-20 shrink-0 border-t border-slate-800/50 bg-[#0B1120]/95 px-1.5 py-1.5 backdrop-blur-xl md:border-b md:border-t-0 md:px-3 md:py-2 safe-left safe-right ${className}`}
      role="toolbar"
      aria-label="Drawing tools"
    >
      <div className="flex items-center gap-2">
        {/* Scrollable tool group. On desktop the row fits without scrolling, so
            overflow is disabled there to keep the readout pinned right. */}
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto md:overflow-visible">
          {PRIMARY_TOOLS.map((tool) => {
            const Icon = tool.icon
            const isActive = tool.id === activeTool
            return (
              <Tooltip key={tool.id} label={tool.label} kbd={tool.key} side="bottom">
                <button
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg border py-1.5 transition-colors duration-150 ${
                    isActive
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                      : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-100'
                  } min-h-9 min-w-9 md:min-w-10`}
                >
                  <Icon size={16} />
                  <span className="hidden text-[11px] font-bold tracking-tight lg:inline">{tool.label}</span>
                </button>
              </Tooltip>
            )
          })}

          {/* Overflow menu keeps the 5 remaining original tools reachable
              without stretching the rail (AGENTS.md rule 2). */}
          <div className="relative shrink-0" ref={moreRef}>
            <Tooltip label="More tools" side="bottom">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More tools"
                aria-expanded={moreOpen}
                className={`flex shrink-0 items-center justify-center gap-1 rounded-lg border px-2 transition-colors duration-150 min-h-9 min-w-9 md:min-w-10 ${
                  moreActive
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <ChevronDown size={15} className={moreOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                <span className="hidden text-[11px] font-bold tracking-tight lg:inline">More</span>
              </button>
            </Tooltip>

            {moreOpen && (
              <div className="glass-dropdown absolute bottom-full left-0 z-50 mb-1.5 w-[176px] rounded-lg p-1 animate-slide-up md:top-full md:bottom-auto md:mt-1.5">
                {MORE_TOOLS.map((tool) => {
                  const Icon = tool.icon
                  const isActive = tool.id === activeTool
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setActiveTool(tool.id)
                        setMoreOpen(false)
                      }}
                      aria-label={tool.label}
                      aria-pressed={isActive}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11px] font-bold transition-colors duration-150 ${
                        isActive ? 'bg-amber-400/15 text-amber-300' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="flex-1 truncate">{tool.label}</span>
                      {isActive ? (
                        <Check size={13} className="shrink-0 text-amber-400" />
                      ) : (
                        <span className="tt-kbd shrink-0">{tool.key}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* History controls stay pinned outside the scroll area so they are
            always reachable on a phone. */}
        <div className="flex shrink-0 items-center gap-1">
          <ToolbarDivider className="hidden md:block" />
          <IconButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={!canUndo} side="top" />
          <IconButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={!canRedo} side="top" />
        </div>

        {/* Active tool readout — desktop only, the active button already
            communicates this on touch layouts. */}
        <div className="hidden shrink-0 items-center gap-2 border-l border-slate-800/60 pl-3 lg:flex">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/15"
            style={{ background: penColor }}
            aria-hidden="true"
          />
          <div className="leading-none">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Active</div>
            <div className="mt-1 text-[11px] font-extrabold text-slate-100">{toolLabel(activeTool)}</div>
          </div>
          {activeDef?.key && <span className="tt-kbd">{activeDef.key}</span>}
        </div>
      </div>
    </div>
  )
}
