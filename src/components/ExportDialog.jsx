import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  X,
  Frame,
  Type,
  ListChecks,
  LayoutTemplate,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Trash2,
} from 'lucide-react'
import ExportPreview from './ExportPreview'
import {
  FRAME_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  HEADER_FIELDS,
  FOOTER_FIELDS,
  defaultFieldsFor,
  formatDateTime,
  APP_NAME,
} from '../lib/frames'
import {
  LOGO_POSITIONS,
  LOGO_SIZE_MIN,
  LOGO_SIZE_MAX,
  DEFAULT_BRAND_LOGO,
  readBrandLogo,
  writeBrandLogo,
  settingsFromFile,
  positionInfo,
} from '../lib/brandLogo'

// Small presentational helpers -------------------------------------------------

function FieldToggle({ id, label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${
        checked
          ? 'border-amber-400/45 bg-amber-400/10'
          : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border text-[9px] font-black ${
          checked ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600'
        }`}
        aria-hidden="true"
      >
        {checked ? '✓' : ''}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-[10px] font-extrabold ${checked ? 'text-amber-200' : 'text-slate-500'}`}>
          {label}
        </span>
        {hint ? <span className="block truncate text-[8px] font-semibold text-slate-600">{hint}</span> : null}
      </span>
      <span className="sr-only">{id}</span>
    </button>
  )
}

