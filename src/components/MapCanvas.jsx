import { useCallback, useEffect, useRef, useState } from 'react'
import { computeView, renderScene } from '../lib/render'
import { Plus, Minus, RotateCcw, MousePointer2, PenLine, MoveUpRight, MapPin, Plane, Car, Home, Type, Cloud, Compass, Trash2, X, Sparkles, Shield, Search, PanelRightClose } from 'lucide-react'
import { TEAMS } from '../data/teams'

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const screenToWorldRaw = (sx, sy, v) => [(sx - v.ox) / (v.ppm * v.zoom), (sy - v.oy) / (v.ppm * v.zoom)]

function distToSegment(px, py, vx, vy, wx, wy) {
  const l2 = (wx - vx) ** 2 + (wy - vy) ** 2
  if (l2 === 0) return Math.hypot(px - vx, py - vy)
  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (vx + t * (wx - vx)), py - (vy + t * (wy - vy)))
}

import { COLOR_PRESETS, FONT_PRESETS, STROKE_WIDTH_PRESETS } from '../data/colors'

function tempAnno(it, penColor) {
  if (!it) return null
  if (it.mode === 'stroke' && it.pts && it.pts.length > 0)
    return { id: '_t', type: 'brush', color: penColor, points: it.pts }
  if (it.mode === 'seg') return { id: '_t', type: it.kind, color: penColor, points: [it.start, it.end || it.start] }
  if (it.mode === 'compound')
    return { id: '_t', type: 'compound', color: '#f97316', points: [it.start, it.end || it.start] }
  if ((it.mode === 'flight' || it.mode === 'flight1' || it.mode === 'flight2') && it.start) {
    const color = it.mode === 'flight2' ? '#a855f7' : '#38bdf8'
    return { id: '_t', type: it.mode, color, points: [it.start, it.end || it.start] }
  }
  return null
}

