/**
 * Procedural high-zoom detail for the base map image.
 *
 * WHY THIS EXISTS
 * The shipped map JPEGs are ~1004x1024 stretched across an 8000m world, which
 * is about 0.086 px per meter at fit-to-screen. The app zooms to 14x, so at the
 * top of that range each source pixel is stretched across ~14 screen pixels and
 * the map turns to mush. Sites like pubgmap.io stay sharp because they serve
 * raster tiles at every zoom level.
 *
 * Rather than ship tiles, we draw sharp VECTOR detail on top of the low-res
 * base: building footprints in the towns, tree cover in the forests, and field
 * texture over open ground. Because it is vector it stays crisp at any zoom,
 * and it adds no assets and no third-party imagery.
 *
 * THE MAP ALREADY HAS REAL ROADS AND COASTLINES
 * The base image is the real satellite-style map, complete with its own roads,
 * rivers and place labels. So this module deliberately does NOT draw roads or
 * field boundaries: generated ones would sit on top of the accurate ones and
 * make the map worse. It only adds what the base image cannot show at depth.
 *
 * PLACEMENT IS READ FROM THE MAP, NOT GUESSED
 * Buildings are not scattered near named locations by chance. We sample the
 * base image into a coarse classification grid and place detail by what is
 * actually there:
 *
 *   water  - blue-dominant with a wide margin
 *   urban  - land that is grey and desaturated (roofs read grey from orbit)
 *   trees  - green-dominant (forest)
 *   plain  - everything else (fields, bare ground)
 *
 * That is why Pochinki and School fill with buildings while the fields around
 * them stay empty, and why nothing ever appears in the sea.
 *
 * TWO RULES KEEP THIS HONEST WITH THE REST OF THE APP
 *
 * 1. DETERMINISTIC. Every feature is derived from a hash of its own grid
 *    coordinates, never Math.random, so the same place always draws the same
 *    buildings. The exporter rasterises the same board twice and must get the
 *    same image (AGENTS.md export rule 8).
 *
 * 2. ZOOM GATED. Nothing is drawn while the base image is still readable, and
 *    only the leaves of a quadtree that are actually on screen are drawn, so
 *    the per-frame cost stays flat as you zoom.
 */

import { MAPS } from '../data/maps'

// Resolution of the classification grid sampled from the base image. Coarse on
// purpose: we only need to know roughly what kind of ground this is, and the
// detail placed on top is many times bigger than a cell. 256 over 8000m is
// ~31m per cell, which is fine enough to keep buildings off the shoreline.
const MASK_RES = 256

const CLASS_WATER = 0
const CLASS_PLAIN = 1
const CLASS_TREES = 2
const CLASS_URBAN = 3

// Thresholds, in 0..1. Measured against the real map images, not guessed:
// towns sit around 0.05-0.11 saturation, forests and farmland at 0.13+.
const WATER_BLUE_MARGIN = 38 // blue must beat red by this much to count as sea
const URBAN_MAX_SAT = 0.12 // grey = built up
const URBAN_MIN_LUM = 42 // ignore deep shadow
const TREES_GREEN_MARGIN = 8 // green must beat red by this much to be forest

// A quadtree leaf is drawn once it is no larger than this many output pixels.
// Big on screen = split into four smaller cells and recurse.
const MAX_LEAF_PX = 220

// Stop subdividing below this, or features get smaller than a pixel.
const MIN_CELL_M = 25

// Pixels-per-metre thresholds. `pxPerM` is in the output actually being drawn,
// so a high-resolution export resolves finer detail than the editor rather than
// upscaling a screen capture. At fit-to-screen the app is near 0.086 px/m and
// at max editor zoom near 1.2, so these sit inside the real range.
const TIERS = [
  { min: 0.0, texture: false, trees: false, buildings: false },
  { min: 0.16, texture: true, trees: false, buildings: false },
  { min: 0.3, texture: true, trees: true, buildings: false },
  { min: 0.55, texture: true, trees: true, buildings: true },
]

/* ------------------------------------------------------------------ *
 * Deterministic hashing. All randomness in this file comes from here. *
 * ------------------------------------------------------------------ */

