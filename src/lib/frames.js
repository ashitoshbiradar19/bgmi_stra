// ============================================================================
// EXPORT FRAME SYSTEM
// ============================================================================
//
// A data-driven frame that is drawn AROUND the map during export only.
//
// Design rules this file exists to enforce:
//
//  1. The frame never draws inside the map rectangle. `drawFrame` only paints
//     the bands above and below `layout.mapY .. layout.mapY + layout.mapH`, so
//     it can never cover a zone, arrow, logo or label.
//  2. The map is never stretched. This module only decides how big the map
//     rectangle is; the map itself is still drawn by `renderScene()` using a
//     `computeView()` that fits the world into that rectangle.
//  3. Every measurement is authored in DESIGN UNITS (a 2048px-wide canvas) and
//     multiplied by `scaleF = outputWidth / DESIGN_WIDTH` at draw time, so a
//     frame looks identical at any export resolution.
//
// Adding a template means adding one entry to FRAME_TEMPLATES. No drawing code
// needs to change.
// ============================================================================

import { computeLogoBox } from './brandLogo'

/** All frame metrics below are authored against a canvas this wide. */
export const DESIGN_WIDTH = 2048

/** Minimum horizontal margin for header/footer content, in design px. */
const MIN_BAND_INSET = 44

export const APP_NAME = 'BGMI Strategy Board'
export const CREDIT_TEXT = 'Created with BGMI Strategy Board'

// ---------------------------------------------------------------------------
// Field definitions — drive both the UI toggles and the layout engine.
// ---------------------------------------------------------------------------

export const HEADER_FIELDS = [
  { id: 'logo', label: 'Logo', hint: 'App emblem' },
  { id: 'appName', label: 'App Name', hint: 'Product name' },
  { id: 'mapName', label: 'Map Name', hint: 'Miramar' },
  { id: 'matchName', label: 'Match Name', hint: 'Squad Clash · Round 3', text: true },
  { id: 'subtitle', label: 'Subtitle', hint: 'Optional free text', text: true },
]

export const FOOTER_FIELDS = [
  { id: 'mapName', label: 'Map Name' },
  { id: 'zoneCount', label: 'Zone Count' },
  { id: 'analystName', label: 'Analyst', text: true },
  { id: 'teamName', label: 'Team', text: true },
  { id: 'strategyName', label: 'Strategy', text: true },
  { id: 'dateTime', label: 'Date / Time' },
  { id: 'credit', label: 'Credit Line' },
]

/** Fields that accept free text and therefore need an input in the dialog. */
export const TEXT_FIELDS = [...HEADER_FIELDS, ...FOOTER_FIELDS].filter((f) => f.text)

const allOn = (defs) => Object.fromEntries(defs.map((d) => [d.id, true]))
const off = (...ids) => (defs) =>
  Object.fromEntries(defs.map((d) => [d.id, !ids.includes(d.id)]))

/** Every field on, minus the ones a template considers noise. */
const fullFields = () => ({ header: allOn(HEADER_FIELDS), footer: allOn(FOOTER_FIELDS) })

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
//
// Knobs available to a template:
//   pad          frame inset in design units (0 = map bleeds to the edge)
//   frame        'none' | 'hairline' | 'inset' | 'double' | 'corners'
//   accent       primary accent (dividers, chips, highlights)
//   accent2      secondary accent
//   bg           page background behind the map
//   bandBg       header / footer band background
//   borderColor  frame border colour
//   header/footer { enabled, padY, gap, rule }
//   density      multiplier on internal padding and font sizes
//   defaults     initial field visibility
// ---------------------------------------------------------------------------

const BASE = {
  pad: 0,
  frame: 'none',
  accent: '#00E5FF',
  accent2: '#FBBF24',
  bg: '#080D18',
  bandBg: '#080D18',
  borderColor: 'rgba(148,163,184,0.35)',
  density: 1,
  header: { enabled: true, padY: 26, gap: 8, rule: true },
  footer: { enabled: true, padY: 26, gap: 8, rule: true },
}

