// ============================================================================
// BRAND LOGO — the frame/branding layer's own logo
// ============================================================================
//
// IMPORTANT DISTINCTION
// This is NOT the team-logo system. Team logos live in `annos` as tactical
// markers placed on the map by the user, and are part of the board document
// (saved, shared, exported with the drawing). The brand logo here belongs to
// the export frame only: it is a piece of chrome baked into the header or
// footer band. The two never meet — nothing in this file touches `annos`,
// `circles`, the share link, or the board document.
//
// Everything is browser-local. The file is read with FileReader into a data
// URL and kept in localStorage. Nothing is uploaded; this project has no
// backend.
//
// Data URLs are same-origin, so drawing one into the export canvas does NOT
// taint it and `toBlob()` will not throw. (That is the failure mode AGENTS.md
// warns about for remote team logos.)
// ============================================================================

export const BRAND_LOGO_KEY = 'bgmi.brandLogo.v1'

/** Anchor points offered in the export dialog. */
export const LOGO_POSITIONS = [
  { id: 'top-left', label: 'Top Left', band: 'header', align: 'left' },
  { id: 'top-center', label: 'Top Center', band: 'header', align: 'center' },
  { id: 'top-right', label: 'Top Right', band: 'header', align: 'right' },
  { id: 'bottom-left', label: 'Bottom Left', band: 'footer', align: 'left' },
  { id: 'bottom-center', label: 'Bottom Center', band: 'footer', align: 'center' },
  { id: 'bottom-right', label: 'Bottom Right', band: 'footer', align: 'right' },
]

export const LOGO_POSITION_IDS = LOGO_POSITIONS.map((p) => p.id)

/** Size slider range, as a multiplier on the frame's base logo slot. */
export const LOGO_SIZE_MIN = 0.5
export const LOGO_SIZE_MAX = 2.5
export const LOGO_SIZE_DEFAULT = 1

/** Formats we can actually rasterise into a canvas reliably. */
const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']

/**
 * Base64 inflates by 4/3 and localStorage is typically ~5 MB for the whole
 * origin, so cap the encoded length rather than the file length.
 */
export const MAX_ENCODED_CHARS = 3_400_000

/** Below this the logo will look soft once scaled up in a 2048px export. */
export const MIN_SOURCE_PX = 128

export const DEFAULT_BRAND_LOGO = {
  dataUrl: null,
  name: '',
  mime: '',
  width: 0,
  height: 0,
  position: 'top-left',
  size: LOGO_SIZE_DEFAULT,
  opacity: 1,
}

export function positionInfo(id) {
  return LOGO_POSITIONS.find((p) => p.id === id) || LOGO_POSITIONS[0]
}

/** Coerce anything (localStorage, a fresh default, a partial update) into a valid shape. */
export function normalizeLogoSettings(partial = {}) {
  const pos = LOGO_POSITION_IDS.includes(partial.position) ? partial.position : DEFAULT_BRAND_LOGO.position
  const size = Number(partial.size)
  const opacity = Number(partial.opacity)
  return {
    dataUrl: typeof partial.dataUrl === 'string' && partial.dataUrl.startsWith('data:image/') ? partial.dataUrl : null,
    name: typeof partial.name === 'string' ? partial.name : '',
    mime: typeof partial.mime === 'string' ? partial.mime : '',
    width: Number(partial.width) || 0,
    height: Number(partial.height) || 0,
    position: pos,
    size: Number.isFinite(size) ? Math.min(LOGO_SIZE_MAX, Math.max(LOGO_SIZE_MIN, size)) : LOGO_SIZE_DEFAULT,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check a picked file before reading it. Returns `{ ok, error }`.
 *
 * The type check trusts the extension as well as the MIME string because some
 * browsers hand back an empty `type` for `.svg`.
 */
export function validateLogoFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' }

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const mimeOk = ACCEPTED_MIME.includes(file.type)
  const extOk = ACCEPTED_EXT.includes(ext)
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: `Unsupported format${file.type ? ` (${file.type})` : ''}. Use PNG, SVG, JPG or WebP.`,
    }
  }
  return { ok: true, error: null }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function readBrandLogo() {
  try {
    const raw = localStorage.getItem(BRAND_LOGO_KEY)
    if (!raw) return { ...DEFAULT_BRAND_LOGO }
    return normalizeLogoSettings(JSON.parse(raw))
  } catch {
    // Corrupt or unavailable storage must never break the export dialog.
    return { ...DEFAULT_BRAND_LOGO }
  }
}

export function writeBrandLogo(settings) {
  const clean = normalizeLogoSettings(settings)
  try {
    if (!clean.dataUrl) localStorage.removeItem(BRAND_LOGO_KEY)
    else localStorage.setItem(BRAND_LOGO_KEY, JSON.stringify(clean))
    return { ok: true, error: null }
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)
    return {
      ok: false,
      error: quota
        ? 'That logo is too large to store locally. Try a smaller PNG or an SVG.'
        : 'Could not save the logo in this browser.',
    }
  }
}

