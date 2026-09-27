// ============================================================================
// EXPORT COMPOSITION
// ============================================================================
//
// One function builds the finished export image. Both the download button and
// the on-screen preview call it, which is the only way to guarantee the
// preview is telling the truth.
//
// It delegates ALL map drawing to `renderScene()` from ./render — there is no
// second map-rendering path here (AGENTS.md, "One renderer, two consumers").
// This file's only job is to decide the pixel rectangle the map occupies and
// then paint the frame around it.
// ============================================================================

import { renderScene, computeView } from './render'
import {
  getTemplate,
  computeFrameLayout,
  drawFrame,
  normalizeContent,
  DESIGN_WIDTH,
} from './frames'
import { loadLogoImage } from './brandLogo'
import { exportSelection } from './layers'

/**
 * @typedef {object} ExportBoard
 * @property {number}  mapSize          world size in metres (square)
 * @property {HTMLImageElement|null} mapImage
 * @property {string}  mapName
 * @property {string}  mapId
 * @property {Array}   circles
 * @property {Array}   annos
 * @property {boolean} gridOn
 * @property {boolean} showHeatmap
 * @property {boolean} showContours
 * @property {boolean} showBlueZoneMask
 */

/**
 * @typedef {object} ExportFrameOptions
 * @property {string} templateId
 * @property {{header: object, footer: object}} fields
 * @property {object} content
 * @property {object} [logo]  brand logo settings (dataUrl/position/size/opacity)
 *
 * @typedef {object} ExportBoard
 * (see above)
 */

/**
 * Compose the export.
 *
 * @param {object} o
 * @param {'square'|'view'} o.mode
 * @param {ExportBoard}     o.board
 * @param {ExportFrameOptions} [o.frame]  omit for a bare map
 * @param {object} [o.view]        editor view, required for mode 'view'
 * @param {number} [o.viewportW]   editor viewport width, mode 'view'
 * @param {number} [o.viewportH]   editor viewport height, mode 'view'
 * @param {object} [o.board.layerDocument] layer visibility/lock/order, from
 *        `lib/layers.js`. Hidden layers are excluded from the export.
 * @param {number} [o.outputWidth] total image width; defaults to 2048
 * @param {number} [o.t]           timestamp for deterministic output
 * @returns {{canvas: HTMLCanvasElement, width: number, height: number, layout: object}}
 */