export const FRAME_TEMPLATES = [
  {
    ...BASE,
    id: 'none',
    name: 'No Frame',
    blurb: 'Bare map. Nothing but the board.',
    pad: 0,
    frame: 'none',
    header: { enabled: false },
    footer: { enabled: false },
    defaults: { header: off('logo', 'appName', 'matchName', 'subtitle')(HEADER_FIELDS), footer: off()(FOOTER_FIELDS) },
  },
  {
    ...BASE,
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Slim caption bands. Map stays the hero.',
    pad: 0,
    frame: 'hairline',
    accent: '#00E5FF',
    header: { enabled: true, padY: 20, gap: 6, rule: true },
    footer: { enabled: true, padY: 20, gap: 6, rule: true },
    density: 0.94,
    defaults: {
      // The logo stays on here: this is the default template, and an unbranded
      // default export is the wrong first impression. Match name and subtitle
      // are off because "minimal" means slim bands.
      header: off('matchName', 'subtitle')(HEADER_FIELDS),
      footer: off('teamName', 'strategyName')(FOOTER_FIELDS),
    },
  },
  {
    ...BASE,
    id: 'esports',
    name: 'Esports',
    blurb: 'Bold chrome, corner brackets, zone chip.',
    pad: 34,
    frame: 'corners',
    accent: '#FBBF24',
    accent2: '#00E5FF',
    bg: '#060910',
    bandBg: '#0A1020',
    header: { enabled: true, padY: 30, gap: 10, rule: true },
    footer: { enabled: true, padY: 30, gap: 10, rule: true },
    density: 1.06,
    defaults: fullFields(),
  },
  {
    ...BASE,
    id: 'tournament',
    name: 'Tournament',
    blurb: 'Official look. Match-first, double rule.',
    pad: 40,
    frame: 'double',
    accent: '#F59E0B',
    accent2: '#E2E8F0',
    bg: '#05080F',
    bandBg: '#0B1220',
    borderColor: 'rgba(251,191,36,0.45)',
    header: { enabled: true, padY: 32, gap: 10, rule: true },
    footer: { enabled: true, padY: 32, gap: 10, rule: true },
    density: 1.04,
    defaults: {
      header: off('subtitle')(HEADER_FIELDS),
      footer: off('teamName')(FOOTER_FIELDS),
    },
  },
  {
    ...BASE,
    id: 'analyst',
    name: 'Analyst',
    blurb: 'Credits the analyst. Clean cyan rules.',
    pad: 30,
    frame: 'hairline',
    accent: '#00E5FF',
    accent2: '#F8FAFC',
    bg: '#070A0F',
    bandBg: '#0A1220',
    header: { enabled: true, padY: 26, gap: 8, rule: true },
    footer: { enabled: true, padY: 30, gap: 12, rule: true },
    density: 1,
    defaults: {
      header: off('matchName')(HEADER_FIELDS),
      footer: off('mapName')(FOOTER_FIELDS),
    },
  },
  {
    ...BASE,
    id: 'tactical',
    name: 'Tactical',
    blurb: 'Dense intel board. Mono labels, tick marks.',
    pad: 44,
    frame: 'inset',
    accent: '#F97316',
    accent2: '#22D3EE',
    bg: '#04070D',
    bandBg: '#080F1C',
    borderColor: 'rgba(249,115,22,0.40)',
    header: { enabled: true, padY: 28, gap: 12, rule: true },
    footer: { enabled: true, padY: 28, gap: 12, rule: true },
    density: 1,
    defaults: fullFields(),
  },
]

export const DEFAULT_TEMPLATE_ID = 'minimal'

export function getTemplate(id) {
  return FRAME_TEMPLATES.find((t) => t.id === id) || FRAME_TEMPLATES[1]
}

/** Deep-ish copy of a template's default field map, so callers can mutate it. */
export function defaultFieldsFor(templateId) {
  const d = getTemplate(templateId).defaults
  return {
    header: { ...d.header },
    footer: { ...d.footer },
  }
}

