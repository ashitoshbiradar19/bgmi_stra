// Small presentational primitives shared by the header, toolbar and panels.
// Extracted so tool labels, icon buttons and section headings are defined once
// instead of being re-typed across a dozen copies (AGENTS.md rule 11).

/**
 * CSS-only tooltip. The label bubble is styled in `index.css` under `.tt-*`
 * and revealed by `:hover` / `:focus-within`, so showing it costs zero React
 * renders — important because the canvas re-renders on every animation frame.
 */
export function Tooltip({ label, kbd, side = 'top', children }) {
  if (!label) return children
  return (
    <span className={`tt tt-${side}`}>
      {children}
      <span className="tt-box" role="tooltip">
        {label}
        {kbd ? <span className="tt-kbd">{kbd}</span> : null}
      </span>
    </span>
  )
}

const ICON_BUTTON_BASE =
  'flex shrink-0 items-center justify-center rounded-lg border text-slate-400 transition-colors duration-150 ' +
  'hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-100 ' +
  'disabled:pointer-events-none disabled:opacity-30'

/**
 * Square icon button. Keeps the 44px minimum touch target on small screens
 * (AGENTS.md rule 6) while staying visually compact on desktop.
 */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  tone = 'default',
  size = 'md',
  side = 'top',
  className = '',
}) {
  const box = size === 'xs' ? 'h-8 w-8' : size === 'sm' ? 'h-9 w-9' : 'h-9 w-9 sm:h-10 sm:w-10'
  const iconSize = size === 'xs' ? 14 : size === 'sm' ? 15 : 16

  let toneClass = 'border-slate-800/60 bg-slate-900/40'
  if (active) {
    toneClass =
      tone === 'danger'
        ? 'border-red-500/50 bg-red-500/15 text-red-300'
        : 'border-amber-400/50 bg-amber-400/15 text-amber-300'
  } else if (tone === 'danger') {
    toneClass = 'border-slate-800/60 bg-slate-900/40 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
  } else if (tone === 'primary') {
    toneClass = 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:border-amber-400/70 hover:bg-amber-400/20'
  }

  return (
    <Tooltip label={label} side={side}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active || undefined}
        className={`${ICON_BUTTON_BASE} ${box} ${toneClass} ${className}`}
      >
        <Icon size={iconSize} />
      </button>
    </Tooltip>
  )
}

/** Uppercase micro-heading used above every panel section. */
export function SectionLabel({ children, className = '' }) {
  return (
    <div className={`text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500 ${className}`}>
      {children}
    </div>
  )
}

/** Vertical hairline used to separate toolbar groups. */
export function ToolbarDivider({ className = '' }) {
  return <span className={`mx-1 h-5 w-px shrink-0 bg-slate-700/50 ${className}`} />
}