export async function renderExportCanvas(o) {
  const {
    mode = 'square',
    board,
    frame = null,
    view = null,
    viewportW = 800,
    viewportH = 800,
    outputWidth = DESIGN_WIDTH,
    t = 0,
  } = o

  // `layerDocument` decides what actually reaches the PNG. This is the one place
  // that decision is made, so the preview and the download cannot disagree.
  const sel = exportSelection(board.annos, board.circles, board.layerDocument)

  // Hiding the Frame / Export layer means "give me the bare map", which is
  // exactly what a null template already produces. The map rectangle is
  // computed from the template below, and it is identical either way.
  const frameWanted = sel.frameVisible
  const template = frame && frameWanted ? getTemplate(frame.templateId) : null
  const fields = frame?.fields || { header: {}, footer: {} }
  const content = normalizeContent(frame?.content)

  // The brand logo must be fully decoded BEFORE anything rasterises. Drawing an
  // image that is still loading is a silent no-op, which would ship an export
  // with a missing logo and no error. `loadLogoImage` is cached by data URL, so
  // the preview and the download share one decode.
  let logo = null
  if (frame?.logo?.dataUrl) {
    const img = await loadLogoImage(frame.logo.dataUrl)
    if (img) logo = { ...frame.logo, img }
  }

  // --- 1. Work out the map rectangle -------------------------------------
  // `contentAspect` is the map area's width/height ratio. computeView() then
  // fits the (square) world inside that rectangle and letterboxes the
  // remainder, so the map image is never stretched regardless of frame.
  const contentAspect = mode === 'square' ? 1 : viewportH / viewportW

  const layout = computeFrameLayout({
    template: template || getTemplate('none'),
    fields,
    content,
    outputWidth,
    contentAspect,
    logo,
  })

  const { mapX, mapY, mapW, mapH } = layout

  // --- 2. The map's own scale factor -------------------------------------
  // S multiplies every stroke width and font size inside renderScene. It must
  // track the map rectangle so annotations keep the same size relative to the
  // map no matter how much padding the frame adds.
  //
  //   mode 'square' -> 2048 / 800 historically, i.e. mapW / 800
  //   mode 'view'   -> exportWidth / viewportW, i.e. mapW / viewportW
  const designViewport = mode === 'square' ? 800 : Math.max(1, viewportW)
  const S = mapW / designViewport

  // --- 3. Map view --------------------------------------------------------
  let mapView
  if (mode === 'square') {
    mapView = computeView(mapW, mapH, board.mapSize, 1)
  } else {
    const src = view || computeView(viewportW, viewportH, board.mapSize, 1)
    mapView = {
      ppm: src.ppm * S,
      zoom: src.zoom || 1,
      ox: src.ox * S,
      oy: src.oy * S,
    }
  }

  // --- 4. Allocate and paint ---------------------------------------------
  // Render the map onto an isolated offscreen canvas so that tactical drawing
  // cannot leak transforms or be affected by frame styling.
  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = mapW
  mapCanvas.height = mapH
  const mapCtx = mapCanvas.getContext('2d')

  renderScene(mapCtx, mapW, mapH, {
    mapSize: board.mapSize,
    // Hiding the Map layer removes the imagery and every overlay that belongs to
    // it, leaving the tactical drawing on the page background.
    image: sel.mapVisible ? board.mapImage : null,
    gridOn: sel.mapVisible ? board.gridOn : false,
    minorGridOn: false,
    circles: sel.circles,
    // Hidden layers and the per-annotation `hidden` flag are both honoured, and
    // the survivors are stacked in layer order.
    annos: sel.annos,
    highlights: [],
    selectedId: null,
    mapId: board.mapId || 'erangel',
    showHeatmap: sel.mapVisible ? board.showHeatmap ?? true : false,
    showContours: sel.mapVisible ? board.showContours ?? false : false,
    showBlueZoneMask: sel.mapVisible ? board.showBlueZoneMask ?? true : false,
    view: mapView,
    t,
    viewportWidth: designViewport,
    exportScaleFactor: S,
  })

  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')

  // Frame first, so the map is painted on top of the page background.
  if (template) {
    drawFrame(ctx, layout, { template, fields, content, logo })
  } else {
    ctx.fillStyle = '#070A0F'
    ctx.fillRect(0, 0, layout.width, layout.height)
  }

  // Blit the completed map directly into its designated slot.
  ctx.drawImage(mapCanvas, mapX, mapY)
  mapCanvas.width = mapCanvas.height = 0

  return { canvas, width: layout.width, height: layout.height, layout }
}

/**
 * Web fonts are not available to a canvas until they have loaded. Without
 * this, an export fired immediately after opening the dialog renders the
 * frame text in a fallback face. Safe to call when the fonts already resolved.
 */
export async function ensureFontsReady() {
  if (!document.fonts || !document.fonts.ready) return
  try {
    await document.fonts.load('900 40px Inter')
    await document.fonts.load('800 24px Inter')
    await document.fonts.load('700 24px "JetBrains Mono"')
    await document.fonts.ready
  } catch {
    // Font loading is best-effort; fall back to the system stack.
  }
}

/** Trigger a browser download for a composed canvas. */
export function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas could not be encoded'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      // Give the browser a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}

/** Build a filename that reflects the frame and the content. */
export function exportFilename(mapName, templateId, mode) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const parts = [slug(mapName) || 'map']
  if (templateId && templateId !== 'none') parts.push(slug(templateId))
  parts.push(mode === 'square' ? 'square' : 'view')
  return `${parts.join('-')}-tactical-map.png`
}