// ---------------------------------------------------------------------------
// Text measuring / fitting
// ---------------------------------------------------------------------------

let measureCtx = null
function getMeasureCtx() {
  if (measureCtx) return measureCtx
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  measureCtx = c.getContext('2d')
  return measureCtx
}

const FONT_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace"

/** Build a canvas font string. `size` is already in output pixels. */
export function fontSpec(weight, size, mono = false) {
  return `${weight} ${Math.max(1, Math.round(size))}px ${mono ? MONO_STACK : FONT_STACK}`
}

export function measureText(ctx, text, font) {
  if (!text) return 0
  ctx.font = font
  return ctx.measureText(text).width
}

/**
 * Truncate to fit a single line, appending an ellipsis. Never returns a string
 * wider than `maxWidth` (measured with the same font that will be used to draw
 * it), which is what keeps long team/strategy names from spilling out of the
 * frame.
 */
export function fitText(ctx, text, maxWidth, font) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  ctx.font = font
  if (ctx.measureText(s).width <= maxWidth) return s

  const ell = '…'
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(s.slice(0, mid) + ell).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo <= 0 ? ell : s.slice(0, lo).trimEnd() + ell
}

/**
 * Greedy word wrap. Returns at most `maxLines` lines; the final line is
 * ellipsised if the text did not fit.
 */
export function wrapText(ctx, text, maxWidth, font, maxLines = 2) {
  const s = String(text ?? '').trim()
  if (!s) return []

  ctx.font = font
  const words = s.split(/\s+/)
  const lines = []
  let cur = ''

  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !cur) {
      cur = next
    } else {
      lines.push(cur)
      cur = word
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)

  // If we bailed early the tail is missing — mark the truncation.
  const consumed = lines.join(' ').replace(/\s+/g, ' ').length
  if (consumed < s.replace(/\s+/g, ' ').length) {
    const last = lines.length - 1
    if (last >= 0) lines[last] = fitText(ctx, lines[last] + ' …', maxWidth, font)
    if (lines.length > maxLines) lines.length = maxLines
  }
  return lines
}

// ---------------------------------------------------------------------------
// Metric set — resolved once per layout so measure and draw cannot disagree.
// ---------------------------------------------------------------------------

/**
 * Turns a template into concrete pixel sizes for a given output width.
 * Every value returned here is already multiplied by scaleF.
 */