function TextInput({ label, value, onChange, placeholder, mono }) {
  return (
    <div className="space-y-1">
      <label className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-slate-100 placeholder-slate-600 focus:border-amber-400 focus:outline-none transition-colors ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

function SectionHeading({ icon: Icon, children, right }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
        <Icon size={11} className="text-amber-400" />
        {children}
      </div>
      {right}
    </div>
  )
}

/** Little schematic so each template is recognisable before you select it. */
function TemplateThumb({ template, active }) {
  const bandH = template.header?.enabled ? 5 : 0
  const footH = template.footer?.enabled ? 5 : 0
  return (
    <div
      className="flex h-9 w-full flex-col overflow-hidden rounded-[5px] border"
      style={{
        borderColor: active ? 'rgba(251,191,36,0.55)' : 'rgba(148,163,184,0.22)',
        background: template.bg,
      }}
    >
      {bandH > 0 && <div style={{ height: bandH, background: template.accent, opacity: 0.85 }} />}
      <div className="flex-1" style={{ background: 'linear-gradient(135deg,#0d1525,#060910)' }} />
      {footH > 0 && <div style={{ height: footH, background: template.accent2, opacity: 0.6 }} />}
    </div>
  )
}

/**
 * Brand logo controls for the export frame.
 *
 * This is the frame/branding layer's own logo. It is deliberately kept out of
 * the board document — team logos are tactical markers placed on the map, and
 * nothing here touches them. State lives in localStorage so the same logo is
 * applied to every future export without re-picking it.
 */
function BrandLogoPanel({ logo, onChange }) {
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [busy, setBusy] = useState(false)

  const has = !!logo.dataUrl
  const info = positionInfo(logo.position)

  const pick = async (file) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const res = await settingsFromFile(file, logo)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setWarning(res.warning)
      onChange(res.settings)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = () => {
    setError(null)
    setWarning(null)
    onChange({ ...DEFAULT_BRAND_LOGO, position: logo.position, size: logo.size, opacity: logo.opacity })
  }

  return (
    <div className="space-y-2.5">
      {/* Current logo: thumbnail or the built-in mark */}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700/60 bg-[#0A0F1A]">
          {has ? (
            <img
              src={logo.dataUrl}
              alt="Brand logo preview"
              className="max-h-full max-w-full object-contain"
              style={{ opacity: logo.opacity }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-600">
              <ImageIcon size={16} />
              <span className="text-[7px] font-bold uppercase tracking-wider">Built-in</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-200 transition-colors hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-50"
            >
              <Upload size={11} /> {has ? 'Replace' : 'Upload'}
            </button>
            {has && (
              <button
                type="button"
                onClick={remove}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-400 transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 size={11} /> Remove
              </button>
            )}
          </div>
          <p className="truncate text-[8.5px] font-semibold text-slate-500">
            {has ? `${logo.name} · ${logo.width}×${logo.height}px` : 'Using the built-in vector mark'}
          </p>
          <p className="text-[8px] font-semibold leading-tight text-slate-600">
            PNG, SVG, JPG or WebP. Stored in this browser only — never uploaded.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[9.5px] font-semibold text-red-300">
          {error}
        </p>
      )}
      {warning && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[9.5px] font-semibold text-amber-200/90">
          {warning}
        </p>
      )}

      {/* Position */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Position</span>
          <span className="font-mono text-[9px] font-bold text-slate-400">{info.label}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {LOGO_POSITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...logo, position: p.id })}
              aria-pressed={logo.position === p.id}
              className={`rounded-md border px-1.5 py-1.5 text-[9px] font-extrabold transition-colors ${
                logo.position === p.id
                  ? 'border-amber-400/55 bg-amber-400/10 text-amber-300'
                  : 'border-slate-800/70 bg-slate-900/40 text-slate-500 hover:border-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="brand-logo-size" className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Size
          </label>
          <span className="font-mono text-[9px] font-bold text-slate-400">{logo.size.toFixed(2)}×</span>
        </div>
        <input
          id="brand-logo-size"
          type="range"
          min={LOGO_SIZE_MIN}
          max={LOGO_SIZE_MAX}
          step={0.05}
          value={logo.size}
          onChange={(e) => onChange({ ...logo, size: Number(e.target.value) })}
          className="w-full accent-amber-400"
        />
      </div>

      {/* Opacity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="brand-logo-opacity" className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Opacity
          </label>
          <span className="font-mono text-[9px] font-bold text-slate-400">{Math.round(logo.opacity * 100)}%</span>
        </div>
        <input
          id="brand-logo-opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={logo.opacity}
          onChange={(e) => onChange({ ...logo, opacity: Number(e.target.value) })}
          className="w-full accent-amber-400"
        />
      </div>
    </div>
  )
}

export default function ExportDialog({
  onClose,
  onExport,
  board,
  mapName,
  zoneCount,
  initialMode = 'square',
  initialAnalyst = 'Ashitosh S. Biradar',
  initialDescription = '',
  exportRef,
  viewInfoRef,
}) {
  const [mode, setMode] = useState(initialMode)
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [fields, setFields] = useState(() => defaultFieldsFor(DEFAULT_TEMPLATE_ID))

  const [matchName, setMatchName] = useState('')
  const [subtitle, setSubtitle] = useState(initialDescription)
  const [analystName, setAnalystName] = useState(initialAnalyst)
  const [teamName, setTeamName] = useState('')
  const [strategyName, setStrategyName] = useState('')
  // Frozen so the preview and the download agree on the timestamp.
  const [stamp] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  // Brand logo, restored from this browser so it applies to every future
  // export. Stored in localStorage only — see lib/brandLogo.js.
  // Pull the editor's live view (zoom/pan + canvas CSS size) so "Current
  // View" mode matches what the coach is actually looking at. A ref is used
  // because it is read during render and must not trigger a re-render.
  const liveView = viewInfoRef?.current?.view || null
  const liveSize = viewInfoRef?.current?.size || null

  const [logo, setLogo] = useState(() => readBrandLogo())
  const [logoError, setLogoError] = useState(null)

  const updateLogo = (next) => {
    setLogo(next)
    const res = writeBrandLogo(next)
    setLogoError(res.error)
  }

  const template = useMemo(() => FRAME_TEMPLATES.find((t) => t.id === templateId), [templateId])

  // Switching template loads that template's default field selection.
  const chooseTemplate = (id) => {
    setTemplateId(id)
    setFields(defaultFieldsFor(id))
  }

  const toggle = (band, id) =>
    setFields((f) => ({ ...f, [band]: { ...f[band], [id]: !f[band][id] } }))

  const setAll = (band, defs, value) =>
    setFields((f) => ({ ...f, [band]: Object.fromEntries(defs.map((d) => [d.id, value])) }))

  const enabledCount =
    Object.values(fields.header).filter(Boolean).length +
    Object.values(fields.footer).filter(Boolean).length

  const frame = useMemo(
    () => ({
      templateId,
      fields,
      logo,
      content: {
        appName: APP_NAME,
        mapName,
        matchName,
        subtitle,
        analystName,
        teamName,
        strategyName,
        zoneCount,
        dateTime: formatDateTime(stamp),
      },
    }),
    [templateId, fields, logo, mapName, matchName, subtitle, analystName, teamName, strategyName, zoneCount, stamp],
  )

  // Ctrl/Cmd+Enter exports, Escape closes — same as the other dialogs.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doExport()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const doExport = async () => {
    if (busy) return
    setBusy(true)
    try {
      await exportRef.current?.({ mode, frame, t: stamp })
    } finally {
      setBusy(false)
    }
  }

  const bare = templateId === 'none'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-fade-in">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-amber-400/25 bg-[#0B1220] shadow-[0_0_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15">
              <Download size={15} className="text-amber-400" />
            </div>
            <div>
              <div className="text-[13px] font-extrabold tracking-tight text-white">Export Strategy Board</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Frame · Fields · Preview
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Close export dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid max-h-[78vh] grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* ---------------- LEFT: controls ---------------- */}
          <div className="space-y-5 p-4 sm:p-5 lg:border-r lg:border-slate-800/70">
            {/* Frame templates */}
            <section>
              <SectionHeading
                icon={LayoutTemplate}
                right={
                  <span className="font-mono text-[9px] font-bold text-slate-600">
                    {FRAME_TEMPLATES.length} TEMPLATES
                  </span>
                }
              >
                Frame Template
              </SectionHeading>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FRAME_TEMPLATES.map((t) => {
                  const active = t.id === templateId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => chooseTemplate(t.id)}
                      aria-pressed={active}
                      className={`rounded-xl border p-2 text-left transition-colors duration-150 ${
                        active
                          ? 'border-amber-400/60 bg-amber-400/10'
                          : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <TemplateThumb template={t} active={active} />
                      <div className={`mt-1.5 text-[11px] font-extrabold ${active ? 'text-amber-300' : 'text-slate-300'}`}>
                        {t.name}
                      </div>
                      <div className="mt-0.5 text-[8.5px] font-semibold leading-tight text-slate-500">
                        {t.blurb}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Canvas format */}
            <section>
              <SectionHeading icon={Frame}>Canvas Format</SectionHeading>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'square', label: '1:1 Square Map', hint: '2048 px map, framed' },
                  { id: 'view', label: 'Current Screen View', hint: 'Matches viewport ratio' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    className={`rounded-lg border p-2.5 text-left transition-colors duration-150 ${
                      mode === m.id
                        ? 'border-amber-400/50 bg-amber-400/10'
                        : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <div className={`text-[11px] font-extrabold ${mode === m.id ? 'text-amber-300' : 'text-slate-300'}`}>
                      {m.label}
                    </div>
                    <div className="mt-0.5 text-[8.5px] font-semibold text-slate-500">{m.hint}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Brand logo */}
            {!bare && (
              <section>
                <SectionHeading
                  icon={ImageIcon}
                  right={
                    <span className="font-mono text-[9px] font-bold text-slate-600">FRAME LAYER</span>
                  }
                >
                  Brand Logo
                </SectionHeading>
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-3">
                  <BrandLogoPanel logo={logo} onChange={updateLogo} />
                  {logoError && (
                    <p role="alert" className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[9.5px] font-semibold text-red-300">
                      {logoError}
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[8.5px] font-semibold leading-relaxed text-slate-600">
                  This is the export frame&rsquo;s own logo. Team logos placed on the map are unaffected.
                </p>
              </section>
            )}

            {/* Fields */}
            {!bare && (
              <>
                <section>
                  <SectionHeading
                    icon={ListChecks}
                    right={
                      <div className="flex gap-1">
                        <button
                          onClick={() => setAll('header', HEADER_FIELDS, true)}
                          className="rounded border border-slate-700/60 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-200"
                        >
                          All
                        </button>
                        <button
                          onClick={() => setAll('header', HEADER_FIELDS, false)}
                          className="rounded border border-slate-700/60 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-200"
                        >
                          None
                        </button>
                      </div>
                    }
                  >
                    Header Fields
                  </SectionHeading>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {HEADER_FIELDS.map((d) => (
                      <FieldToggle
                        key={d.id}
                        id={d.id}
                        label={d.label}
                        hint={d.hint}
                        checked={!!fields.header[d.id]}
                        onChange={() => toggle('header', d.id)}
                      />
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeading
                    icon={ListChecks}
                    right={
                      <div className="flex gap-1">
                        <button
                          onClick={() => setAll('footer', FOOTER_FIELDS, true)}
                          className="rounded border border-slate-700/60 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-200"
                        >
                          All
                        </button>
                        <button
                          onClick={() => setAll('footer', FOOTER_FIELDS, false)}
                          className="rounded border border-slate-700/60 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-200"
                        >
                          None
                        </button>
                      </div>
                    }
                  >
                    Footer Fields
                  </SectionHeading>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {FOOTER_FIELDS.map((d) => (
                      <FieldToggle
                        key={d.id}
                        id={d.id}
                        label={d.label}
                        checked={!!fields.footer[d.id]}
                        onChange={() => toggle('footer', d.id)}
                      />
                    ))}
                  </div>
                </section>

                {/* Text content */}
                <section>
                  <SectionHeading icon={Type}>Frame Text</SectionHeading>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {fields.header.matchName && (
                      <TextInput
                        label="Match Name"
                        value={matchName}
                        onChange={setMatchName}
                        placeholder="Squad Clash · Round 3"
                      />
                    )}
                    {fields.header.subtitle && (
                      <TextInput
                        label="Subtitle"
                        value={subtitle}
                        onChange={setSubtitle}
                        placeholder="Optional free text"
                      />
                    )}
                    {fields.footer.analystName && (
                      <TextInput label="Analyst" value={analystName} onChange={setAnalystName} placeholder="Your name" />
                    )}
                    {fields.footer.teamName && (
                      <TextInput label="Team" value={teamName} onChange={setTeamName} placeholder="Team or squad name" />
                    )}
                    {fields.footer.strategyName && (
                      <TextInput
                        label="Strategy"
                        value={strategyName}
                        onChange={setStrategyName}
                        placeholder="Strategy name"
                      />
                    )}
                    {fields.footer.mapName && (
                      <div className="space-y-1">
                        <label className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          Map Name (from board)
                        </label>
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2 font-mono text-[11px] font-bold text-slate-300">
                          {mapName}
                        </div>
                      </div>
                    )}
                    {fields.footer.zoneCount && (
                      <div className="space-y-1">
                        <label className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          Zone Count (from board)
                        </label>
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2 font-mono text-[11px] font-bold text-slate-300">
                          {zoneCount}
                        </div>
                      </div>
                    )}
                    {fields.footer.dateTime && (
                      <div className="space-y-1">
                        <label className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          Date / Time (frozen at open)
                        </label>
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2 font-mono text-[11px] font-bold text-slate-300">
                          {formatDateTime(stamp)}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {bare && (
              <p className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2.5 text-[10px] font-semibold leading-relaxed text-slate-500">
                <Sparkles size={11} className="mr-1 inline text-amber-400" />
                No Frame exports the bare map only — no header, no footer, no caption. Pick another template
                to add framing.
              </p>
            )}
          </div>

          {/* ---------------- RIGHT: preview ---------------- */}
          <div className="space-y-3 p-4 sm:p-5">
            <SectionHeading icon={Sparkles}>Live Preview</SectionHeading>
            <ExportPreview
              board={board}
              frame={frame}
              mode={mode}
              view={liveView}
              viewportW={liveSize?.w}
              viewportH={liveSize?.h}
            />
            <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Active</span>
              <span className="text-[10px] font-extrabold text-slate-200">{template.name}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3 sm:px-5">
          <p className="hidden text-[9.5px] font-semibold text-slate-500 sm:block">
            {enabledCount} field{enabledCount === 1 ? '' : 's'} enabled · <kbd className="tt-kbd">⌘</kbd>
            <kbd className="tt-kbd ml-0.5">↵</kbd> to export
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700/60 px-4 py-2.5 text-[11px] font-extrabold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={doExport}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-[11px] font-extrabold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
            >
              <Download size={14} />
              {busy ? 'Exporting…' : 'Download PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