export default function MapCanvas(props) {
  const {
    mapImage,
    mapSize,
    mapName,
    gridOn,
    minorGridOn,
    highlights,
    circles,
    setCircles,
    annos,
    allAnnos,
    addAnno,
    updateAnnoPos,
    updateAnno,
    updateAnnoField,
    pushHistory,
    selectedId,
    setSelectedId,
    activeTool,
    setActiveTool,
    penColor,
    handleColorSelect,
    updateAnnoFontSize,
    updateAnnoWidth,
    updateAnnoLabel,
    removeAnno,
    exportRef,
    addCircleAt,
    isMobile,
    mobilePanelOpen,
    setMobilePanelOpen,
  } = props

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const coordRef = useRef(null)
  const viewRef = useRef({ ppm: 1, zoom: 1, ox: 0, oy: 0 })
  const sizeRef = useRef({ w: 800, h: 600 })
  const interRef = useRef({ mode: null })
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const [textModal, setTextModal] = useState(null)
  const [teamQuery, setTeamQuery] = useState('')
  const rafRef = useRef(null)
  const dirtyRef = useRef(true)

  // Trigger demand-driven render
  const requestRender = useCallback(() => {
    dirtyRef.current = true
  }, [])

  // Resizing & view calculation
  useEffect(() => {
    const wrap = wrapRef.current
    const cvs = canvasRef.current
    if (!wrap || !cvs) return
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      const dpr = window.devicePixelRatio || 1
      const prev = viewRef.current
      const center = screenToWorldRaw(sizeRef.current.w / 2, sizeRef.current.h / 2, prev)
      sizeRef.current = { w: r.width, h: r.height }
      cvs.width = Math.round(r.width * dpr)
      cvs.height = Math.round(r.height * dpr)
      cvs.style.width = r.width + 'px'
      cvs.style.height = r.height + 'px'
      const nv = computeView(r.width, r.height, mapSize, prev.zoom || 1)
      nv.ox = r.width / 2 - center[0] * nv.ppm * nv.zoom
      nv.oy = r.height / 2 - center[1] * nv.ppm * nv.zoom
      viewRef.current = nv
      requestRender()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [mapSize, requestRender])

  useEffect(() => {
    const { w, h } = sizeRef.current
    viewRef.current = computeView(w, h, mapSize, 1)
    interRef.current = { mode: null }
    requestRender()
  }, [mapSize, requestRender])

  // Trigger render on prop updates
  useEffect(() => {
    requestRender()
  }, [mapImage, circles, annos, highlights, selectedId, gridOn, minorGridOn, penColor, activeTool, props.showHeatmap, props.showContours, props.showBlueZoneMask, requestRender])

  // Demand-Driven Render Loop
  useEffect(() => {
    let active = true
    const loop = (timestamp) => {
      if (!active) return
      const cvs = canvasRef.current
      if (cvs && cvs.width > 0 && dirtyRef.current) {
        dirtyRef.current = false
        const ctx = cvs.getContext('2d')
        const dpr = window.devicePixelRatio || 1
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const { w, h } = sizeRef.current
        const p = propsRef.current
        renderScene(ctx, w, h, {
          mapSize: p.mapSize,
          image: p.mapImage,
          gridOn: p.gridOn,
          minorGridOn: p.minorGridOn,
          circles: p.circles,
          annos: p.annos,
          highlights: p.highlights,
          selectedId: p.selectedId,
          mapId: p.mapId || 'erangel',
          showHeatmap: p.showHeatmap ?? true,
          showContours: p.showContours ?? false,
          showBlueZoneMask: p.showBlueZoneMask ?? true,
          view: viewRef.current,
          temp: tempAnno(interRef.current, p.penColor),
          t: timestamp,
          viewportWidth: w,
          exportScaleFactor: 1.0,
        })
      }
      // If actively interacting or animating highlights, keep scheduling RAF
      if (interRef.current?.mode || (propsRef.current.highlights && propsRef.current.highlights.length > 0)) {
        dirtyRef.current = true
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // PNG Exporter — matches the on-screen rendering exactly (WYSIWYG).
  useEffect(() => {
    exportRef.current = () => {
      const p = propsRef.current
      const vw = sizeRef.current.w || 800
      const vh = sizeRef.current.h || 800
      const bw = Math.round(110) // banner height at on-screen scale
      const exportScaleFactor = 1

      const off = document.createElement('canvas')
      off.width = vw
      off.height = vw + bw
      const ctx = off.getContext('2d')
      const view = computeView(vw, vw, mapSize, 1)

      // Screen-matching render so the logo and all elements keep the
      // same pixel size as they appear on the website (exportScaleFactor = 1).
      renderScene(ctx, vw, vw, {
        mapSize: p.mapSize,
        image: p.mapImage,
        gridOn: p.gridOn,
        minorGridOn: false,
        circles: p.circles,
        annos: p.annos.filter((a) => !a.hidden),
        highlights: [],
        selectedId: null,
        showHeatmap: p.showHeatmap ?? true,
        showContours: p.showContours ?? false,
        showBlueZoneMask: p.showBlueZoneMask ?? true,
        view,
        t: performance.now(),
        viewportWidth: vw,
        exportScaleFactor,
      })

      // Draw bottom banner below the map canvas
      ctx.fillStyle = 'rgba(7, 10, 15, 0.96)'
      ctx.fillRect(0, vw, vw, bw)
      ctx.strokeStyle = '#00e5ff'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(0, vw)
      ctx.lineTo(vw, vw)
      ctx.stroke()

      // Left: Map Title
      ctx.font = `900 ${Math.round(34)}px Inter, system-ui, sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(`${p.mapName.toUpperCase()} MAP`, 36, vw + bw / 2 - 4)

      // Left Subtitle
      ctx.font = `700 ${Math.round(20)}px Inter, system-ui, sans-serif`
      ctx.fillStyle = '#FBBF24'
      ctx.fillText(`Analysed by Ashitosh S. Biradar`, 36, vw + bw / 2 + 28)

      // Right: Tactical Details & Zone Count
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
      ctx.font = `700 ${Math.round(18)}px Inter, sans-serif`
      ctx.fillText(`BGMI Tactical Board · ${p.circles.length} Zones Placed`, vw - 36, vw + bw / 2 + 10)

      off.toBlob((b) => {
        if (!b) return
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = `${p.mapName.toLowerCase().replace(/\s+/g, '-')}-tactical-strategy.png`
        a.click()
        URL.revokeObjectURL(url)
        // Clean up offscreen canvas memory
        off.width = off.height = 0
      })
    }
  })

  const toWorld = useCallback((e) => {
    if (!canvasRef.current) return [0, 0]
    const rect = canvasRef.current.getBoundingClientRect()
    return screenToWorldRaw(e.clientX - rect.left, e.clientY - rect.top, viewRef.current)
  }, [])

  const hitCircle = (wx, wy, cs) => {
    const v = viewRef.current
    const minR = 14 / (v.ppm * v.zoom)
    const sorted = [...cs].sort((a, b) => a.r - b.r)
    for (const c of sorted) {
      if (Math.hypot(wx - c.x, wy - c.y) <= Math.max(c.r, minR)) return c
    }
    return null
  }

  const hitPointAnno = (wx, wy, list) => {
    const v = viewRef.current
    const ppmZ = v.ppm * v.zoom
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]
      if (a.type !== 'pin' && a.type !== 'vehicle' && a.type !== 'team' && a.type !== 'text') continue
      const [px, py] = a.points[0]
      if (a.type === 'text') {
        const fs = (a.fontSize || 16) / ppmZ
        const textLen = (a.label || 'Note').length
        const halfW = Math.max(24 / ppmZ, (textLen * fs * 0.35))
        const halfH = Math.max(16 / ppmZ, fs * 0.7)
        if (Math.abs(wx - px) <= halfW + 12 / ppmZ && Math.abs(wy - py) <= halfH + 12 / ppmZ) {
          return a
        }
      } else {
        const tol = a.type === 'team' ? 46 / ppmZ : 30 / ppmZ
        if (Math.hypot(wx - px, wy - py) <= tol) return a
      }
    }
    return null
  }

  const hitLineAnno = (wx, wy, list) => {
    const v = viewRef.current
    const tol = 24 / (v.ppm * v.zoom)
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]
      if (a.type !== 'arrow' && a.type !== 'line' && a.type !== 'brush' && a.type !== 'ridge' && a.type !== 'flight' && a.type !== 'flight1' && a.type !== 'flight2' && a.type !== 'smoke') continue
      const pts = a.points
      if (!pts || pts.length < 2) continue
      for (let j = 0; j < pts.length - 1; j++) {
        const [v0x, v0y] = pts[j]
        const [v1x, v1y] = pts[j + 1]
        if (distToSegment(wx, wy, v0x, v0y, v1x, v1y) <= tol) return a
      }
    }
    return null
  }

  const hitCompound = (wx, wy, list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]
      if (a.type !== 'compound') continue
      const [p0, p1] = a.points
      if (
        wx >= Math.min(p0[0], p1[0]) &&
        wx <= Math.max(p0[0], p1[0]) &&
        wy >= Math.min(p0[1], p1[1]) &&
        wy <= Math.max(p0[1], p1[1])
      )
        return a
    }
    return null
  }

  // Pointer & Touch Handlers
  const onPointerDown = (e) => {
    if (e.cancelable) e.preventDefault()
    if (canvasRef.current) canvasRef.current.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom }
      interRef.current = { mode: null }
      requestRender()
      return
    }
    if (pointersRef.current.size > 2) return

    const [wx, wy] = toWorld(e)
    const { activeTool: tool, circles: cs, annos: as, penColor: pc, addAnno: add } = propsRef.current

    if (tool === 'select') {
      const hitPt = hitPointAnno(wx, wy, as)
      if (hitPt) {
        propsRef.current.setSelectedId(hitPt.id)
        if (hitPt.type === 'vehicle') {
          interRef.current = { mode: 'maybe-toggle', id: hitPt.id, sx: e.clientX, sy: e.clientY }
        } else if (hitPt.type === 'text') {
          interRef.current = {
            mode: 'drag-text',
            id: hitPt.id,
            dx: wx - hitPt.points[0][0],
            dy: wy - hitPt.points[0][1],
            moved: false,
          }
        } else {
          interRef.current = { mode: 'drag-pin', id: hitPt.id, dx: wx - hitPt.points[0][0], dy: wy - hitPt.points[0][1], moved: false }
        }
        requestRender()
        return
      }

      const hitLn = hitLineAnno(wx, wy, as)
      if (hitLn) {
        propsRef.current.setSelectedId(hitLn.id)
        interRef.current = {
          mode: 'drag-line',
          id: hitLn.id,
          origPoints: hitLn.points.map((p) => [...p]),
          startWorld: [wx, wy],
          moved: false,
        }
        requestRender()
        return
      }

      const comp = hitCompound(wx, wy, as)
      if (comp) {
        propsRef.current.setSelectedId(comp.id)
        interRef.current = {
          mode: 'drag-compound',
          id: comp.id,
          dx: wx - Math.min(comp.points[0][0], comp.points[1][0]),
          dy: wy - Math.min(comp.points[0][1], comp.points[1][1]),
          moved: false,
        }
        requestRender()
        return
      }

      const c = hitCircle(wx, wy, cs)
      if (c) {
        propsRef.current.setSelectedId(c.id)
        interRef.current = { mode: 'drag-circle', id: c.id, dx: wx - c.x, dy: wy - c.y, moved: false }
        requestRender()
        return
      }

      propsRef.current.setSelectedId(null)
      interRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: viewRef.current.ox, oy: viewRef.current.oy }
      requestRender()
      return
    }

    if (tool === 'pin') {
      const label = 'Pin ' + String(as.filter((a) => a.type === 'pin').length + 1)
      add({ id: uid(), type: 'pin', color: pc, label, points: [[wx, wy]] })
      pushHistory()
      requestRender()
      return
    }

    if (tool === 'smoke') {
      add({ id: uid(), type: 'smoke', color: '#cbd5e1', points: [[wx, wy]] })
      pushHistory()
      requestRender()
      return
    }

    if (tool === 'text') {
      const hitPt = hitPointAnno(wx, wy, as)
      if (hitPt && hitPt.type === 'text') {
        propsRef.current.setSelectedId(hitPt.id)
        setTextModal({
          id: hitPt.id,
          isEditing: true,
          x: hitPt.points[0][0],
          y: hitPt.points[0][1],
          color: hitPt.color,
          fontSize: hitPt.fontSize || 20,
          label: hitPt.label || '',
        })
        return
      }
      setTextModal({ x: wx, y: wy, color: pc, fontSize: 20, label: '' })
      return
    }

    if (tool === 'vehicle') {
      add({ id: uid(), type: 'vehicle', color: pc, open: true, points: [[wx, wy]] })
      pushHistory()
      requestRender()
      return
    }

    if (tool === 'brush') {
      interRef.current = { mode: 'stroke', pts: [[wx, wy]] }
      requestRender()
      return
    }

    if (tool === 'line' || tool === 'arrow' || tool === 'ridge') {
      interRef.current = { mode: 'seg', kind: tool, start: [wx, wy], end: [wx, wy] }
      requestRender()
      return
    }

    if (tool === 'compound') {
      interRef.current = { mode: 'compound', start: [wx, wy], end: [wx, wy] }
      requestRender()
      return
    }

    if (tool === 'flight' || tool === 'flight1' || tool === 'flight2') {
      interRef.current = { mode: tool, start: [wx, wy], end: [wx, wy] }
      requestRender()
    }
  }

  const onPointerMove = (e) => {
    if (e.cancelable) e.preventDefault()
    const [mx, my] = toWorld(e)

    // Direct DOM Readout Update (Bypasses React State Re-render Overhead)
    if (coordRef.current) {
      if (mx >= -200 && my >= -200 && mx <= mapSize + 200 && my <= mapSize + 200) {
        const col = String.fromCharCode(65 + clamp(Math.floor(mx / 1000), 0, 25))
        const row = clamp(Math.floor(my / 1000), 0, 99) + 1
        coordRef.current.textContent = `Grid ${col}${row} · ${Math.round(mx)}m, ${Math.round(my)}m`
        coordRef.current.style.display = 'block'
      } else {
        coordRef.current.style.display = 'none'
      }
    }

    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const v = viewRef.current
      const rect = canvasRef.current.getBoundingClientRect()
      const cx = (a.x + b.x) / 2 - rect.left
      const cy = (a.y + b.y) / 2 - rect.top
      const z2 = clamp((d / pinchRef.current.dist) * pinchRef.current.zoom, 1, 14)
      const k = z2 / v.zoom
      v.ox = cx - (cx - v.ox) * k
      v.oy = cy - (cy - v.oy) * k
      v.zoom = z2
      requestRender()
      return
    }

    const it = interRef.current
    if (!it || !it.mode) return
    const [wx, wy] = toWorld(e)

    if (it.mode === 'pan') {
      const v = viewRef.current
      v.ox = it.ox + (e.clientX - it.sx)
      v.oy = it.oy + (e.clientY - it.sy)
      requestRender()
    } else if (it.mode === 'drag-circle') {
      const ms = propsRef.current.mapSize
      const nx = clamp(wx - it.dx, 0, ms)
      const ny = clamp(wy - it.dy, 0, ms)
      propsRef.current.setCircles((cs) => cs.map((c) => (c.id === it.id ? { ...c, x: nx, y: ny } : c)))
      it.moved = true
      requestRender()
    } else if (it.mode === 'drag-text' || it.mode === 'drag-pin') {
      const ms = propsRef.current.mapSize
      propsRef.current.updateAnnoPos(it.id, 0, clamp(wx - (it.dx || 0), 0, ms), clamp(wy - (it.dy || 0), 0, ms))
      it.moved = true
      requestRender()
    } else if (it.mode === 'drag-line') {
      const dwx = wx - it.startWorld[0]
      const dwy = wy - it.startWorld[1]
      const ms = propsRef.current.mapSize
      const newPoints = it.origPoints.map(([px, py]) => [clamp(px + dwx, 0, ms), clamp(py + dwy, 0, ms)])
      propsRef.current.updateAnno(it.id, newPoints)
      it.moved = true
      requestRender()
    } else if (it.mode === 'maybe-toggle') {
      if (Math.hypot(e.clientX - it.sx, e.clientY - it.sy) > 4) {
        interRef.current = { mode: 'drag-pin', id: it.id, moved: false }
      }
    } else if (it.mode === 'drag-compound') {
      const a = propsRef.current.annos.find((n) => n.id === it.id)
      if (!a) return
      const ms = propsRef.current.mapSize
      const w = Math.abs(a.points[1][0] - a.points[0][0])
      const h = Math.abs(a.points[1][1] - a.points[0][1])
      const nx = clamp(wx - it.dx, 0, ms - w)
      const ny = clamp(wy - it.dy, 0, ms - h)
      propsRef.current.updateAnno(it.id, [
        [nx, ny],
        [nx + w, ny + h],
      ])
      it.moved = true
      requestRender()
    } else if (it.mode === 'stroke') {
      const last = it.pts[it.pts.length - 1]
      const v = viewRef.current
      if (Math.hypot(wx - last[0], wy - last[1]) * v.ppm * v.zoom > 3) {
        it.pts.push([wx, wy])
        requestRender()
      }
    } else if (it.mode === 'seg' || it.mode === 'compound' || it.mode === 'flight' || it.mode === 'flight1' || it.mode === 'flight2') {
      it.end = [wx, wy]
      requestRender()
    }
  }

  const onPointerUp = (e) => {
    if (e.cancelable) e.preventDefault()
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null

    const it = interRef.current
    if (!it) return

    if (it.mode === 'maybe-toggle') {
      const a = propsRef.current.annos.find((n) => n.id === it.id)
      if (a) propsRef.current.toggleVehicle(it.id)
      interRef.current = { mode: null }
      requestRender()
      return
    }

    if (
      it.moved &&
      (it.mode === 'drag-text' ||
        it.mode === 'drag-pin' ||
        it.mode === 'drag-line' ||
        it.mode === 'drag-circle' ||
        it.mode === 'drag-compound')
    ) {
      propsRef.current.pushHistory()
    }

    const pc = propsRef.current.penColor
    if (it.mode === 'stroke' && it.pts.length > 1) {
      propsRef.current.addAnno({ id: uid(), type: 'brush', color: pc, points: it.pts })
      propsRef.current.pushHistory()
    } else if (
      (it.mode === 'seg' ||
        it.mode === 'compound' ||
        it.mode === 'flight' ||
        it.mode === 'flight1' ||
        it.mode === 'flight2') &&
      it.end &&
      Math.hypot(it.end[0] - it.start[0], it.end[1] - it.start[1]) > 5
    ) {
      let a
      if (it.mode === 'compound') {
        a = { id: uid(), type: 'compound', color: '#f97316', points: [it.start, it.end] }
      } else if (it.mode === 'flight' || it.mode === 'flight1' || it.mode === 'flight2') {
        const color = it.mode === 'flight2' ? '#a855f7' : '#38bdf8'
        a = { id: uid(), type: it.mode, color, points: [it.start, it.end] }
      } else {
        a = { id: uid(), type: it.kind, color: pc, points: [it.start, it.end] }
      }
      propsRef.current.addAnno(a)
      propsRef.current.pushHistory()
    }
    interRef.current = { mode: null }
    requestRender()
  }

  // Non-passive Touch Event listeners for tablet/stylus touch-action: none
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const preventTouch = (e) => {
      if (e.touches.length > 1 || interRef.current?.mode) {
        if (e.cancelable) e.preventDefault()
      }
    }
    cvs.addEventListener('touchmove', preventTouch, { passive: false })
    cvs.addEventListener('touchstart', preventTouch, { passive: false })
    return () => {
      cvs.removeEventListener('touchmove', preventTouch)
      cvs.removeEventListener('touchstart', preventTouch)
    }
  }, [])

  // Wheel zoom
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = cvs.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const v = viewRef.current
      const z2 = clamp(v.zoom * Math.exp(-e.deltaY * 0.0012), 1, 14)
      const k = z2 / v.zoom
      v.ox = sx - (sx - v.ox) * k
      v.oy = sy - (sy - v.oy) * k
      v.zoom = z2
      requestRender()
    }
    cvs.addEventListener('wheel', onWheel, { passive: false })
    return () => cvs.removeEventListener('wheel', onWheel)
  }, [requestRender])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        interRef.current = { mode: null }
        propsRef.current.setActiveTool('select')
        requestRender()
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toUpperCase()
      if (k === 'V') propsRef.current.setActiveTool('select')
      else if (k === 'P') propsRef.current.setActiveTool('pin')
      else if (k === 'B') propsRef.current.setActiveTool('brush')
      else if (k === 'L') propsRef.current.setActiveTool('line')
      else if (k === 'A') propsRef.current.setActiveTool('arrow')
      else if (k === 'S') propsRef.current.setActiveTool('smoke')
      else if (k === 'R') propsRef.current.setActiveTool('ridge')
      else if (k === 'F') propsRef.current.setActiveTool('flight1')
      else if (k === 'G') propsRef.current.setActiveTool('vehicle')
      else if (k === 'C') propsRef.current.setActiveTool('compound')
      else if (k === 'T') propsRef.current.setActiveTool('text')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestRender])

  // Drag and drop zone / team placement
  const onDragOver = (e) => {
    const types = [...e.dataTransfer.types]
    if (types.includes('text/x-zone-stage') || types.includes('text/x-team-id') || types.includes('text/plain')) e.preventDefault()
  }
  const onDrop = (e) => {
    e.preventDefault()
    const stage = parseInt(e.dataTransfer.getData('text/x-zone-stage'), 10)
    if (stage) {
      const [wx, wy] = toWorld(e)
      addCircleAt(stage, clamp(wx, 0, mapSize), clamp(wy, 0, mapSize))
      requestRender()
      return
    }
    const teamId = e.dataTransfer.getData('text/x-team-id') || e.dataTransfer.getData('text/plain')
    if (teamId) {
      const [wx, wy] = toWorld(e)
      const team = TEAMS.find((t) => t.id === teamId)
      const anno = {
        id: uid(),
        type: 'team',
        teamId,
        color: team ? team.color : '#facc15',
        color2: team ? team.color2 : '#0f172a',
        label: team ? team.name : teamId,
        size: 1,
        logoUrl: team ? team.logoUrl : '',
        points: [[clamp(wx, 0, mapSize), clamp(wy, 0, mapSize)]],
      }
      addAnno(anno)
      setSelectedId(anno.id)
      pushHistory()
      requestRender()
    }
  }

  const handleZoom = (factor) => {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const z2 = clamp(v.zoom * factor, 1, 14)
    const k = z2 / v.zoom
    v.ox = w / 2 - (w / 2 - v.ox) * k
    v.oy = h / 2 - (h / 2 - v.oy) * k
    v.zoom = z2
    requestRender()
  }

  const handleResetView = () => {
    const { w, h } = sizeRef.current
    viewRef.current = computeView(w, h, mapSize, 1)
    requestRender()
  }

  const targetAnnos = allAnnos || annos
  const selectedAnno = targetAnnos.find((a) => a.id === selectedId)
  const selectedCircle = circles.find((c) => c.id === selectedId)

  const cursor =
    activeTool === 'select' ? 'grab' : activeTool === 'flight' || activeTool === 'flight1' || activeTool === 'flight2' ? 'crosshair' : 'crosshair'

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#060910]" onDragOver={onDragOver} onDrop={onDrop}>
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Floating Zoom Controls */}
      <div className={`absolute right-2 sm:right-[292px] top-4 z-20 flex flex-col gap-1.5 rounded-2xl border border-slate-800/50 bg-[#0B1120]/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl`}>
        <button
          onClick={() => handleZoom(1.25)}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200 active:scale-95"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200 active:scale-95"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus size={16} />
        </button>
        <div className="flex h-6 items-center justify-center font-mono text-[9px] font-bold text-amber-400/80 border-t border-slate-800/40 pt-1.5">
          {Math.round(viewRef.current.zoom * 100)}%
        </div>
        <button
          onClick={handleResetView}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/30 text-slate-400 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200 active:scale-95"
          title="Reset View"
          aria-label="Reset Zoom and Pan"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Fixed Right-Side Tools Panel */}
      {(!isMobile || mobilePanelOpen) && (
        <>
          {/* Mobile: backdrop overlay */}
          {isMobile && mobilePanelOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobilePanelOpen(false)}
            />
          )}
          <div className={`${isMobile ? 'fixed inset-y-0 right-0 z-40 w-[85vw] max-w-[320px] animate-slide-left' : 'absolute right-0 top-0 bottom-0 z-30 w-[280px]'} flex flex-col border-l border-slate-800/50 bg-[#090E1A]/98 shadow-[-8px_0_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl animate-fade-in`}>
        {/* Panel Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-2.5 text-[13px] font-extrabold text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10">
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <span>Tactical Tools</span>
          </div>
          {(selectedCircle || selectedAnno) && (
            <button
              onClick={() => setSelectedId(null)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-800/60 hover:text-slate-200"
              title="Deselect"
              aria-label="Deselect"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Panel Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Active Tool indicator */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-900/25 px-3 py-2">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Active Tool</span>
            <span className="text-[11px] font-extrabold text-amber-400">
              {activeTool === 'flight1' ? 'FLIGHT' : activeTool === 'flight2' ? 'FLIGHT 2' : activeTool.toUpperCase()}
            </span>
          </div>

          {/* Drawing Tools Grid */}
          <div className="space-y-2">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Drawing Tools</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'select', icon: MousePointer2, label: 'Select (V)' },
                { id: 'pin', icon: MapPin, label: 'Pin (P)' },
                { id: 'brush', icon: PenLine, label: 'Brush (B)' },
                { id: 'line', icon: Minus, label: 'Line (L)' },
                { id: 'arrow', icon: MoveUpRight, label: 'Arrow (A)' },
                { id: 'flight1', icon: Plane, label: 'Flight (F)' },
                { id: 'flight2', icon: Plane, label: 'Flight 2 (F2)' },
                { id: 'vehicle', icon: Car, label: 'Vehicle (G)' },
                { id: 'compound', icon: Home, label: 'Compound (C)' },
                { id: 'text', icon: Type, label: 'Text (T)' },
                { id: 'smoke', icon: Cloud, label: 'Smoke (S)' },
                { id: 'ridge', icon: Compass, label: 'Ridge (R)' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={activeTool === t.id}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 ${
                    activeTool === t.id
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.1)]'
                      : 'border-slate-800/40 bg-slate-800/20 text-slate-500 hover:border-slate-700/50 hover:text-slate-300'
                  }`}
                >
                  <t.icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Default Pen Color Palette */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Default Color ({COLOR_PRESETS.length})</span>
              <span className="font-mono text-[9px] font-bold uppercase text-amber-400">{penColor}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-2.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => handleColorSelect && handleColorSelect(c.hex)}
                  title={c.name}
                  className={`h-5 w-5 rounded-full border-2 transition-all duration-150 ${
                    penColor?.toLowerCase() === c.hex.toLowerCase()
                      ? 'scale-[1.2] border-white/90 shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10'
                      : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <label
                title="Custom Color"
                className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-slate-600 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-red-500 via-green-500 to-blue-500 hover:scale-110"
              >
                <input
                  type="color"
                  value={penColor || '#FBBF24'}
                  onChange={(e) => handleColorSelect && handleColorSelect(e.target.value)}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Teams Roster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                <Shield size={11} className="text-amber-400" />
                <span>Teams ({TEAMS.length})</span>
              </div>
              <span className="text-[9px] font-medium text-slate-600">Drag to map</span>
            </div>
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Search team..."
                className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 pl-8 pr-8 py-2 text-xs font-medium text-slate-100 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none transition-colors"
              />
              {teamQuery && (
                <button
                  onClick={() => setTeamQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(teamQuery.trim()
                ? TEAMS.filter((t) =>
                    `${t.name} ${t.short} ${t.event} ${t.players ? t.players.join(' ') : ''}`
                      .toLowerCase()
                      .includes(teamQuery.trim().toLowerCase()),
                  )
                : TEAMS
              ).map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/x-team-id', t.id)
                    e.dataTransfer.setData('text/plain', t.id) // Safari requires plain text for drop
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  className="group flex cursor-grab items-center gap-2 rounded-xl border border-slate-800/40 bg-[#0D1525] p-2 transition-all duration-200 hover:border-amber-400/25 hover:bg-slate-800/30 active:scale-[0.97] active:cursor-grabbing"
                  title={`${t.name} · ${t.event}`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-0.5 text-[10px] font-black text-white"
                    style={{
                      background: `linear-gradient(135deg, ${t.color2 || '#1e293b'}, #0f172a)`,
                      borderColor: t.color || '#38bdf8',
                      boxShadow: `0 0 8px ${t.color || '#38bdf8'}33`,
                    }}
                  >
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl.startsWith('/') ? `${import.meta.env.BASE_URL}${t.logoUrl.slice(1)}` : `${import.meta.env.BASE_URL}${t.logoUrl}`}
                        alt={t.name}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-contain filter drop-shadow-sm"
                        onError={(e) => {
                          const raw = t.logoUrl.startsWith('/') ? t.logoUrl.slice(1) : t.logoUrl
                          const fallback = `./${raw}`
                          if (!e.currentTarget.dataset.retried) {
                            e.currentTarget.dataset.retried = 'true'
                            e.currentTarget.src = fallback
                          } else {
                            e.currentTarget.style.display = 'none'
                          }
                        }}
                      />
                    ) : (
                      <>{t.short}</>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold text-slate-200">{t.name}</div>
                    <div className="truncate text-[8px] font-semibold text-slate-600">#{t.rank} · {t.event}</div>
                  </div>
                </div>
              ))}
              {teamQuery.trim() && TEAMS.filter((t) =>
                    `${t.name} ${t.short} ${t.event} ${t.players ? t.players.join(' ') : ''}`
                      .toLowerCase()
                      .includes(teamQuery.trim().toLowerCase()),
                  ).length === 0 && (
                <p className="col-span-2 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-4 text-center text-[10px] text-slate-500">
                  No teams match "{teamQuery.trim()}"
                </p>
              )}
            </div>
          </div>

          {/* Selected-item separator */}

          {selectedCircle ? (
              <>
                {/* Diameter badge */}
                <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Diameter</span>
                  <span className="font-mono text-sm font-extrabold text-amber-400">⌀ {Math.round(selectedCircle.r * 2)}m</span>
                </div>

                {/* Remove Zone */}
                <button
                  onClick={() => props.removeCircle && props.removeCircle(selectedCircle.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/5 py-2.5 text-[11px] font-bold text-red-400 transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
                >
                  <Trash2 size={13} /> Remove Zone
                </button>
              </>
            ) : selectedAnno ? (
              <>
                {/* Type-specific editors */}
                {selectedAnno.type === 'team' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-black text-white"
                        style={{
                          background: `linear-gradient(135deg, ${selectedAnno.color2 || '#0f172a'}, #0a0a0f)`,
                          borderColor: selectedAnno.color || '#FBBF24',
                        }}
                      >
                        {(TEAMS.find((t) => t.id === selectedAnno.teamId)?.short || '').slice(0, 3)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-extrabold text-slate-100">{selectedAnno.label || 'Team'}</div>
                        <div className="truncate text-[9px] font-semibold text-slate-500">
                          {TEAMS.find((t) => t.id === selectedAnno.teamId)?.event || 'Squad Tactical Marker'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Label / Callout</span>
                      <input
                        type="text"
                        value={selectedAnno.label || ''}
                        onChange={(e) => updateAnnoLabel && updateAnnoLabel(selectedAnno.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-3.5 py-2.5 text-sm font-medium text-slate-100 focus:border-amber-400/50 focus:outline-none transition-colors"
                        placeholder="e.g. iQOO Soul Alpha Hold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Logo Size</span>
                        <span className="font-mono text-[10px] font-bold text-amber-400">
                          {Math.round((selectedAnno.size || 1) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={3}
                        step={0.05}
                        value={selectedAnno.size || 1}
                        onChange={(e) =>
                          updateAnnoField && updateAnnoField(selectedAnno.id, { size: parseFloat(e.target.value) })
                        }
                        className="w-full cursor-pointer accent-amber-400"
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {[0.6, 1, 1.5, 2.5].map((s) => (
                          <button
                            key={s}
                            onClick={() => updateAnnoField && updateAnnoField(selectedAnno.id, { size: s })}
                            className={`rounded-lg border py-1 text-[10px] font-extrabold transition-all ${
                              Math.abs((selectedAnno.size || 1) - s) < 0.001
                                ? 'border-amber-400 bg-amber-400/25 text-amber-300'
                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Custom Logo URL</span>
                      <input
                        type="text"
                        value={selectedAnno.logoUrl || ''}
                        onChange={(e) => updateAnnoField && updateAnnoField(selectedAnno.id, { logoUrl: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && updateAnnoField && updateAnnoField(selectedAnno.id, { logoUrl: e.target.value })}
                        className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-3.5 py-2.5 font-mono text-xs font-medium text-slate-100 focus:border-amber-400/50 focus:outline-none transition-colors"
                        placeholder="Paste any image URL (PNG/JPG/WebP)..."
                      />
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-600">
                      Paste any public logo image URL to display the real logo (cross-origin images load best). Drag on map to reposition. Delete to remove.
                    </p>
                  </div>
                )}

                {selectedAnno.type === 'text' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Text Content</span>
                      <input
                        type="text"
                        value={selectedAnno.label || ''}
                        onChange={(e) => updateAnnoLabel && updateAnnoLabel(selectedAnno.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-3.5 py-2.5 text-sm font-medium text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
                        placeholder="Type text note..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Font Size</span>
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
                  </div>
                )}

                {(selectedAnno.type === 'arrow' || selectedAnno.type === 'line' || selectedAnno.type === 'brush') && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Thickness</span>
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

                {/* Color Palette for Selected Item */}
                {selectedAnno.type !== 'team' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Color ({COLOR_PRESETS.length})</span>
                    <span className="font-mono text-[9px] font-bold uppercase text-amber-400">
                      {selectedAnno.color || penColor}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-2.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleColorSelect && handleColorSelect(c.hex)}
                        title={c.name}
                        className={`h-5 w-5 rounded-full border-2 transition-all duration-150 ${
                          (selectedAnno.color || penColor)?.toLowerCase() === c.hex.toLowerCase()
                            ? 'scale-[1.2] border-white/90 shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10'
                            : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                    <label
                      title="Custom Color"
                      className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-slate-600 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform"
                    >
                      <input
                        type="color"
                        value={selectedAnno.color || penColor}
                        onChange={(e) => handleColorSelect && handleColorSelect(e.target.value)}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
                )}

                {/* Delete */}
                <button
                  onClick={() => removeAnno && removeAnno(selectedAnno.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/5 py-2.5 text-[11px] font-bold text-red-400 transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
                >
                  <Trash2 size={13} /> Delete Item
                </button>
              </>
            ) : null}
          </div>
        </div>
        </>
      )}

      {/* Coordinate Readout */}
      <div
        ref={coordRef}
        style={{ display: 'none' }}
        className={`pointer-events-none absolute bottom-4 ${isMobile ? 'right-2' : 'right-[292px]'} z-20 rounded-xl border border-slate-800/50 bg-[#0B1120]/95 px-3.5 py-2 font-mono text-[11px] font-semibold text-amber-400/80 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-2xl`}
      />

      {/* Active Tool Prompt */}
      {(activeTool === 'flight' || activeTool === 'flight1' || activeTool === 'flight2') && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-xl border border-red-500/30 bg-[#0B1120]/95 px-4 py-2.5 text-[11px] font-bold text-red-300 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
          Click 2 points to draw Flight Path — Esc to exit
        </div>
      )}

      {/* Text Annotation Modal */}
      {textModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-[#0B1120] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)] space-y-4 animate-scale-in" role="dialog" aria-modal="true" aria-label="Text annotation editor">
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
              <h3 className="text-[13px] font-extrabold text-white flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10">
                  <Type className="text-amber-400" size={14} />
                </div>
                {textModal.isEditing ? 'Edit Text Note' : 'Add Text Note'}
              </h3>
              <button onClick={() => setTextModal(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800/60 hover:text-slate-200 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Callout Text</label>
              <input
                type="text"
                autoFocus
                value={textModal.label || ''}
                onChange={(e) => setTextModal((m) => ({ ...m, label: e.target.value }))}
                placeholder="e.g. Squad Alpha Hold"
                className="mt-1.5 w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-3.5 py-2.5 text-xs font-medium text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textModal.label?.trim()) {
                    if (textModal.isEditing && textModal.id) {
                      updateAnnoLabel && updateAnnoLabel(textModal.id, textModal.label.trim())
                      if (textModal.fontSize) updateAnnoFontSize && updateAnnoFontSize(textModal.id, textModal.fontSize)
                      if (textModal.color) handleColorSelect && handleColorSelect(textModal.color)
                    } else {
                      const id = uid()
                      addAnno({
                        id,
                        type: 'text',
                        color: textModal.color || penColor,
                        fontSize: textModal.fontSize || 20,
                        label: textModal.label.trim(),
                        points: [[textModal.x, textModal.y]],
                      })
                      setSelectedId(id)
                      pushHistory()
                    }
                    setTextModal(null)
                    requestRender()
                  } else if (e.key === 'Escape') {
                    setTextModal(null)
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                <span>Font Size</span>
                <span className="font-mono text-cyan-400 normal-case tracking-normal">{textModal.fontSize || 20}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={1}
                value={textModal.fontSize || 20}
                onChange={(e) => {
                  const sz = parseInt(e.target.value, 10)
                  setTextModal((m) => ({ ...m, fontSize: sz }))
                  if (textModal.isEditing && textModal.id) {
                    updateAnnoFontSize && updateAnnoFontSize(textModal.id, sz)
                  }
                }}
                className="w-full cursor-pointer accent-cyan-400"
              />
              <div className="grid grid-cols-5 gap-1">
                {FONT_PRESETS.map((p) => (
                  <button
                    key={p.size}
                    onClick={() => {
                      setTextModal((m) => ({ ...m, fontSize: p.size }))
                      if (textModal.isEditing && textModal.id) {
                        updateAnnoFontSize && updateAnnoFontSize(textModal.id, p.size)
                      }
                    }}
                    className={`rounded-lg border py-1.5 text-[10px] font-bold transition-all duration-150 ${
                      (textModal.fontSize || 20) === p.size
                        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-800/60 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                <span>Text Color</span>
                <span className="font-mono text-amber-400 normal-case tracking-normal">{textModal.color || penColor}</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950/50 p-2.5 max-h-36 overflow-y-auto">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setTextModal((m) => ({ ...m, color: c.hex }))
                      handleColorSelect && handleColorSelect(c.hex)
                    }}
                    title={c.name}
                    className={`h-5 w-5 rounded-full border-2 transition-all duration-150 ${
                      (textModal.color || penColor)?.toLowerCase() === c.hex.toLowerCase()
                        ? 'scale-[1.2] border-white/90 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                        : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <label
                  title="Custom Color"
                  className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-slate-600 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform"
                >
                  <input
                    type="color"
                    value={textModal.color || penColor || '#FBBF24'}
                    onChange={(e) => {
                      const hex = e.target.value
                      setTextModal((m) => ({ ...m, color: hex }))
                      handleColorSelect && handleColorSelect(hex)
                    }}
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setTextModal(null)}
                className="rounded-xl border border-slate-700/50 px-4 py-2 text-[11px] font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 active:scale-[0.98] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (textModal.label?.trim()) {
                    if (textModal.isEditing && textModal.id) {
                      updateAnnoLabel && updateAnnoLabel(textModal.id, textModal.label.trim())
                      if (textModal.fontSize) updateAnnoFontSize && updateAnnoFontSize(textModal.id, textModal.fontSize)
                      if (textModal.color) handleColorSelect && handleColorSelect(textModal.color)
                    } else {
                      const id = uid()
                      addAnno({
                        id,
                        type: 'text',
                        color: textModal.color || penColor,
                        fontSize: textModal.fontSize || 20,
                        label: textModal.label.trim(),
                        points: [[textModal.x, textModal.y]],
                      })
                      setSelectedId(id)
                      pushHistory()
                    }
                    setTextModal(null)
                    requestRender()
                  }
                }}
                disabled={!textModal.label?.trim()}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-[11px] font-extrabold text-slate-950 shadow-[0_2px_8px_rgba(251,191,36,0.2)] disabled:opacity-30 hover:shadow-[0_4px_16px_rgba(251,191,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                {textModal.isEditing ? 'Save' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