export function buildMetrics(template, scaleF) {
  const d = template.density ?? 1
  const u = (n) => n * scaleF * d // density-scaled design units
  return {
    scaleF,
    pad: template.pad * scaleF,
    // Horizontal breathing room for band content. This is separate from `pad`
    // (the page border that shrinks the map) because the borderless templates
    // set pad to 0 — without a floor here their logo and text would sit flush
    // against the canvas edge.
    inset: Math.max(template.pad, MIN_BAND_INSET) * scaleF * d,
    padY: template.header.padY * scaleF * d,
    gap: (template.header.gap ?? 8) * scaleF * d,
    logo: 52 * scaleF * d,
    appName: 40 * scaleF * d,
    headerLead: 32 * scaleF * d,
    headerMeta: 24 * scaleF * d,
    footerLead: 34 * scaleF * d,
    footerMeta: 23 * scaleF * d,
    credit: 21 * scaleF * d,
    footerGap: (template.footer.gap ?? 8) * scaleF * d,
    chip: 30 * scaleF * d,
    rule: Math.max(1, Math.round(3 * scaleF)),
    corner: 54 * scaleF,
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Work out how much room the header and footer need.
 *
 * This is intentionally a separate pass from drawing: band height depends on
 * how many lines the text wrapped to, and the wrap depends on the band width,
 * which is already known (it is always the full content width). Running it as
 * its own pass means the canvas can be allocated at exactly the right size
 * before a single pixel is drawn — no clipping, no guessing.
 *
 * `logoBox` is the brand logo's slot (or null). The band that owns it reserves
 * both the height and the horizontal room, which is what guarantees the logo
 * never lands on top of the frame's own text.
 */
export function measureBands(ctx, template, fields, content, bandW, M, logoBox) {
  // `bandW` is the single source of truth for how wide band content may be.
  // It is computed once in computeFrameLayout and reused by drawFrame, so the
  // text can never wrap for one width and then be drawn against another.
  const logoBand = logoBox?.band ?? null
  const logoW = logoBox ? logoBox.w : 0
  const logoH = logoBox ? logoBox.h : 0
  const logoPad = logoBox ? M.gap * 1.4 : 0

  // Width the text may use in a band, after the logo slot is taken out.
  //
  // The two side positions can simply take the logo's width off the end of the
  // band, because the text already starts (or ends) at that end. A centred
  // logo is different: it sits in the middle of the band, so the room has to
  // come out of BOTH columns and the columns have to be re-derived from what is
  // actually left, rather than from the full width.
  const sideReserve = (band) => (logoBand === band ? logoW + logoPad : 0)
  const textBand = (band) => {
    if (logoBand !== band || logoW === 0) return bandW
    if (logoBox.align === 'left' || logoBox.align === 'right') return bandW - logoW - logoPad
    return bandW - logoW - logoPad * 2 // centre: keep clear on both sides
  }

  const headerInner = Math.max(40, textBand('header'))
  const footerInner = Math.max(40, textBand('footer'))
  // With a centred logo, `headerInner` already excludes the slot, so these
  // column widths are the real available widths. With a left/right logo the
  // columns are derived from the full band, exactly as they were before a logo
  // existed, so no logo changes no existing layout.
  const hSide = logoBand === 'header' ? sideReserve('header') : 0
  const fSide = logoBand === 'footer' ? sideReserve('footer') : 0
  const leftCol = Math.max(40, (footerInner - fSide) * 0.56)
  const rightCol = Math.max(40, footerInner - fSide - leftCol)
  const headLeftCol = Math.max(40, (headerInner - hSide) * 0.58)
  const headRightCol = Math.max(40, headerInner - hSide - headLeftCol)

  let headerH = 0
  if (template.header.enabled) {
    const fh = fields.header
    // A custom brand logo replaces the built-in vector mark rather than
    // stacking next to it, so the inline slot is not reserved twice.
    const inlineLogo = fh.logo && logoBand !== 'header'
    let left = inlineLogo ? M.logo + M.gap : 0
    if (fh.appName) left += Math.round(M.appName * 0.62)
    if (fh.mapName) left += Math.round(M.headerMeta * 1.9 + M.chip)

    const rightLines = []
    if (fh.matchName) rightLines.push(...wrapText(ctx, content.matchName, headRightCol, fontSpec(700, M.headerMeta), 2))
    if (fh.subtitle) rightLines.push(...wrapText(ctx, content.subtitle, headRightCol, fontSpec(500, M.headerMeta), 2))
    const rightH = rightLines.length ? rightLines.length * M.headerMeta * 1.32 : M.headerMeta

    const bodyH = Math.max(left > 0 ? (inlineLogo ? M.logo : M.appName) : 0, rightH, logoBand === 'header' ? logoH : 0)
    headerH = Math.round(M.padY * 2 + bodyH + M.gap)
  }

  let footerH = 0
  if (template.footer.enabled) {
    const ff = fields.footer
    const leftLines = []
    if (ff.analystName) leftLines.push(...wrapText(ctx, content.analystName, leftCol, fontSpec(700, M.footerLead), 2))
    if (ff.teamName) leftLines.push(...wrapText(ctx, content.teamName, leftCol, fontSpec(600, M.footerMeta), 2))
    if (ff.strategyName) leftLines.push(...wrapText(ctx, content.strategyName, leftCol, fontSpec(600, M.footerMeta), 2))

    const rightLines = []
    if (ff.mapName) rightLines.push(fitText(ctx, content.mapName, rightCol, fontSpec(800, M.footerLead)))
    if (ff.zoneCount) rightLines.push(fitText(ctx, zoneCountLabel(content), rightCol, fontSpec(700, M.footerMeta, true)))
    if (ff.dateTime) rightLines.push(fitText(ctx, content.dateTime, rightCol, fontSpec(600, M.footerMeta, true)))

    const colH = Math.max(
      leftLines.length * M.footerMeta * 1.4,
      rightLines.length * M.footerMeta * 1.4,
      logoBand === 'footer' ? logoH + M.footerMeta * 0.4 : 0,
    )
    const creditH = ff.credit ? M.credit * 1.7 : 0
    footerH = Math.round(M.padY * 2 + colH + (creditH ? creditH + M.footerGap : 0))
  }

  return { headerH, footerH, headerInner, footerInner, leftCol, rightCol, headLeftCol, headRightCol }
}

function zoneCountLabel(content) {
  const n = Number(content.zoneCount) || 0
  return `${n} ${n === 1 ? 'ZONE' : 'ZONES'}`
}

/**
 * Full layout for one export. `contentAspect` is the width/height ratio of the
 * map area: 1 for the 1:1 square format, or the editor viewport ratio for
 * "current view".
 *
 * The brand logo's slot depends on band height, and band height depends on the
 * slot, so this iterates to a fixed point (at most a couple of rounds — the
 * sizes converge immediately in practice). Both `measureBands` and `drawFrame`
 * read the converged values from the returned layout, so they cannot disagree.
 */
export function computeFrameLayout({ template, fields, content, outputWidth, contentAspect = 1, logo = null }) {
  const scaleF = outputWidth / DESIGN_WIDTH
  const M = buildMetrics(template, scaleF)
  const ctx = getMeasureCtx()

  // Canvas dimensions are integers. If the frame padding or the aspect-derived
  // height stayed fractional the browser would silently truncate them, cropping
  // the last band and shifting every rule by a sub-pixel. Round the geometry
  // here, once, so the frame drawing and the map rect agree exactly.
  const pad = Math.round(M.pad)
  const contentW = Math.round(outputWidth - M.pad * 2)
  const contentH = Math.max(1, Math.round(contentW * contentAspect))
  // Width available to header/footer content, after the side margin.
  const inset = Math.round(M.inset)
  const bandW = Math.max(1, outputWidth - inset * 2)

  // How far in from the canvas edge the frame's own border reaches. This
  // mirrors the border painting in drawFrame(): the brand logo has to stay
  // clear of it, otherwise a large logo would sit on top of the border line.
  // Templates with pad 0 draw no border at all, so their gutter is 0.
  const bx = pad / 2
  const gutter = template.frame === 'none' || pad <= 0
    ? 0
    : Math.round((template.frame === 'corners' ? bx + M.corner : bx + M.gap * 1.4) + M.rule)

  let logoBox = null
  let bands = measureBands(ctx, template, fields, content, bandW, M, null)
  if (logo && logo.img) {
    for (let pass = 0; pass < 3; pass++) {
      const next = computeLogoBox(
        // `inset` and `gutter` must be here, not just on the final layout: the
        // logo box is clamped clear of the frame's border, and this provisional
        // object is what that clamp reads.
        { width: outputWidth, height: bands.headerH + pad + contentH + pad + bands.footerH, headerH: bands.headerH, footerH: bands.footerH, inset, gutter },
        logo,
        M.logo,
      )
      if (!next) break
      const after = measureBands(ctx, template, fields, content, bandW, M, next)
      const converged = after.headerH === bands.headerH && after.footerH === bands.footerH
      logoBox = next
      bands = after
      if (converged) break
    }
  }

  const { headerH, footerH } = bands
  const mapY = headerH + pad
  const totalH = Math.round(mapY + contentH + pad + footerH)
  return {
    width: outputWidth,
    height: totalH,
    // The map rectangle. Everything else must stay outside it.
    mapX: pad,
    mapY,
    mapW: contentW,
    mapH: contentH,
    contentW,
    headerH,
    footerH,
    pad,
    inset,
    bandW,
    gutter,
    logoBox,
    metrics: M,
    scaleF,
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** The app emblem, drawn as vectors so it needs no asset and no network. */
function drawLogo(ctx, x, y, size) {
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, '#FBBF24')
  g.addColorStop(0.55, '#F59E0B')
  g.addColorStop(1, '#D97706')

  roundRect(ctx, x, y, size, size, size * 0.26)
  ctx.fillStyle = g
  ctx.fill()

  ctx.fillStyle = '#0B1120'
  ctx.font = fontSpec(900, size * 0.62)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', x + size / 2, y + size * 0.54)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawCornerBrackets(ctx, x, y, w, h, len, color, lw) {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'square'
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + sy * len)
    ctx.stroke()
  }
}

/**
 * Paint the frame. Guaranteed never to touch `layout.mapX/mapY/mapW/mapH`
 * except for the two 1px rules that sit exactly on the map's outer edge.
 *
 * `logo` is the optional brand logo (`{ img, size, opacity, position }`).
 * When present it replaces the built-in vector mark — the two never draw
 * together, and the band that hosts it has already reserved the room.
 */
export function drawFrame(ctx, layout, { template, fields, content, logo = null }) {
  const { width, height, headerH, footerH, pad, metrics: M } = layout
  const fh = fields.header
  const ff = fields.footer
  const logoBox = layout.logoBox
  const logoInfo = logoBox ? { band: logoBox.band, align: logoBox.align } : null
  const logoW = logoBox ? logoBox.w : 0
  const logoPad = logoBox ? M.gap * 1.4 : 0

  // --- page background ---
  ctx.fillStyle = template.bg
  ctx.fillRect(0, 0, width, height)

  // --- band backgrounds ---
  if (headerH > 0) {
    ctx.fillStyle = template.bandBg
    ctx.fillRect(0, 0, width, headerH)
  }
  if (footerH > 0) {
    ctx.fillStyle = template.bandBg
    ctx.fillRect(0, height - footerH, width, footerH)
  }

  // Shared with measureBands via the layout, so wrapping and drawing agree.
  const inset = layout.inset
  const innerW = layout.bandW

  // ================= HEADER =================
  if (headerH > 0) {
    const cy = headerH / 2
    // Start after the brand logo when it is anchored left in this band.
    const logoOnLeft = logoInfo?.band === 'header' && logoInfo.align === 'left'
    const logoOnRight = logoInfo?.band === 'header' && logoInfo.align === 'right'
    const logoOnCenter = logoInfo?.band === 'header' && logoInfo.align === 'center'
    const headerSideReserve = logoOnLeft || logoOnRight ? logoW + logoPad : 0
    // Left cluster (app name + map chip) ends before the band midpoint; the
    // right cluster is right-aligned. A centred logo owns the middle, so both
    // clusters are re-derived from the space either side of it.
    const headLeftColW = Math.max(40, (innerW - headerSideReserve) * 0.58)
    const headRightColW = Math.max(40, innerW - headerSideReserve - headLeftColW)
    let x = inset + (logoOnLeft ? logoW + logoPad : 0)

    // The built-in vector mark is skipped when a custom brand logo occupies
    // this band, so the two are never stacked.
    if (fh.logo && !logoInfo) {
      drawLogo(ctx, x, cy - M.logo / 2, M.logo)
      x += M.logo + M.gap
    }

    if (fh.appName) {
      ctx.fillStyle = '#F8FAFC'
      ctx.font = fontSpec(900, M.appName)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      const appMax = Math.max(24, headLeftColW * 0.62)
      ctx.fillText(fitText(ctx, content.appName, appMax, fontSpec(900, M.appName)), x, cy + M.appName * 0.35)
      x += Math.min(measureText(ctx, content.appName, fontSpec(900, M.appName)), appMax) + M.gap
    }

    if (fh.mapName) {
      const chipText = String(content.mapName || '').toUpperCase()
      const chipFont = fontSpec(800, M.headerMeta, true)
      const tw = measureText(ctx, chipText, chipFont)
      const chipW = tw + M.chip * 1.1
      const chipH = M.headerMeta * 1.9
      roundRect(ctx, x, cy - chipH / 2, chipW, chipH, chipH / 2)
      ctx.fillStyle = hexA(template.accent, 0.14)
      ctx.fill()
      ctx.strokeStyle = hexA(template.accent, 0.5)
      ctx.lineWidth = M.rule
      ctx.stroke()
      ctx.fillStyle = template.accent
      ctx.font = chipFont
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(fitText(ctx, chipText, chipW - M.chip, chipFont), x + M.chip * 0.55, cy + 1)
      ctx.textBaseline = 'alphabetic'
    }

    // Right column: match name + subtitle, right-aligned.
    const rightX = inset + innerW - (logoOnRight ? logoW + logoPad : 0)
    const rightColW = headRightColW
    const rLines = []
    if (fh.matchName) rLines.push({ text: content.matchName, font: fontSpec(700, M.headerMeta), color: '#E2E8F0' })
    if (fh.subtitle) rLines.push({ text: content.subtitle, font: fontSpec(500, M.headerMeta), color: 'rgba(148,163,184,0.95)' })

    if (rLines.length) {
      const lh = M.headerMeta * 1.34
      let ty = cy - ((rLines.length - 1) * lh) / 2 + M.headerMeta * 0.35
      ctx.textAlign = 'right'
      for (const line of rLines) {
        ctx.font = line.font
        ctx.fillStyle = line.color
        ctx.fillText(fitText(ctx, line.text, rightColW, line.font), rightX, ty)
        ty += lh
      }
      ctx.textAlign = 'left'
    }

    if (template.header.rule) {
      ctx.fillStyle = template.accent
      ctx.fillRect(0, headerH - M.rule, width, M.rule)
    }
  }

  // ================= FOOTER =================
  if (footerH > 0) {
    const fy = height - footerH
    const logoOnLeft = logoInfo?.band === 'footer' && logoInfo.align === 'left'
    const logoOnRight = logoInfo?.band === 'footer' && logoInfo.align === 'right'
    const logoOnCenter = logoInfo?.band === 'footer' && logoInfo.align === 'center'
    const footerSideReserve = logoOnLeft || logoOnRight ? logoW + logoPad : 0
    const footerInnerW = Math.max(40, innerW - footerSideReserve - (logoOnCenter ? logoW + logoPad * 2 : 0))
    const leftColW = footerInnerW * 0.56
    const rightColW = footerInnerW - leftColW
    const lh = M.footerMeta * 1.42
    const rightX = inset + innerW - (logoOnRight ? logoW + logoPad : 0)
    const leftX2 = inset + (logoOnLeft ? logoW + logoPad : 0)

    const leftRows = []
    if (ff.analystName) leftRows.push({ text: content.analystName, font: fontSpec(800, M.footerLead), color: '#FBBF24' })
    if (ff.teamName) leftRows.push({ text: content.teamName, font: fontSpec(600, M.footerMeta), color: '#E2E8F0' })
    if (ff.strategyName) leftRows.push({ text: content.strategyName, font: fontSpec(600, M.footerMeta), color: 'rgba(203,213,225,0.9)' })

    const rightRows = []
    if (ff.mapName) rightRows.push({ text: String(content.mapName || '').toUpperCase(), font: fontSpec(900, M.footerLead), color: '#FFFFFF', mono: true })
    if (ff.zoneCount) rightRows.push({ text: zoneCountLabel(content), font: fontSpec(700, M.footerMeta, true), color: template.accent, mono: true })
    if (ff.dateTime) rightRows.push({ text: content.dateTime, font: fontSpec(600, M.footerMeta, true), color: 'rgba(148,163,184,0.9)', mono: true })

    let ty = fy + M.padY + M.footerMeta

    // left column
    for (const r of leftRows) {
      ctx.font = r.font
      ctx.fillStyle = r.color
      ctx.textAlign = 'left'
      ctx.fillText(fitText(ctx, r.text, leftColW - M.gap, r.font), leftX2, ty)
      ty += lh
    }

    // right column
    ty = fy + M.padY + M.footerMeta
    ctx.textAlign = 'right'
    for (const r of rightRows) {
      ctx.font = r.font
      ctx.fillStyle = r.color
      ctx.fillText(fitText(ctx, r.text, rightColW - M.gap, r.font), rightX, ty)
      ty += lh
    }
    ctx.textAlign = 'left'

    if (ff.credit) {
      ctx.font = fontSpec(600, M.credit)
      ctx.fillStyle = 'rgba(148,163,184,0.7)'
      ctx.textAlign = 'left'
      const creditW = logoOnCenter ? innerW - logoW - logoPad * 2 : innerW
      ctx.fillText(fitText(ctx, CREDIT_TEXT, creditW, fontSpec(600, M.credit)), leftX2, height - M.padY * 0.55)
    }

    if (template.footer.rule) {
      ctx.fillStyle = template.accent
      ctx.fillRect(0, fy, width, M.rule)
    }
  }

  // ================= BRAND LOGO =================
  // Drawn after the bands so it sits above them, but its slot was reserved
  // during measurement, so it can never overlap the frame's own text.
  //
  // Sharpness: the logo is drawn straight onto the full-resolution export
  // canvas at its final device-pixel size. It is never rendered into a small
  // canvas and scaled up, which is what makes it look crisp at 2048px.
  if (logoBox && logo && logo.img) {
    const prevAlpha = ctx.globalAlpha
    ctx.globalAlpha = Math.max(0, Math.min(1, logo.opacity ?? 1)) * prevAlpha
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    try {
      ctx.drawImage(logo.img, logoBox.x, logoBox.y, logoBox.w, logoBox.h)
    } catch {
      // A corrupt image must not take the whole export down; the frame and the
      // map are still worth saving without it.
    }
    ctx.globalAlpha = prevAlpha
  }

  // ================= BORDER / DECORATION =================
  // Drawn last so it sits above the bands, but still entirely in the pad gutter.
  if (template.frame !== 'none' && pad > 0) {
    const bx = pad / 2
    const bw = width - pad
    const bh = height - pad
    if (template.frame === 'hairline') {
      ctx.strokeStyle = template.borderColor
      ctx.lineWidth = M.rule
      ctx.strokeRect(bx, bx, bw, bh)
    } else if (template.frame === 'inset') {
      ctx.strokeStyle = template.borderColor
      ctx.lineWidth = M.rule
      ctx.strokeRect(bx, bx, bw, bh)
      ctx.strokeStyle = hexA(template.accent, 0.35)
      ctx.lineWidth = M.rule
      ctx.strokeRect(bx + M.gap, bx + M.gap, bw - M.gap * 2, bh - M.gap * 2)
    } else if (template.frame === 'double') {
      ctx.strokeStyle = template.borderColor
      ctx.lineWidth = M.rule
      ctx.strokeRect(bx, bx, bw, bh)
      ctx.strokeStyle = hexA(template.accent, 0.5)
      ctx.lineWidth = M.rule
      ctx.strokeRect(bx + M.gap * 1.4, bx + M.gap * 1.4, bw - M.gap * 2.8, bh - M.gap * 2.8)
    } else if (template.frame === 'corners') {
      drawCornerBrackets(ctx, bx, bx, bw, bh, M.corner, template.accent, M.rule * 1.5)
    }
  }
}

/** '#RRGGBB' + alpha -> 'rgba(...)'. Falls back to the input for named colors. */
function hexA(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

/** "27 Sep 2026, 14:32" — stable, locale-independent, no timezone surprises. */
export function formatDateTime(ts) {
  const d = new Date(ts)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Fill in every field a template might ask for, so callers never pass undefined. */
export function normalizeContent(partial = {}) {
  return {
    appName: partial.appName || APP_NAME,
    mapName: partial.mapName || '',
    matchName: partial.matchName || '',
    subtitle: partial.subtitle || '',
    analystName: partial.analystName || '',
    teamName: partial.teamName || '',
    strategyName: partial.strategyName || '',
    zoneCount: partial.zoneCount ?? 0,
    dateTime: partial.dateTime || '',
  }
}
