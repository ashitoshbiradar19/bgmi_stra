import { useState } from 'react'
import {
  MousePointer2,
  PenLine,
  Minus,
  MoveUpRight,
  MapPin,
  Plane,
  Car,
  Home,
  Type,
  Layers,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Eraser,
  Sparkles,
  ShieldAlert,
  Cloud,
  Compass,
  Trash2,
  X,
} from 'lucide-react'
import TrainingPanel from './TrainingPanel'
import ZonePanel from './ZonePanel'
import TeamRecords from './TeamRecords'
import { MAPS, PRESET_STRATEGIES } from '../data/maps'
import { MAP_TOURNAMENT_CONFIGS, analyzeRondoTerrain, checkBridgeCamp } from '../data/tournament'
import { getReachableCompounds } from '../lib/render'
import { COLOR_PRESETS, FONT_PRESETS, STROKE_WIDTH_PRESETS } from '../data/colors'

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'pin', icon: MapPin, label: 'Pin', key: 'P' },
  { id: 'flight1', icon: Plane, label: 'Flight Path', key: 'F' },
  { id: 'flight2', icon: Plane, label: 'Flight Path 2', key: 'F2' },
  { id: 'brush', icon: PenLine, label: 'Brush', key: 'B' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { id: 'smoke', icon: Cloud, label: 'Smoke', key: 'S' },
  { id: 'compound', icon: Home, label: 'Compound', key: 'C' },
  { id: 'ridge', icon: Compass, label: 'Ridge', key: 'R' },
  { id: 'vehicle', icon: Car, label: 'Vehicle', key: 'G' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
]

const LAYER_TYPES = [
  { id: 'flight', label: 'Flight paths' },
  { id: 'brush', label: 'Brush & arrows' },
  { id: 'pin', label: 'Squad pins' },
  { id: 'smoke', label: 'Smoke walls' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'compound', label: 'Compounds' },
]

function SectionTitle({ children, className = '' }) {
  return <div className={`text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500 ${className}`}>{children}</div>
}

function ColorPickerGrid({ activeColor, onSelectColor, label = 'Color Palette' }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>{label}</SectionTitle>
        <span className="font-mono text-[9px] font-bold text-amber-400 uppercase">{activeColor}</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-slate-800/60 bg-slate-950/60 p-2.5">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.hex}
            onClick={() => onSelectColor(c.hex)}
            title={`${c.name} (${c.hex})`}
            className={`h-6 w-6 rounded-full border-2 transition-all duration-150 ${
              activeColor?.toLowerCase() === c.hex.toLowerCase()
                ? 'scale-[1.2] border-white/90 shadow-[0_0_12px_rgba(255,255,255,0.5)] z-10'
                : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <label
          title="Pick Custom Color"
          className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-slate-600 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform"
        >
          <input
            type="color"
            value={activeColor || '#FBBF24'}
            onChange={(e) => onSelectColor(e.target.value)}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  )
}

export default function Sidebar(props) {
  const {
    collapsed,
    setCollapsed,
    tab,
    setTab,
    activeTool,
    setActiveTool,
    penColor,
    setPenColor,
    handleColorSelect,
    updateAnnoFontSize,
    updateAnnoWidth,
    updateAnnoLabel,
    removeAnno,
    selectedId,
    setSelectedId,
    layers,
    toggleLayer,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    clearAnnos,
    onLoadPreset,
    activeMapId,
    onSelectMap,
    circles = [],
    annos = [],
    showHeatmap,
    setShowHeatmap,
    showContours,
    setShowContours,
    ...zoneProps
  } = props

  const selectColorHandler = handleColorSelect || setPenColor

  const [confirmClear, setConfirmClear] = useState(false)

  const selectedAnno = annos.find((a) => a.id === selectedId)

  const activeTourneyConfig = MAP_TOURNAMENT_CONFIGS[activeMapId] || MAP_TOURNAMENT_CONFIGS.erangel
  const bridgeAlerts = activeMapId === 'erangel' ? checkBridgeCamp(circles, annos) : []
  const rondoTerrain = activeMapId === 'rondo' && circles.length ? analyzeRondoTerrain(circles[circles.length - 1]) : null

  const activeMapObj = MAPS[activeMapId] || MAPS.erangel
  const flightAnno = annos.find((a) => a.type === 'flight' || a.type === 'flight1' || a.type === 'flight2')
  const reachableCompounds = flightAnno ? getReachableCompounds(flightAnno, activeMapObj.pois) : []

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-11 shrink-0 flex-col items-center gap-4 border-r border-slate-800/60 bg-[#090E1A] py-5 text-slate-500 hover:text-cyan-400 animate-fade-in transition-colors duration-200"
        title="Expand Control Panel"
        aria-label="Expand Control Panel"
      >
        <Layers size={17} />
        <span className="[writing-mode:vertical-rl] text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
          Panel
        </span>
      </button>
    )
  }

  const tabs = [
    { id: 'zones', label: 'Zones' },
    { id: 'tools', label: 'Tools' },
    { id: 'engine', label: 'Engine' },
    { id: 'presets', label: 'Presets' },
    { id: 'teams', label: 'Teams' },
    { id: 'train', label: 'Train' },
  ]

  return (
    <aside className="flex h-full w-full sm:w-80 shrink-0 flex-col border-r border-slate-800/60 bg-[#090E1A] z-20 animate-fade-in">
      {/* Tabs Navbar */}
      <div className="flex shrink-0 items-center border-b border-slate-800/60 bg-[#0B1120]/80">
        <div className="flex flex-1 items-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-3 text-[10px] font-extrabold tracking-wide transition-all duration-200 min-h-[44px] ${
                tab === t.id
                  ? 'text-amber-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-amber-400 to-yellow-300" />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 min-h-[44px] transition-all duration-200"
          title="Collapse Sidebar"
          aria-label="Collapse Sidebar"
        >
          <EyeOff size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'zones' && <ZonePanel circles={circles} {...zoneProps} />}

        {tab === 'tools' && (
          <div className="space-y-5">
            {/* Annotation Tools Grid */}
            <div className="space-y-2.5">
              <SectionTitle>Annotation Tools</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    title={`${t.label} [${t.key}]`}
                    aria-label={`${t.label} tool`}
                    aria-pressed={activeTool === t.id}
                    className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 min-h-[44px] active:scale-[0.97] ${
                      activeTool === t.id
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.08)]'
                        : 'border-slate-800/50 bg-[#0D1525] text-slate-400 hover:border-slate-700/60 hover:text-slate-200'
                    }`}
                  >
                    <t.icon size={15} className={`shrink-0 ${activeTool === t.id ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <div className="min-w-0">
                      <span className="block truncate text-[11px] font-bold text-slate-100">{t.label}</span>
                      <span className="block font-mono text-[9px] text-slate-600">[{t.key}]</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Item Inspector */}
            {selectedAnno && (
              <div className="space-y-3 rounded-2xl border border-cyan-500/20 bg-[#0D1525] p-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5 text-xs font-extrabold text-cyan-300">
                  <span className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15">
                      <Sparkles size={12} className="text-cyan-400" />
                    </div>
                    {selectedAnno.type === 'text' ? 'Text Inspector' : `${selectedAnno.type.toUpperCase()} Inspector`}
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    title="Deselect"
                  >
                    <X size={13} />
                  </button>
                </div>

                {selectedAnno.type === 'text' && (
                  <>
                    <div className="space-y-1.5">
                      <SectionTitle>Text Content</SectionTitle>
                      <input
                        type="text"
                        value={selectedAnno.label || ''}
                        onChange={(e) => updateAnnoLabel && updateAnnoLabel(selectedAnno.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3.5 py-2.5 text-xs font-medium text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
                        placeholder="Type text note..."
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <SectionTitle>Font Size</SectionTitle>
                        <span className="font-mono text-[10px] font-bold text-cyan-400">
                          {selectedAnno.fontSize || 20}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={120}
                        step={1}
                        value={selectedAnno.fontSize || 20}
                        onChange={(e) =>
                          updateAnnoFontSize && updateAnnoFontSize(selectedAnno.id, parseInt(e.target.value, 10))
                        }
                        className="w-full cursor-pointer accent-cyan-400"
                      />
                      <div className="grid grid-cols-3 gap-1">
                        {FONT_PRESETS.map((p) => (
                          <button
                            key={p.size}
                            onClick={() => updateAnnoFontSize && updateAnnoFontSize(selectedAnno.id, p.size)}
                            className={`rounded-lg border py-1.5 text-[10px] font-bold transition-all duration-150 ${
                              (selectedAnno.fontSize || 20) === p.size
                                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                                : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {(selectedAnno.type === 'arrow' || selectedAnno.type === 'line' || selectedAnno.type === 'brush') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <SectionTitle>Thickness</SectionTitle>
                      <span className="font-mono text-[10px] font-bold text-amber-400">
                        {selectedAnno.width || (selectedAnno.type === 'arrow' ? 4 : 3.5)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={30}
                      step={1}
                      value={selectedAnno.width || (selectedAnno.type === 'arrow' ? 4 : 3.5)}
                      onChange={(e) =>
                        updateAnnoWidth && updateAnnoWidth(selectedAnno.id, parseInt(e.target.value, 10))
                      }
                      className="w-full cursor-pointer accent-amber-400"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      {STROKE_WIDTH_PRESETS.map((p) => (
                        <button
                          key={p.width}
                          onClick={() => updateAnnoWidth && updateAnnoWidth(selectedAnno.id, p.width)}
                          className={`rounded-lg border py-1.5 text-[10px] font-bold transition-all duration-150 ${
                            (selectedAnno.width || (selectedAnno.type === 'arrow' ? 4 : 3.5)) === p.width
                              ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                              : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <ColorPickerGrid
                  activeColor={selectedAnno.color || penColor}
                  onSelectColor={selectColorHandler}
                  label="Item Color"
                />

                <button
                  onClick={() => removeAnno && removeAnno(selectedAnno.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/8 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/15 active:scale-[0.98] transition-all duration-200"
                >
                  <Trash2 size={13} /> Remove Item
                </button>
              </div>
            )}

            {/* Default Color Palette */}
            <ColorPickerGrid
              activeColor={penColor}
              onSelectColor={selectColorHandler}
              label="Default Tool Color"
            />

            {/* Layer Toggles */}
            <div className="space-y-2">
              <SectionTitle>Layer Visibility</SectionTitle>
              <div className="space-y-1">
                {LAYER_TYPES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggleLayer(l.id)}
                    aria-pressed={layers[l.id] !== false}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-150 ${
                      layers[l.id] !== false
                        ? 'border-slate-700/60 bg-slate-800/40 text-slate-200'
                        : 'border-slate-800/40 bg-slate-900/20 text-slate-600 opacity-60'
                    }`}
                  >
                    <span>{l.label}</span>
                    {layers[l.id] !== false ? <Eye size={13} className="text-amber-400" /> : <EyeOff size={13} />}
                  </button>
                ))}
              </div>
            </div>

            {/* History & Reset */}
            <div className="space-y-2">
              <SectionTitle>History</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800/60 bg-slate-800/30 px-2 py-2 text-[11px] font-bold text-slate-300 enabled:hover:border-slate-600 enabled:hover:text-white disabled:opacity-25 active:scale-[0.97] transition-all duration-200"
                >
                  <Undo2 size={12} /> Undo
                </button>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800/60 bg-slate-800/30 px-2 py-2 text-[11px] font-bold text-slate-300 enabled:hover:border-slate-600 enabled:hover:text-white disabled:opacity-25 active:scale-[0.97] transition-all duration-200"
                >
                  <Redo2 size={12} /> Redo
                </button>
              </div>
              <button
                onClick={() => {
                  if (confirmClear) {
                    clearAnnos()
                    setConfirmClear(false)
                  } else {
                    setConfirmClear(true)
                    setTimeout(() => setConfirmClear(false), 2500)
                  }
                }}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-bold transition-all duration-200 active:scale-[0.97] ${
                  confirmClear
                    ? 'border-red-500/50 bg-red-500/15 text-red-300'
                    : 'border-red-500/20 bg-red-500/5 text-red-400/70 hover:bg-red-500/10 hover:text-red-400'
                }`}
              >
                <Eraser size={12} /> {confirmClear ? 'Confirm Clear?' : 'Clear All'}
              </button>
            </div>
          </div>
        )}

        {/* Tournament Engine Tab */}
        {tab === 'engine' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2.5 text-xs font-extrabold text-cyan-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
                  <Sparkles size={13} className="text-cyan-400" />
                </div>
                {activeTourneyConfig.title}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Official BMPS/BGIS rules engine with map-specific choke triggers, terrain reports, and flight corridor analysis.
              </p>
            </div>

            {/* Flight Path Analyzer */}
            <div className="space-y-2.5">
              <SectionTitle>Flight Trajectory & Gliding Zone</SectionTitle>
              {flightAnno ? (
                <div className="space-y-2.5 rounded-2xl border border-sky-500/15 bg-sky-500/5 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                    <span className="flex items-center gap-2">
                      <Plane size={13} /> Flight Active
                    </span>
                    <span className="rounded-lg bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-400 border border-amber-400/20">
                      1.8km
                    </span>
                  </div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Reachable Compounds
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {reachableCompounds.map((poi) => (
                      <div
                        key={poi.name}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                          poi.reachable
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                            : 'border-slate-800/40 bg-slate-950/40 text-slate-600'
                        }`}
                      >
                        <span className="truncate">{poi.name}</span>
                        <span className="font-mono text-[10px] font-bold shrink-0 ml-2">
                          {poi.reachable ? `${poi.dist}m` : `${(poi.dist / 1000).toFixed(1)}km`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800/40 bg-slate-900/30 p-4">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    No flight vector set. Use <strong className="text-cyan-400">Flight Path (F)</strong> tool on the map.
                  </p>
                  <button
                    onClick={() => setActiveTool('flight1')}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/8 py-2 text-[11px] font-bold text-sky-300 hover:bg-sky-500/15 active:scale-[0.98] transition-all duration-200"
                  >
                    <Plane size={13} /> Draw Flight Path
                  </button>
                </div>
              )}
            </div>

            {/* Map-Specific Features */}
            {activeMapId === 'erangel' && (
              <div className="space-y-2.5">
                <SectionTitle>Erangel Features</SectionTitle>
                <div className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-3.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span>Bridge Choke Alert</span>
                    <span className={`h-2 w-2 rounded-full ${bridgeAlerts.length ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                  </div>
                  {bridgeAlerts.length ? (
                    <div className="mt-2 space-y-1">
                      {bridgeAlerts.map((b) => (
                        <div key={b.name} className="flex items-center gap-1.5 text-[11px] font-bold text-red-400">
                          <ShieldAlert size={13} /> {b.alert}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-slate-600">No bridge camp threats in current zones.</p>
                  )}
                </div>
              </div>
            )}

            {activeMapId === 'sanhok' && (
              <div className="space-y-2.5">
                <SectionTitle>Sanhok Heatmap</SectionTitle>
                <button
                  onClick={() => setShowHeatmap && setShowHeatmap(!showHeatmap)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition-all duration-200 ${
                    showHeatmap
                      ? 'border-red-500/25 bg-red-500/8 text-red-300'
                      : 'border-slate-800/40 bg-slate-900/30 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">🔥</span> CQC Heatmap
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${showHeatmap ? 'bg-red-500/15 text-red-400' : 'bg-slate-800/60 text-slate-500'}`}>{showHeatmap ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )}

            {activeMapId === 'miramar' && (
              <div className="space-y-2.5">
                <SectionTitle>Miramar Topography</SectionTitle>
                <button
                  onClick={() => setShowContours && setShowContours(!showContours)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition-all duration-200 ${
                    showContours
                      ? 'border-amber-500/25 bg-amber-500/8 text-amber-300'
                      : 'border-slate-800/40 bg-slate-900/30 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass size={13} /> Elevation Contours
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${showContours ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800/60 text-slate-500'}`}>{showContours ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )}

            {activeMapId === 'rondo' && rondoTerrain && (
              <div className="space-y-2.5">
                <SectionTitle>Rondo Terrain</SectionTitle>
                <div className="space-y-3 rounded-xl border border-slate-800/40 bg-slate-900/30 p-4 text-[11px] font-bold">
                  <div>
                    <div className="flex justify-between text-cyan-300 mb-1.5">
                      <span>Urban Density</span>
                      <span className="font-mono">{rondoTerrain.urban}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${rondoTerrain.urban}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-emerald-300 mb-1.5">
                      <span>Bamboo Cover</span>
                      <span className="font-mono">{rondoTerrain.bamboo}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${rondoTerrain.bamboo}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'presets' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2.5 text-xs font-extrabold text-emerald-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Sparkles size={13} className="text-emerald-400" />
                </div>
                Scenario Presets
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                One-click load classic competitive match scenarios with zones, flight paths, and squad pins.
              </p>
            </div>

            <div className="space-y-2.5">
              {PRESET_STRATEGIES.map((p) => (
                <div
                  key={p.id}
                  className="group rounded-2xl border border-slate-800/40 bg-[#0D1525] p-4 hover:border-cyan-500/25 transition-all duration-200"
                >
                  <div className="text-[12px] font-bold text-slate-100">{p.name}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{p.desc}</p>
                  <button
                    onClick={() => onLoadPreset(p)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-2 text-[11px] font-extrabold text-slate-950 shadow-[0_2px_12px_rgba(6,182,212,0.2)] hover:shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:scale-[1.01] active:scale-95 transition-all duration-200"
                  >
                    Load Scenario
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'teams' && <TeamRecords onApply={props.onApplyTeam} />}

        {tab === 'train' && (
          <TrainingPanel
            training={props.training}
            onPick={props.onPickTraining}
            activeMapId={activeMapId}
            onSelectMap={onSelectMap}
          />
        )}
      </div>
    </aside>
  )
}

export { Layers }