function hashInt(x, y, seed) {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** A stable 0..1 number for a grid coordinate plus a channel. */
function hashUnit(x, y, channel, seed) {
  return hashInt(x, y, (seed ^ Math.imul(channel, 2654435761)) >>> 0) / 4294967296
}

/** A tiny seed per map, so two maps never share the same layout. */
function seedForMap(mapId) {
  let h = 2166136261
  for (let i = 0; i < mapId.length; i++) {
    h = Math.imul(h ^ mapId.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/* ------------------------------------------------------------------ *
 * Classification grid, sampled once from the base image.             *
 * ------------------------------------------------------------------ */

// Keyed on the image itself so a newly loaded image gets its own grid.
const maskCache = new WeakMap()

/**
 * Reduces the base image to a MASK_RES square grid of ground classes.
 *
 * Sampled at MASK_RES rather than full resolution: it keeps the one-time cost
 * trivial, and the detail we place on top is many times bigger than a cell
 * anyway, so full resolution would buy nothing.
 */
function getMask(image) {
  const cached = maskCache.get(image)
  if (cached) return cached

  let mask = null
  try {
    const cv = document.createElement('canvas')
    cv.width = cv.height = MASK_RES
    const c = cv.getContext('2d', { willReadFrequently: true })
    c.drawImage(image, 0, 0, MASK_RES, MASK_RES)
    const data = c.getImageData(0, 0, MASK_RES, MASK_RES).data
    mask = new Uint8Array(MASK_RES * MASK_RES)

    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const r = data[p]
      const g = data[p + 1]
      const b = data[p + 2]

      // A wide blue margin matters. Forest on these maps is dark and slightly
      // blue-green, so a tight "bluer than red" test reads woodland as sea.
      if (b > r + WATER_BLUE_MARGIN) {
        mask[i] = CLASS_WATER
        continue
      }
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const maxc = Math.max(r, g, b)
      const minc = Math.min(r, g, b)
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc

      if (lum > URBAN_MIN_LUM && sat < URBAN_MAX_SAT) mask[i] = CLASS_URBAN
      else if (g > r + TREES_GREEN_MARGIN) mask[i] = CLASS_TREES
      else mask[i] = CLASS_PLAIN
    }
  } catch {
    // A tainted or unreadable canvas must never break rendering. Null means
    // "unknown ground", which the layers below treat as plain land.
    mask = null
  }

  maskCache.set(image, mask)
  return mask
}

/**
 * What class of ground is this world point? Samples a 3x3 neighbourhood and
 * returns the most common, which keeps a building a comfortable distance off
 * the shoreline instead of straddling it.
 */
function classAt(mask, mapSize, mx, my) {
  if (!mask) return CLASS_PLAIN
  const fx = (mx / mapSize) * MASK_RES
  const fy = (my / mapSize) * MASK_RES
  // A margin of 1 keeps the 3x3 window inside the array.
  if (fx < 1 || fy < 1 || fx > MASK_RES - 2 || fy > MASK_RES - 2) return CLASS_WATER
  const x = fx | 0
  const y = fy | 0
  const counts = [0, 0, 0, 0]
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      counts[mask[(y + dy) * MASK_RES + (x + dx)]]++
    }
  }
  let best = CLASS_PLAIN
  for (let k = 1; k < 4; k++) if (counts[k] > counts[best]) best = k
  return best
}

/* ------------------------------------------------------------------ *
 * The layers. Each draws one leaf cell in world coordinates.         *
 * ------------------------------------------------------------------ */

/**
 * Field and bare-ground texture: short furrow strokes. Low alpha on purpose,
 * this is grain to break up the blur, not something to read.
 */
function drawTexture(ctx, X, Y, Z, S, seed, x0, y0, size, theme) {
  const strokes = 7
  ctx.lineWidth = 0.9 * S
  ctx.strokeStyle = theme.mountains || 'rgba(15,23,42,1)'
  ctx.globalAlpha = 0.16
  ctx.beginPath()
  for (let i = 0; i < strokes; i++) {
    const a = hashUnit(x0 + i * 7919, y0, 21, seed)
    const b = hashUnit(x0, y0 + i * 6271, 22, seed)
    const sx = x0 + a * size
    const sy = y0 + b * size
    const l = size * (0.08 + hashUnit(x0 + i, y0 + i, 23, seed) * 0.12)
    ctx.moveTo(X(sx), Y(sy))
    ctx.lineTo(X(sx + l), Y(sy + l * 0.3))
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Forest canopy: clustered crowns, only on ground the map reads as woodland. */
function drawTrees(ctx, X, Y, Z, S, seed, x0, y0, size, theme, mask, mapSize) {
  const count = 30
  // Clumping: a slow noise field decides where the trees gather, so the canopy
  // has open glades instead of an even sprinkle.
  const clump = (tx, ty) => {
    const a = hashUnit((tx / 97) | 0, (ty / 97) | 0, 71, seed)
    const b = hashUnit((tx / 43) | 0, (ty / 43) | 0, 72, seed)
    return a * 0.65 + b * 0.35
  }

  const canopy = theme.mountains || '#3f502e'
  const pts = []

  for (let i = 0; i < count; i++) {
    const tx = x0 + hashUnit(x0 + i * 313, y0, 73, seed) * size
    const ty = y0 + hashUnit(x0, y0 + i * 313, 74, seed) * size
    if (clump(tx, ty) < 0.46) continue
    // Trees belong on woodland. Sampling the ground per crown keeps them out
    // of the towns and out of the sea, where a grid of dots looks wrong.
    if (classAt(mask, mapSize, tx, ty) !== CLASS_TREES) continue
    // Big variation, otherwise the canopy reads as polka dots.
    const r = size * (0.008 + hashUnit(x0 + i, y0 + i, 75, seed) * 0.016)
    pts.push(tx, ty, r)
  }

  ctx.beginPath()
  for (let i = 0; i < pts.length; i += 3) {
    const pr = pts[i + 2] * Z
    if (pr < 0.8) continue
    const px = X(pts[i])
    const py = Y(pts[i + 1])
    ctx.moveTo(px + pr, py)
    ctx.arc(px, py, pr, 0, Math.PI * 2)
  }
  ctx.fillStyle = canopy
  ctx.globalAlpha = 0.6
  ctx.fill()

  // A highlight offset up-left gives each crown a little volume.
  ctx.beginPath()
  for (let i = 0; i < pts.length; i += 3) {
    const pr = pts[i + 2] * Z * 0.5
    if (pr < 0.6) continue
    const px = X(pts[i]) - pr * 0.3
    const py = Y(pts[i + 1]) - pr * 0.3
    ctx.moveTo(px + pr, py)
    ctx.arc(px, py, pr, 0, Math.PI * 2)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fill()
}

/**
 * Building footprints.
 *
 * Not a uniform grid: a grid of identical squares reads as a spreadsheet, not a
 * town. Real settlements are compounds of buildings sharing a street
 * orientation, so each block here gets its own angle, its own lot sizes and its
 * own count, and the blocks are placed wherever the hash puts them.
 */
function drawBuildings(ctx, X, Y, Z, S, seed, x0, y0, size, theme, density, mask, mapSize) {
  if (density <= 0) return
  const roof = theme.urban || '#8c937c'
  const blocks = 4
  const keep = 0.3 + density * 0.7

  for (let b = 0; b < blocks; b++) {
    if (hashUnit(x0 + b * 911, y0, 81, seed) > keep) continue

    // One shared angle per block: the buildings sit on the same street line.
    const angle = (hashUnit(x0 + b * 911, y0, 82, seed) - 0.5) * Math.PI
    const bx = x0 + hashUnit(x0 + b * 911, y0, 83, seed) * size * 0.8 + size * 0.1
    const by = y0 + hashUnit(x0 + b * 911, y0, 84, seed) * size * 0.8 + size * 0.1
const n = 3 + Math.floor(hashUnit(x0 + b * 911, y0, 85, seed) * 5)
const lot = size * (0.08 + hashUnit(x0 + b * 911, y0, 86, seed) * 0.07)

    ctx.save()
    ctx.translate(X(bx), Y(by))
    ctx.rotate(angle)

    for (let i = 0; i < n; i++) {
      const h1 = hashUnit(x0 + b * 911 + i, y0, 87, seed)
      const h2 = hashUnit(x0 + b * 911, y0 + i, 88, seed)
      const h3 = hashUnit(x0 + b * 911 + i, y0 + i, 89, seed)

      // Two rows back to back along the street, with gaps between lots.
      const side = i % 2 === 0 ? -1 : 1
      const along = (Math.floor(i / 2) - (n / 4 - 0.5)) * lot * 1.25
      const across = side * lot * (0.55 + h2 * 0.2)

      const bw = lot * (0.45 + h2 * 0.4)
      const bh = lot * (0.45 + h3 * 0.4)
      const px = along + (h1 - 0.5) * lot * 0.25
      const py = across + (h3 - 0.5) * lot * 0.2

      // World position, so the footprint can be checked against the ground
      // before it is committed to the canvas.
      const wx = bx + px * Math.cos(angle) - py * Math.sin(angle)
      const wy = by + px * Math.sin(angle) + py * Math.cos(angle)
      const ground = classAt(mask, mapSize, wx, wy)
      if (ground === CLASS_WATER || ground === CLASS_TREES) continue

      const pw = bw * Z
      const ph = bh * Z
      if (pw < 1.2 || ph < 1.2) continue // below a pixel: nothing to read

      ctx.fillStyle = roof
      ctx.globalAlpha = 0.3 + h1 * 0.18
      ctx.fillRect(px * Z - pw / 2, py * Z - ph / 2, pw, ph)
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = 'rgba(15,23,42,0.95)'
      ctx.lineWidth = Math.min(1, 0.6 * S)
      ctx.strokeRect(px * Z - pw / 2, py * Z - ph / 2, pw, ph)
    }

    ctx.restore()
  }
  ctx.globalAlpha = 1
}

/* ------------------------------------------------------------------ *
 * Quadtree walk                                                     *
 * ------------------------------------------------------------------ */

function drawLeaf(ctx, cfg, x0, y0, size) {
  const { X, Y, Z, S, mapSize, mask, seed, theme, tier } = cfg
  const cx = x0 + size / 2
  const cy = y0 + size / 2

  const ground = classAt(mask, mapSize, cx, cy)
  if (ground === CLASS_WATER) return

  const density = tier.buildings && ground === CLASS_URBAN ? 1 : 0

  if (tier.texture) drawTexture(ctx, X, Y, Z, S, seed, x0, y0, size, theme)
  if (tier.trees && ground !== CLASS_URBAN) {
    drawTrees(ctx, X, Y, Z, S, seed, x0, y0, size, theme, mask, mapSize)
  }
  if (density > 0) {
    drawBuildings(ctx, X, Y, Z, S, seed, x0, y0, size, theme, density, mask, mapSize)
  }
}

/**
 * Walks the quadtree, subdividing any cell still large on screen and skipping
 * anything outside the visible rect. This is what keeps the frame cost flat:
 * deep zoom shows a small area split into many small cells, not a whole map of
 * tiny ones.
 */
function walk(ctx, cfg, x0, y0, size) {
  const { pxPerM, view } = cfg
  const half = size / 2

  if (x0 + size < view.x0 || x0 > view.x1 || y0 + size < view.y0 || y0 > view.y1) return

  if (size > MIN_CELL_M && size * pxPerM > MAX_LEAF_PX) {
    walk(ctx, cfg, x0, y0, half)
    walk(ctx, cfg, x0 + half, y0, half)
    walk(ctx, cfg, x0, y0 + half, half)
    walk(ctx, cfg, x0 + half, y0 + half, half)
    return
  }

  drawLeaf(ctx, cfg, x0, y0, size)
}

/* ------------------------------------------------------------------ *
 * Entry point                                                       *
 * ------------------------------------------------------------------ */

/**
 * Draws the procedural detail overlay. Call this after the base map image and
 * before the grid and annotations, inside the map clip.
 *
 * `pxPerM` is pixels per world meter in the output being drawn. `renderScene`'s
 * `Z` is already exactly that — the exporter scales `ppm` by its scale factor
 * before calling — so a 4K export resolves finer detail than the editor rather
 * than upscaling a screen capture. Everything else is passed straight through
 * so this stays inside the single shared render path.
 */
export function drawMapDetail(ctx, opts) {
  const { mapId, image, X, Y, mapSize, S, pxPerM, view } = opts
  if (!image || !mapSize) return

  // `pxPerM` is what the tier thresholds are written against; `Z` is the same
  // quantity as far as the layers are concerned, and renderScene passes both
  // from the same value. Accept either so the module cannot be wired up wrong.
  const Z = opts.Z != null ? opts.Z : pxPerM

  let tier = TIERS[0]
  for (const t of TIERS) if (pxPerM >= t.min) tier = t
  // Below the first useful threshold the base image is still readable, so
  // adding detail would only add noise.
  if (!tier.texture) return

  const map = MAPS[mapId]
  if (!map) return

  const cfg = {
    X,
    Y,
    // Z is world meters -> output pixels. The layers scale every feature by it
    // so a cell draws at the same on-screen size whatever the zoom.
    Z,
    S: S || 1,
    mapSize,
    mask: getMask(image),
    seed: seedForMap(mapId),
    theme: map.theme || {},
    tier,
    pxPerM,
    // Clamp the cull rect to the map so an export framing the whole map draws
    // the whole map, and a zoomed-in view only draws what it can see.
    view: {
      x0: Math.max(0, view.x0),
      y0: Math.max(0, view.y0),
      x1: Math.min(mapSize, view.x1),
      y1: Math.min(mapSize, view.y1),
    },
  }

  if (cfg.view.x0 >= cfg.view.x1 || cfg.view.y0 >= cfg.view.y1) return

  ctx.save()
  walk(ctx, cfg, 0, 0, mapSize)
  ctx.restore()
}