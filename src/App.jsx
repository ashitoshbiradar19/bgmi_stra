import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Grid3X3,
  Grid2X2,
  Download,
  Share2,
  Undo2,
  Redo2,
  Upload,
  Check,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  X,
  Sparkles,
  Command,
  Save,
  FolderOpen,
  FileUp,
  FileDown,
  Trash2,
  Plus,
  Clock,
  Menu,
  PanelLeftOpen,
  PanelRightOpen,
} from 'lucide-react'
import MapCanvas from './components/MapCanvas'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import { MAPS, MAP_LIST } from './data/maps'
import { generateMap } from './lib/mapGen'
import { STAGE_RADII, containmentViolation } from './lib/render'
import { makeWaterSampler } from './lib/water'
import { buildShareUrl, readShareFromUrl } from './lib/share'
import { getTeam } from './data/teams'
import {
  getAutoSaveState,
  saveAutoSaveState,
  getSavedStrategies,
  saveStrategy,
  deleteSavedStrategy,
  exportStrategyToFile,
  importStrategyFromFile,
} from './lib/storage'

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)

export default function App() {
  const [mapId, setMapId] = useState('erangel')
  const [customImage, setCustomImage] = useState(null)
  const [customName, setCustomName] = useState('Custom')
  const [gridOn, setGridOn] = useState(false)
  const [minorGridOn, setMinorGridOn] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showContours, setShowContours] = useState(false)
  const [showBlueZoneMask, setShowBlueZoneMask] = useState(false)

  const [circles, setCircles] = useState([])
  const [annos, setAnnos] = useState([])
  const [mapsData, setMapsData] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [penColor, setPenColor] = useState('#FBBF24')
  const [layers, setLayers] = useState({ flight: true, brush: true, arrow: true, pin: true, vehicle: true, compound: true, smoke: true })
  const [training, setTraining] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState('zones')
  const [toast, setToast] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [mapMenuOpen, setMapMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [savedModalOpen, setSavedModalOpen] = useState(false)
  const [newStrategyTitle, setNewStrategyTitle] = useState('')
  const [savedStrategiesList, setSavedStrategiesList] = useState(() => getSavedStrategies())
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const exportRef = useRef(() => {})
  const fileRef = useRef(null)
  const importFileRef = useRef(null)
  const mapMenuRef = useRef(null)
  const imageCache = useRef({})
  const samplerCache = useRef({})

  const activeMap = MAPS[mapId] || MAPS.erangel
  const mapSize = customImage ? customImage.size : activeMap.size
  const mapName = customImage ? customName : activeMap.name

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000)
  }, [])

  const [loadedImages, setLoadedImages] = useState({})

  useEffect(() => {
    Object.entries(MAPS).forEach(([id, active]) => {
      if (active.image && !loadedImages[id]) {
        const img = new Image()
        const rawPath = active.image.startsWith('/') ? active.image.slice(1) : active.image
        const baseUrl = import.meta.env.BASE_URL || './'
        const fullPath = baseUrl.endsWith('/') ? `${baseUrl}${rawPath}` : `${baseUrl}/${rawPath}`

        img.src = fullPath
        img.onload = () => {
          setLoadedImages((prev) => ({ ...prev, [id]: img }))
        }
        img.onerror = () => {
          const fallbackImg = new Image()
          fallbackImg.src = `./${rawPath}`
          fallbackImg.onload = () => {
            setLoadedImages((prev) => ({ ...prev, [id]: fallbackImg }))
          }
        }
      }
    })
  }, [loadedImages])

  const mapImage = useMemo(() => {
    if (customImage) return customImage.canvas
    if (loadedImages[mapId]) return loadedImages[mapId]
    if (!imageCache.current[mapId]) imageCache.current[mapId] = generateMap(MAPS[mapId])
    return imageCache.current[mapId]
  }, [mapId, customImage, loadedImages])

  const waterSampler = useMemo(() => {
    if (!mapImage) return () => 0
    const key = customImage ? 'custom' : mapId
    if (!samplerCache.current[key]) samplerCache.current[key] = makeWaterSampler(mapImage, activeMap.theme)
    return samplerCache.current[key]
  }, [mapImage, mapId, customImage, activeMap])

  const pushHistory = useCallback(() => {
    setUndoStack((s) => [...s.slice(-49), { circles, annos }])
    setRedoStack([])
  }, [circles, annos])

  const snapshotNow = () => ({ circles, annos })

  const onUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack
      const prev = stack[stack.length - 1]
      setRedoStack((r) => [...r, snapshotNow()])
      setCircles(prev.circles)
      setAnnos(prev.annos)
      return stack.slice(0, -1)
    })
  }, [circles, annos])

  const onRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (!stack.length) return stack
      const next = stack[stack.length - 1]
      setUndoStack((u) => [...u, snapshotNow()])
      setCircles(next.circles)
      setAnnos(next.annos)
      return stack.slice(0, -1)
    })
  }, [circles, annos])

  // Initial Restorations: Hash Share URL or LocalStorage Auto-Save
  useEffect(() => {
    const s = readShareFromUrl()
    if (s) {
      try {
        if (s.m && MAPS[s.m]) setMapId(s.m)
        else if (s.m === 'custom') setCustomName(s.n || 'Custom')
        if (s.g !== undefined) setGridOn(!!s.g)

        const loadedCircles = (s.c || []).map(([stage, x, y, rVal]) => ({
          id: uid(),
          stage,
          r: typeof rVal === 'number' && rVal > 0 ? rVal : STAGE_RADII[stage - 1] || 100,
          x,
          y,
        }))

        const loadedAnnos = (s.a || []).map((item, i) => {
          if (Array.isArray(item)) {
            // Legacy v1 array format
            const [type, color, points, extra, openFlag, fontSizeVal, teamIdVal, sizeVal, logoUrlVal] = item
            const team = type === 'team' ? getTeam(teamIdVal) : null
            return {
              id: uid() + i,
              type,
              color: type === 'team' ? (team ? team.color : color) : color,
              color2: type === 'team' ? (team ? team.color2 : undefined) : undefined,
              teamId: type === 'team' ? teamIdVal : undefined,
              size: type === 'team' && typeof sizeVal === 'number' ? sizeVal : type === 'team' ? 1 : undefined,
              logoUrl: type === 'team' ? logoUrlVal : undefined,
              label: type === 'team' ? (team ? team.name : extra) : undefined,
              points,
              ...(type !== 'team' && extra !== undefined && extra !== '' ? { label: extra } : {}),
              ...(openFlag === 0 ? { open: false } : type === 'vehicle' ? { open: true } : {}),
              ...(type !== 'team' && typeof fontSizeVal === 'number' ? { fontSize: fontSizeVal } : {}),
            }
          } else {
            // v2 Object format with 100% property retention
            const { t: type, c: color, p: points, l: label, o: openFlag, fs: fontSizeVal, w: widthVal, tid: teamIdVal, sz: sizeVal, url: logoUrlVal } = item
            const team = type === 'team' ? getTeam(teamIdVal) : null
            return {
              id: uid() + i,
              type,
              color: type === 'team' ? (team ? team.color : color) : color,
              color2: type === 'team' ? (team ? team.color2 : undefined) : undefined,
              teamId: type === 'team' ? teamIdVal : undefined,
              size: type === 'team' && typeof sizeVal === 'number' ? sizeVal : type === 'team' ? 1 : undefined,
              logoUrl: type === 'team' ? logoUrlVal : undefined,
              label: type === 'team' ? (team ? team.name : label) : label,
              points,
              ...(openFlag === 0 ? { open: false } : type === 'vehicle' ? { open: true } : {}),
              ...(typeof fontSizeVal === 'number' ? { fontSize: fontSizeVal } : {}),
              ...(typeof widthVal === 'number' ? { width: widthVal } : {}),
            }
          }
        })

        setCircles(loadedCircles)
        setAnnos(loadedAnnos)
        setMapsData((prev) => ({
          ...prev,
          [s.m || 'erangel']: { circles: loadedCircles, annos: loadedAnnos },
        }))
        showToast('Loaded strategy layout from link')
        return
      } catch {
        /* ignore invalid share link */
      }
    }

    // Fallback: Restore from LocalStorage Auto-Save
    const auto = getAutoSaveState()
    if (auto) {
      try {
        if (auto.mapId && MAPS[auto.mapId]) setMapId(auto.mapId)
        if (auto.gridOn !== undefined) setGridOn(auto.gridOn)
        if (auto.penColor) setPenColor(auto.penColor)
        if (auto.mapsData) setMapsData(auto.mapsData)
        if (auto.circles) setCircles(auto.circles)
        if (auto.annos) setAnnos(auto.annos)
      } catch {
        /* ignore auto-save parse error */
      }
    }
  }, [showToast])

  // Continuous Auto-Save to LocalStorage
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveAutoSaveState({
        mapId,
        gridOn,
        penColor,
        circles,
        annos,
        mapsData: {
          ...mapsData,
          [mapId]: { circles, annos },
        },
      })
    }, 300)
    return () => clearTimeout(timeout)
  }, [mapId, gridOn, penColor, circles, annos, mapsData])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? onRedo() : onUndo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        onRedo()
      }
      if (e.key === '?') {
        setHelpOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onUndo, onRedo])

  useEffect(() => {
    if (!mapMenuOpen) return
    const handleClickOutside = (e) => {
      if (mapMenuRef.current && !mapMenuRef.current.contains(e.target)) {
        setMapMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mapMenuOpen])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const snapshotNowRef = useRef(snapshotNow)
  snapshotNowRef.current = snapshotNow

  const addAnno = useCallback((a) => setAnnos((as) => [...as, a]), [])

  const handleColorSelect = useCallback(
    (color) => {
      setPenColor(color)
      if (selectedId) {
        setAnnos((as) => {
          const found = as.find((a) => a.id === selectedId)
          if (found && found.type !== 'team') {
            setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
            setRedoStack([])
            return as.map((a) => (a.id === selectedId ? { ...a, color } : a))
          }
          return as
        })
      }
    },
    [selectedId],
  )

  const updateAnnoFontSize = useCallback((id, fontSize) => {
    setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
    setRedoStack([])
    setAnnos((as) => as.map((a) => (a.id === id ? { ...a, fontSize } : a)))
  }, [])

  const updateAnnoWidth = useCallback((id, width) => {
    setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
    setRedoStack([])
    setAnnos((as) => as.map((a) => (a.id === id ? { ...a, width } : a)))
  }, [])

  const updateAnnoLabel = useCallback((id, label) => {
    setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
    setRedoStack([])
    setAnnos((as) => as.map((a) => (a.id === id ? { ...a, label } : a)))
  }, [])

  const removeAnno = useCallback(
    (id) => {
      setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
      setRedoStack([])
      setAnnos((as) => as.filter((a) => a.id !== id))
      setSelectedId(null)
      showToast('Annotation removed')
    },
    [showToast],
  )

  const updateAnnoPos = useCallback(
    (id, i, x, y) => setAnnos((as) => as.map((a) => (a.id === id ? { ...a, points: a.points.map((p, j) => (j === i ? [x, y] : p)) } : a))),
    [],
  )
  const updateAnno = useCallback(
    (id, points) => setAnnos((as) => as.map((a) => (a.id === id ? { ...a, points } : a))),
    [],
  )

  const updateAnnoField = useCallback((id, patch) => {
    setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
    setRedoStack([])
    setAnnos((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }, [])

  const toggleVehicle = useCallback((id) => {
    setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
    setAnnos((as) => as.map((a) => (a.id === id ? { ...a, open: !a.open } : a)))
  }, [])

  const clearAnnos = useCallback(() => {
    pushHistory()
    setAnnos([])
    setCircles([])
    setMapsData((prev) => ({
      ...prev,
      [mapId]: { circles: [], annos: [] },
    }))
    showToast('Cleared active tactical map layer')
  }, [mapId, pushHistory, showToast])

  const toggleLayer = useCallback((id) => {
    setLayers((l) => ({ ...l, [id]: !l[id] }))
  }, [])

  const visibleAnnos = useMemo(
    () => annos.filter((a) => layers[a.type] !== false),
    [annos, layers],
  )

  const addCircleAt = useCallback(
    (stage, x, y) => {
      setUndoStack((s) => [...s.slice(-49), snapshotNowRef.current()])
      setRedoStack([])
      const c = {
        id: uid(),
        stage,
        r: STAGE_RADII[stage - 1],
        x: x ?? mapSize / 2,
        y: y ?? mapSize / 2,
      }
      setCircles((cs) => [...cs, c])
      setSelectedId(c.id)
      showToast(`Stage ${stage} placed (${STAGE_RADII[stage - 1]}m radius)`)
    },
    [mapSize, showToast],
  )

  const removeCircle = useCallback(
    (id) => {
      pushHistory()
      setCircles((cs) => cs.filter((c) => c.id !== id))
      setSelectedId(null)
      showToast('Zone removed')
    },
    [pushHistory, showToast],
  )

  const updateCircleRadius = useCallback((id, r) => {
    setCircles((cs) => {
      const newR = Math.max(5, Math.round(r))
      const target = cs.find((c) => c.id === id)
      if (!target) return cs.map((c) => (c.id === id ? { ...c, r: newR } : c))

      const sorted = [...cs].sort((a, b) => a.stage - b.stage)
      let result = cs.map((c) => (c.id === id ? { ...c, r: newR } : c))

      const getR = (stage) => result.find((c) => c.stage === stage)?.r

      for (let s = 2; s <= 8; s++) {
        const prevR = getR(s - 1)
        const curR = getR(s)
        if (prevR != null && curR != null && curR > prevR) {
          result = result.map((c) => (c.stage === s ? { ...c, r: prevR } : c))
        }
      }

      const targetUpdated = result.find((c) => c.id === id)
      for (const c of sorted) {
        if (c.stage > target.stage && c.id !== id) {
          if (c.r > targetUpdated.r) {
            result = result.map((rc) => (rc.id === c.id ? { ...rc, r: targetUpdated.r } : rc))
          }
        }
      }

      return result
    })
  }, [])

  const derivedCircles = useMemo(
    () =>
      circles.map((c) => {
        const violating = containmentViolation(c, circles)
        let waterRatio = 0
        let waterWarn = false
        if (!violating && c.stage >= 4 && mapImage) {
          waterRatio = waterSampler(c.x, c.y, c.r, mapSize)
          waterWarn = waterRatio > 0.5
        }
        return { ...c, violating, waterRatio, waterWarn }
      }),
    [circles, mapSize, mapImage, waterSampler],
  )

  const anyBreach = derivedCircles.some((c) => c.violating)
  const anyWater = derivedCircles.some((c) => c.waterWarn && c.waterRatio > 0.5)

  const waterWarnToastRef = useRef(false)
  const breachToastRef = useRef(false)

  useEffect(() => {
    if (anyBreach && !breachToastRef.current) {
      showToast('Invalid Zone Boundary: Stage N+1 extends outside Stage N circle!')
      breachToastRef.current = true
    } else if (!anyBreach) {
      breachToastRef.current = false
    }

    const waterCircle = derivedCircles.find((c) => c.stage >= 4 && c.waterRatio > 0.5)
    if (waterCircle && !waterWarnToastRef.current) {
      showToast(`Water-Lock Warning: Stage ${waterCircle.stage} covers ${Math.round(waterCircle.waterRatio * 100)}% water!`)
      waterWarnToastRef.current = true
    } else if (!waterCircle) {
      waterWarnToastRef.current = false
    }
  }, [anyBreach, derivedCircles, showToast])

  const highlights = useMemo(() => {
    if (!training) return []
    return trainingHighlights(training, mapName)
  }, [training, mapName])

  // Presets load with Auto-Backup
  const onLoadPreset = useCallback(
    (preset) => {
      pushHistory()
      if (circles.length > 0 || annos.length > 0) {
        const backupName = `Backup before ${preset.name} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        const updatedList = saveStrategy(backupName, { mapId, circles, annos })
        setSavedStrategiesList(updatedList)
      }
      const targetMap = preset.mapId || mapId
      if (preset.mapId && MAPS[preset.mapId]) {
        setMapId(preset.mapId)
        setCustomImage(null)
      }
      const newCircles = preset.circles
        ? preset.circles.map(({ stage, x, y }) => ({
            id: uid(),
            stage,
            r: STAGE_RADII[stage - 1],
            x,
            y,
          }))
        : []

      const newAnnos = []
      if (preset.flight) {
        newAnnos.push({
          id: uid(),
          type: 'flight',
          color: '#38bdf8',
          points: preset.flight,
        })
      }
      if (preset.pins) {
        preset.pins.forEach((p, i) => {
          newAnnos.push({
            id: uid() + i,
            type: 'pin',
            color: '#f97316',
            label: p.label || `P${i + 1}`,
            points: [[p.x, p.y]],
          })
        })
      }
      setCircles(newCircles)
      setAnnos(newAnnos)
      setMapsData((prev) => ({
        ...prev,
        [targetMap]: { circles: newCircles, annos: newAnnos },
      }))
      showToast(`Loaded scenario: ${preset.name}`)
    },
    [circles, annos, mapId, pushHistory, showToast],
  )

  const shareState = useCallback(() => {
    const url = buildShareUrl({
      v: 2,
      m: customImage ? 'custom' : mapId,
      g: gridOn ? 1 : 0,
      n: customImage ? customName : undefined,
      c: circles.map(({ stage, x, y, r }) => [
        +stage.toFixed(0),
        Math.round(x),
        Math.round(y),
        Math.round(r || STAGE_RADII[stage - 1] || 100),
      ]),
      a: annos
        .filter((a) => !a.hidden)
        .map((a) => ({
          t: a.type,
          c: a.color,
          p: a.points.map((pt) => [Math.round(pt[0]), Math.round(pt[1])]),
          l: a.label || undefined,
          o: a.open === false ? 0 : undefined,
          fs: a.fontSize || undefined,
          w: a.width || undefined,
          tid: a.teamId || undefined,
          sz: a.size || undefined,
          url: a.logoUrl || undefined,
        })),
    })
    if (!url) return
    history.replaceState(null, '', url)
    navigator.clipboard?.writeText(url).then(
      () => showToast('Strategy link copied to clipboard'),
      () => showToast('Strategy link updated in URL bar'),
    )
  }, [mapId, customImage, customName, gridOn, circles, annos, showToast])

  const onUploadFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 2048
      cv.getContext('2d').drawImage(img, 0, 0, 2048, 2048)
      setCustomImage({ canvas: cv, size: Math.min(img.width, img.height) })
      setCustomName(file.name.replace(/\.[^.]+$/, '').slice(0, 18))
      setMapMenuOpen(false)
      showToast(`Loaded ${file.name} map image`)
    }
    img.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  // Map Switcher preserving per-map drawings
  const selectMap = (newMapId) => {
    if (newMapId === mapId && !customImage) {
      setMapMenuOpen(false)
      return
    }

    setMapsData((prev) => {
      const updated = { ...prev, [mapId]: { circles, annos } }
      const nextData = updated[newMapId] || { circles: [], annos: [] }
      setCircles(nextData.circles || [])
      setAnnos(nextData.annos || [])
      return updated
    })

    setCustomImage(null)
    setMapId(newMapId)
    setSelectedId(null)
    setMapMenuOpen(false)
    const name = (MAPS[newMapId] || {}).name || newMapId
    showToast(`Switched map to ${name}`)
  }

  // Strategy Saving & Storage Handlers
  const handleSaveCurrentStrategy = () => {
    const title = newStrategyTitle.trim() || `${mapName} Strategy ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    const updated = saveStrategy(title, { mapId, circles, annos })
    setSavedStrategiesList(updated)
    setNewStrategyTitle('')
    showToast(`Saved "${title}" to local boards`)
  }

  const handleLoadSavedStrategy = (strat) => {
    pushHistory()
    if (strat.mapId && MAPS[strat.mapId]) {
      setMapId(strat.mapId)
      setCustomImage(null)
    }
    const restoredCircles = strat.circles || []
    const restoredAnnos = strat.annos || []
    setCircles(restoredCircles)
    setAnnos(restoredAnnos)
    setMapsData((prev) => ({
      ...prev,
      [strat.mapId || mapId]: { circles: restoredCircles, annos: restoredAnnos },
    }))
    setSavedModalOpen(false)
    showToast(`Loaded strategy board: ${strat.name}`)
  }

  const handleDeleteSavedStrategy = (id, name) => {
    const updated = deleteSavedStrategy(id)
    setSavedStrategiesList(updated)
    showToast(`Deleted strategy: ${name}`)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importStrategyFromFile(file)
      pushHistory()
      if (data.mapId && MAPS[data.mapId]) {
        setMapId(data.mapId)
      }
      const impCircles = data.circles || []
      const impAnnos = data.annos || []
      setCircles(impCircles)
      setAnnos(impAnnos)
      showToast(`Imported strategy file: ${file.name}`)
    } catch (err) {
      showToast('Error importing file: Invalid format')
    }
    e.target.value = ''
  }

  return (
    <div className="flex h-full flex-col bg-[#060910] bg-tactical-grid text-slate-100 font-sans select-none overflow-hidden">
      {/* ================= Header Navbar ================= */}
      <header className="flex shrink-0 items-center gap-1.5 sm:gap-2 border-b border-slate-800/60 bg-[#0B1120]/95 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur-2xl z-30">
        {/* Mobile: Sidebar Toggle */}
        {isMobile && (
          <button
            onClick={() => { setMobileSidebarOpen((o) => !o); setMobilePanelOpen(false) }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 active:scale-95 min-h-[44px] min-w-[44px]"
            title="Toggle Sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 pr-1 sm:pr-2">
          <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 font-black text-slate-950 text-xs sm:text-sm shadow-[0_0_24px_rgba(251,191,36,0.3)] transition-shadow hover:shadow-[0_0_32px_rgba(251,191,36,0.5)]">
            B
            <div className="absolute -inset-0.5 rounded-[11px] bg-gradient-to-br from-amber-400/20 to-yellow-400/20 blur-sm -z-10" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-[13px] font-extrabold tracking-tight text-white">
              BGMI <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Tactical</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Strategy Engine</div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block h-6 w-px bg-slate-700/50 mx-1" />

        {/* Map Selector */}
        <div className="relative ml-0.5" ref={mapMenuRef}>
          <button
            onClick={() => setMapMenuOpen((o) => !o)}
            className="flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-700/60 bg-slate-800/50 px-2.5 sm:px-3.5 text-[10px] sm:text-[11px] font-bold text-slate-100 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/80 active:scale-[0.98] min-h-[44px]"
            aria-expanded={mapMenuOpen}
            aria-haspopup="true"
          >
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            <span className="max-w-[70px] sm:max-w-[100px] truncate">{mapName}</span>
            <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ${mapMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {mapMenuOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-700/60 bg-[#090E1A] shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-slide-down">
              <div className="px-4 py-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/60">
                Select Map
              </div>
              <div className="p-1.5">
                {MAP_LIST.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectMap(m.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-[11px] font-semibold transition-all duration-150 ${
                      !customImage && mapId === m.id
                        ? 'bg-amber-400/10 text-amber-300 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold">{m.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{m.size / 1000}×{m.size / 1000}km</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-800/60 p-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-[11px] font-bold text-amber-400 transition-colors hover:bg-amber-400/10 active:scale-[0.98]"
                >
                  <Upload size={14} /> Upload Custom Map
                </button>
                {customImage && (
                  <button
                    onClick={() => setCustomImage(null)}
                    className="w-full rounded-xl px-3.5 py-2 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-colors"
                  >
                    Clear custom map
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onUploadFile} />

        {/* Grid & Mask Toggles - hidden on very small screens, shown in overflow menu */}
        <div className="hidden sm:flex ml-1 items-center gap-1">
          {[
            { on: gridOn, toggle: () => setGridOn((g) => !g), icon: Grid3X3, label: '1km', title: 'Toggle 1km Major Grid' },
            { on: minorGridOn, toggle: () => setMinorGridOn((g) => !g), icon: Grid2X2, label: '100m', title: 'Toggle 100m Minor Grid' },
            { on: showBlueZoneMask, toggle: () => setShowBlueZoneMask((m) => !m), icon: ShieldAlert, label: 'Blue Zone', title: 'Inverted Blue Zone Masking' },
          ].map((item) => (
            <button
              key={item.title}
              onClick={item.toggle}
              title={item.title}
              className={`flex h-9 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-xl border px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold transition-all duration-200 active:scale-[0.96] min-h-[44px] ${
                item.on
                  ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
                  : 'border-slate-700/40 bg-slate-800/30 text-slate-500 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              <item.icon size={14} className={item.on ? 'text-amber-400' : ''} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="ml-auto flex items-center gap-1">
          {/* Undo/Redo - icon only on mobile */}
          <button
            onClick={onUndo}
            disabled={!undoStack.length}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 enabled:hover:border-slate-600 enabled:hover:text-slate-200 disabled:opacity-25 active:scale-95 min-h-[44px] min-w-[44px]"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={onRedo}
            disabled={!redoStack.length}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 enabled:hover:border-slate-600 enabled:hover:text-slate-200 disabled:opacity-25 active:scale-95 min-h-[44px] min-w-[44px]"
          >
            <Redo2 size={14} />
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-700/40 mx-1" />

          {/* Strategy Manager Button */}
          <button
            onClick={() => setSavedModalOpen(true)}
            className="hidden sm:flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-2.5 sm:px-3.5 text-[10px] sm:text-[11px] font-bold text-cyan-300 transition-all duration-200 hover:bg-cyan-500/20 active:scale-95 min-h-[44px]"
            title="Saved Boards & Strategy Management"
          >
            <FolderOpen size={14} className="text-cyan-400" />
            <span className="hidden md:inline">Saved Boards</span>
            {savedStrategiesList.length > 0 && (
              <span className="ml-0.5 rounded-full bg-cyan-400 px-1.5 py-0.2 font-mono text-[9px] font-extrabold text-slate-950">
                {savedStrategiesList.length}
              </span>
            )}
          </button>
          {/* Mobile: compact saved boards button */}
          <button
            onClick={() => setSavedModalOpen(true)}
            className="sm:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 min-h-[44px] min-w-[44px]"
            title="Saved Boards"
          >
            <FolderOpen size={14} />
          </button>

          <button
            onClick={() => setHelpOpen(true)}
            className="hidden sm:flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 hover:border-slate-600 hover:text-slate-200 active:scale-95 min-h-[44px] min-w-[44px]"
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Command size={15} />
          </button>

          <button
            onClick={shareState}
            className="hidden md:flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-slate-700/40 bg-slate-800/30 px-2.5 sm:px-3.5 text-[10px] sm:text-[11px] font-bold text-slate-300 transition-all duration-200 hover:border-slate-600 hover:text-white active:scale-95 min-h-[44px]"
          >
            <Share2 size={14} /> Share
          </button>

          <button
            onClick={() => exportRef.current?.()}
            className="flex h-9 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-2.5 sm:px-4 text-[10px] sm:text-[11px] font-extrabold text-slate-950 shadow-[0_2px_12px_rgba(251,191,36,0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(251,191,36,0.35)] hover:scale-[1.02] active:scale-95 min-h-[44px]"
          >
            <Download size={13} /> <span className="hidden sm:inline">Export</span>
          </button>

          {/* Mobile: Panel Toggle */}
          {isMobile && (
            <button
              onClick={() => { setMobilePanelOpen((o) => !o); setMobileSidebarOpen(false) }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 active:scale-95 min-h-[44px] min-w-[44px]"
              title="Toggle Tools Panel"
            >
              <PanelRightOpen size={16} />
            </button>
          )}
        </div>
      </header>

      {/* ================= Warning Banner ================= */}
      {(anyBreach || anyWater) && (
        <div
          className={`flex shrink-0 items-center justify-center gap-2.5 border-b px-4 py-2.5 text-[11px] font-bold ${
            anyBreach
              ? 'border-red-500/50 bg-red-500/10 text-red-300'
              : 'border-amber-500/30 bg-amber-500/8 text-amber-300'
          }`}
        >
          {anyBreach ? <ShieldAlert size={15} className="text-red-400" /> : <AlertTriangle size={15} className="text-amber-400" />}
          <span>
            {anyBreach
              ? 'Invalid Zone Boundary — Stage N+1 extends outside Stage N!'
              : `Water-Lock Warning: Late-game zone covers >50% water!`}
          </span>
        </div>
      )}

      {/* ================= Main Content Body ================= */}
      <div className="flex min-h-0 flex-1 relative">
        {/* Desktop: Sidebar always visible */}
        {!isMobile && (
          <Sidebar
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            tab={tab}
            setTab={setTab}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            penColor={penColor}
            setPenColor={setPenColor}
            layers={layers}
            toggleLayer={toggleLayer}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={!!undoStack.length}
            canRedo={!!redoStack.length}
            clearAnnos={clearAnnos}
            training={training}
            onPickTraining={(id) => setTraining((t) => (t === id ? null : id))}
            onApplyTeam={(team) => {
              pushHistory()
              const teamAnno = {
                id: uid(),
                type: 'text',
                color: team.color,
                label: team.name,
                fontSize: 22,
                points: [[0, 0]],
              }
              setAnnos((as) => [...as, teamAnno])
              showToast(`Applied ${team.name} to map`)
            }}
            circles={circles}
            derivedCircles={derivedCircles}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            addCircleAt={addCircleAt}
            removeCircle={removeCircle}
            updateCircleRadius={updateCircleRadius}
            onLoadPreset={onLoadPreset}
            activeMapId={mapId}
            onSelectMap={selectMap}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            showContours={showContours}
            setShowContours={setShowContours}
            showBlueZoneMask={showBlueZoneMask}
            setShowBlueZoneMask={setShowBlueZoneMask}
            handleColorSelect={handleColorSelect}
            updateAnnoFontSize={updateAnnoFontSize}
            updateAnnoWidth={updateAnnoWidth}
            updateAnnoLabel={updateAnnoLabel}
            removeAnno={removeAnno}
            annos={annos}
          />
        )}

        {/* Mobile: Sidebar overlay */}
        {isMobile && mobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px] animate-slide-right">
              <Sidebar
                collapsed={false}
                setCollapsed={() => setMobileSidebarOpen(false)}
                tab={tab}
                setTab={setTab}
                activeTool={activeTool}
                setActiveTool={(t) => { setActiveTool(t); setMobileSidebarOpen(false) }}
                penColor={penColor}
                setPenColor={setPenColor}
                layers={layers}
                toggleLayer={toggleLayer}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={!!undoStack.length}
                canRedo={!!redoStack.length}
                clearAnnos={clearAnnos}
                training={training}
                onPickTraining={(id) => setTraining((t) => (t === id ? null : id))}
                onApplyTeam={(team) => {
                  pushHistory()
                  const teamAnno = {
                    id: uid(),
                    type: 'text',
                    color: team.color,
                    label: team.name,
                    fontSize: 22,
                    points: [[0, 0]],
                  }
                  setAnnos((as) => [...as, teamAnno])
                  showToast(`Applied ${team.name} to map`)
                }}
                circles={circles}
                derivedCircles={derivedCircles}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                addCircleAt={addCircleAt}
                removeCircle={removeCircle}
                updateCircleRadius={updateCircleRadius}
                onLoadPreset={onLoadPreset}
                activeMapId={mapId}
                onSelectMap={selectMap}
                showHeatmap={showHeatmap}
                setShowHeatmap={setShowHeatmap}
                showContours={showContours}
                setShowContours={setShowContours}
                showBlueZoneMask={showBlueZoneMask}
                setShowBlueZoneMask={setShowBlueZoneMask}
                handleColorSelect={handleColorSelect}
                updateAnnoFontSize={updateAnnoFontSize}
                updateAnnoWidth={updateAnnoWidth}
                updateAnnoLabel={updateAnnoLabel}
                removeAnno={removeAnno}
                annos={annos}
              />
            </div>
          </>
        )}

        <main className="relative min-w-0 flex-1">
          <MapCanvas
            mapImage={mapImage}
            mapSize={mapSize}
            mapName={mapName}
            mapId={mapId}
            showHeatmap={showHeatmap}
            showContours={showContours}
            showBlueZoneMask={showBlueZoneMask}
            gridOn={gridOn}
            minorGridOn={minorGridOn}
            highlights={highlights}
            circles={derivedCircles}
            setCircles={setCircles}
            updateCircleRadius={updateCircleRadius}
            annos={visibleAnnos}
            allAnnos={annos}
            addAnno={addAnno}
            updateAnnoPos={updateAnnoPos}
            updateAnno={updateAnno}
            updateAnnoField={updateAnnoField}
            toggleVehicle={toggleVehicle}
            pushHistory={pushHistory}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            penColor={penColor}
            handleColorSelect={handleColorSelect}
            updateAnnoFontSize={updateAnnoFontSize}
            updateAnnoWidth={updateAnnoWidth}
            updateAnnoLabel={updateAnnoLabel}
            removeAnno={removeAnno}
            exportRef={exportRef}
            addCircleAt={addCircleAt}
            isMobile={isMobile}
            mobilePanelOpen={mobilePanelOpen}
            setMobilePanelOpen={setMobilePanelOpen}
          />
        </main>
      </div>

      {/* ================= Footer Bar ================= */}
      <Footer />

      {/* ================= Saved Strategy Manager Modal ================= */}
      {savedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setSavedModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[580px] max-w-[94vw] max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-cyan-500/30 bg-[#090E1A] shadow-[0_24px_64px_rgba(0,0,0,0.7)] animate-slide-up sm:animate-scale-in overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Strategy Management"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 bg-[#0D1525]">
              <div className="flex items-center gap-2.5 text-sm font-extrabold text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                  <FolderOpen size={16} />
                </div>
                Saved Strategy Boards &amp; Backups
              </div>
              <button
                onClick={() => setSavedModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Save Current Board Form */}
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Save size={14} /> Save Current Map Strategy
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStrategyTitle}
                    onChange={(e) => setNewStrategyTitle(e.target.value)}
                    placeholder={`e.g., ${mapName} Stage 5 Choke Hold...`}
                    className="flex-1 rounded-xl border border-slate-700/60 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveCurrentStrategy}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 active:scale-95 transition-all"
                  >
                    <Plus size={14} /> Save
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Saves active map zones ({circles.length}) and annotations ({annos.length}) to local storage.
                </p>
              </div>

              {/* Import & Export JSON Tools */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition-all"
                >
                  <FileUp size={14} className="text-cyan-400" /> Import JSON File
                </button>
                <button
                  onClick={() =>
                    exportStrategyToFile({
                      name: `${mapName} Tactical Board`,
                      mapId,
                      circles,
                      annos,
                      exportedAt: new Date().toISOString(),
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition-all"
                >
                  <FileDown size={14} className="text-amber-400" /> Export JSON File
                </button>
                <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              </div>

              {/* Saved Boards List */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                  Saved Boards ({savedStrategiesList.length})
                </div>
                {savedStrategiesList.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/40 bg-slate-950/40 p-6 text-center text-xs text-slate-500">
                    No saved boards yet. Use "Save" above to bookmark your tactical setups.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {savedStrategiesList.map((strat) => (
                      <div
                        key={strat.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 px-3.5 py-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="text-xs font-bold text-white truncate">{strat.name}</div>
                          <div className="flex items-center gap-2.5 mt-1 font-mono text-[10px] text-slate-500">
                            <span className="uppercase text-amber-400 font-extrabold">{strat.mapId || 'erangel'}</span>
                            <span>· {strat.circles?.length || 0} zones</span>
                            <span>· {strat.annos?.length || 0} items</span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Clock size={10} />
                              {new Date(strat.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleLoadSavedStrategy(strat)}
                            className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[11px] font-extrabold text-cyan-300 hover:bg-cyan-500/25 active:scale-95 transition-all"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => exportStrategyToFile(strat)}
                            title="Export Strategy File"
                            className="rounded-lg border border-slate-800/60 bg-slate-800/40 p-1.5 text-slate-400 hover:text-white transition-colors"
                          >
                            <FileDown size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSavedStrategy(strat.id, strat.name)}
                            title="Delete"
                            className="rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-400 hover:bg-red-500/15 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setHelpOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[460px] max-w-[92vw] rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-[#0B1120] shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-slide-up sm:animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard Shortcuts"
          >
            <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
              <div className="flex items-center gap-2.5 text-sm font-extrabold text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Command size={16} />
                </div>
                Keyboard Shortcuts
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['V', 'Select / Pan Mode'],
                  ['P', 'Drop Pin'],
                  ['B', 'Freehand Brush'],
                  ['L', 'Straight Line'],
                  ['A', 'Attack Arrow'],
                  ['F', 'Flight Path'],
                  ['G', 'Vehicle Toggle'],
                  ['C', 'Compound Bounds'],
                  ['T', 'Text Note'],
                  ['Esc', 'Cancel / Reset'],
                  ['Ctrl+Z', 'Undo'],
                  ['Ctrl+Y', 'Redo'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2">
                    <span className="text-[11px] font-semibold text-slate-400">{desc}</span>
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400 border border-slate-700/50">
                      {key}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="mt-5 w-full rounded-xl bg-cyan-500 py-2.5 text-[11px] font-extrabold text-slate-950 transition-all hover:bg-cyan-400 active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-slate-700/50 bg-[#0B1120]/95 px-4 py-2.5 text-[11px] font-bold text-slate-200 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-toast-in">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
            <Check size={12} className="text-emerald-400" />
          </div>
          {toast}
        </div>
      )}
    </div>
  )
}

function trainingHighlights(trainingId, mapName) {
  const SPOTS = {
    close: [
      ['Sanhok', 'Boot Camp', 2250, 1500],
      ['Erangel', 'Pochinki', 4400, 3700],
      ['Erangel', 'School', 3900, 4300],
    ],
    long: [
      ['Miramar', 'Pecado Ridge', 2700, 2400],
      ['Miramar', 'Chumacera Ridges', 4950, 2550],
      ['Rondo', "Dragon's Backbone", 5000, 5800],
      ['Rondo', 'Lantern Wharf Sightlines', 5500, 3300],
    ],
    rotation: [
      ['Erangel', 'South Bridge Hold', 3450, 7050],
      ['Erangel', 'East Bridge Hold', 4900, 6700],
      ['Miramar', 'Torre Ahumada Ridge', 5600, 5450],
    ],
  }
  return (SPOTS[trainingId] || [])
    .filter(([m]) => m.toLowerCase() === mapName.toLowerCase())
    .map(([, name, x, y]) => ({ name, x, y }))
}