export function clearBrandLogo() {
  try {
    localStorage.removeItem(BRAND_LOGO_KEY)
  } catch {
    /* nothing to do */
  }
  return { ...DEFAULT_BRAND_LOGO }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * SVGs with no width/height attribute have no intrinsic size, and some browsers
 * then refuse to rasterise them into a canvas. Give them one from the viewBox
 * so they behave like a raster image.
 */
function ensureSvgIntrinsicSize(svgText) {
  if (/<svg[^>]*\bwidth\s*=/i.test(svgText)) return svgText
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i.exec(svgText)
  if (!vb) return svgText
  const w = Math.max(1, Math.round(parseFloat(vb[1])))
  const h = Math.max(1, Math.round(parseFloat(vb[2])))
  return svgText.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`)
}

const imageCache = new Map()

/**
 * Decode a data URL into a fully-loaded HTMLImageElement.
 *
 * The export MUST NOT draw an image that is still loading — `drawImage` with an
 * incomplete image is a silent no-op, which would ship an export with a missing
 * logo and no error. Everything that composes an export awaits this first.
 */
export async function loadLogoImage(dataUrl) {
  if (!dataUrl) return null
  if (imageCache.has(dataUrl)) return imageCache.get(dataUrl)

  const img = new Image()
  img.decoding = 'async'

  const isSvg = dataUrl.startsWith('data:image/svg+xml')
  const src = isSvg ? await fixSvgDataUrl(dataUrl) : dataUrl

  const p = new Promise((resolve) => {
    const done = (val) => resolve(val)
    img.onload = () => {
      // `decode()` forces the bitmap to be ready, not merely the fetch.
      if (img.decode) img.decode().then(() => done(img), () => done(img))
      else done(img)
    }
    img.onerror = () => done(null)
    img.src = src
  })

  imageCache.set(dataUrl, p)
  return p
}

async function fixSvgDataUrl(dataUrl) {
  try {
    const text = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
    const patched = ensureSvgIntrinsicSize(text)
    if (patched === text) return dataUrl
    return `data:image/svg+xml;base64,${btoa(patched)}`
  } catch {
    return dataUrl
  }
}

/** Read a File into a data URL. Local only — no network involved. */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(new Error('Could not read that file.'))
    fr.readAsDataURL(file)
  })
}

/**
 * Turn a picked File into storable settings, validating along the way.
 * Returns `{ ok, settings, error, warning }`.
 */
export async function settingsFromFile(file, current = DEFAULT_BRAND_LOGO) {
  const v = validateLogoFile(file)
  if (!v.ok) return { ok: false, error: v.error, warning: null }

  let dataUrl
  try {
    dataUrl = await readFileAsDataUrl(file)
  } catch (e) {
    return { ok: false, error: e.message, warning: null }
  }

  if (dataUrl.length > MAX_ENCODED_CHARS) {
    return {
      ok: false,
      error: 'That logo is too large to store locally. Try a smaller PNG or an SVG.',
      warning: null,
    }
  }

  // Decode to learn the real pixel size, and to fail early on a corrupt file.
  const img = await loadLogoImage(dataUrl)
  if (!img || !img.naturalWidth) {
    return { ok: false, error: 'That file could not be read as an image.', warning: null }
  }

  const settings = normalizeLogoSettings({
    ...current,
    dataUrl,
    name: file.name,
    mime: file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : ''),
    width: img.naturalWidth,
    height: img.naturalHeight,
  })

  const isVector = settings.mime === 'image/svg+xml'
  const warning =
    !isVector && Math.min(img.naturalWidth, img.naturalHeight) < MIN_SOURCE_PX
      ? `Only ${img.naturalWidth}×${img.naturalHeight}px — it may look soft in a 2048px export. An SVG stays sharp at any size.`
      : null

  return { ok: true, settings, error: null, warning }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Where the logo sits inside a frame layout, in output pixels.
 *
 * Returns `null` when there is no logo, so callers can treat "no logo" as the
 * same code path as "no box". `base` is the frame's own logo slot size; the
 * user's size slider multiplies it.
 *
 * The box is placed inside the band that owns the chosen position, and is
 * returned to the layout so the band can reserve room for it — that reservation
 * is what stops the logo from ever landing on top of the frame's own text.
 */
export function computeLogoBox(layout, logo, base) {
  if (!logo || !logo.img) return null
  const { band, align } = positionInfo(logo.position)
  const bandH = band === 'header' ? layout.headerH : layout.footerH
  if (bandH <= 0) return null

  // The logo must not sit on the frame's own border. The border reaches
  // `layout.gutter` pixels in from the canvas edge on the outer side of a band
  // (the top of the header, the bottom of the footer), so that edge gets the
  // full gutter as clearance while the inner edge — bounded by the band rule —
  // only needs a hair of breathing room. Working against this real clear space
  // is what keeps the logo off the border line without shrinking it needlessly.
  const GAP = 6
  const outer = (layout.gutter ?? 0) + GAP
  const bandTop = band === 'header' ? 0 : layout.height - layout.footerH
  const availH = Math.max(8, bandH - outer - GAP)

  // Fit the source aspect ratio into the slot, then apply the size multiplier.
  const target = base * (logo.size ?? LOGO_SIZE_DEFAULT)
  const ar = logo.img.naturalWidth && logo.img.naturalHeight
    ? logo.img.naturalWidth / logo.img.naturalHeight
    : 1
  let w = target
  let h = target / ar
  // The 0.9 ceiling is a safety limit, not the normal case. `measureBands`
  // sizes the band to include the logo, so asking for a bigger logo grows the
  // band and the two settle at a fixed point. The ceiling only catches the
  // genuinely absurd case where the band cannot grow any further.
  const maxH = availH * 0.9
  if (h > maxH) {
    h = maxH
    w = h * ar
  }

  const left = layout.inset
  const right = layout.width - layout.inset
  const usable = right - left
  if (w > usable) {
    // Absurdly large setting on a narrow export: clamp rather than overflow.
    w = usable
    h = w / ar
  }

  let x
  if (align === 'left') x = left
  else if (align === 'right') x = right - w
  else x = left + (usable - w) / 2

  // Vertically centred in the room that is actually free, then clamped so the
  // box can never reach into the border at the outer edge of the band.
  let y = bandTop + (bandH - h) / 2
  y = Math.max(bandTop + outer, y)
  y = Math.min(bandTop + bandH - GAP - h, y)

  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), band, align }
}
