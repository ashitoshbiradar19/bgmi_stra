import { MAP_TOURNAMENT_CONFIGS } from '../data/tournament'
import { getTeam } from '../data/teams'

export const STAGE_RADII = [2280, 1485, 740, 370, 185, 92.5, 46, 23]
export const STAGE_DIAMETERS = [4560, 2970, 1480, 740, 370, 185, 92, 46]
export const STAGE_COLORS = ['#FFFFFF', '#00E5FF', '#10B981', '#FACC15', '#F97316', '#FF5722', '#EF4444', '#DC2626']
export const FLIGHT_CORRIDOR_HALF = 750 // 1.5km total width (750m left + 750m right)

export function computeView(w, h, mapSize, zoom = 1) {
  const ppm = Math.min(w, h) / mapSize
  return { ppm, zoom, ox: (w - mapSize * ppm * zoom) / 2, oy: (h - mapSize * ppm * zoom) / 2 }
}

export function containmentViolation(c, circles) {
  if (c.stage <= 1) return false
  const ancestors = circles.filter((o) => o.stage < c.stage && o.id !== c.id)
  if (!ancestors.length) return false
  for (const parent of ancestors) {
    const dist = Math.hypot(c.x - parent.x, c.y - parent.y)
    if (dist + c.r > parent.r + 0.1) {
      return true
    }
  }
  return false
}

export function isOutOfBounds(c, mapSize) {
  const m = c.r * 0.1
  return c.x - c.r < -m || c.y - c.r < -m || c.x + c.r > mapSize + m || c.y + c.r > mapSize + m
}

export function getReachableCompounds(flightAnno, pois = []) {
  if (!flightAnno || !flightAnno.points || flightAnno.points.length < 2) return []
  const [p0, p1] = flightAnno.points
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len

  return pois.map((poi) => {
    const name = Array.isArray(poi) ? poi[0] : poi.name
    const x = Array.isArray(poi) ? poi[1] : poi.x
    const y = Array.isArray(poi) ? poi[2] : poi.y
    const desc = Array.isArray(poi) ? poi[3] : poi.desc || ''
    const vx = x - p0[0]
    const vy = y - p0[1]
    const proj = vx * ux + vy * uy
    const clampedProj = Math.min(len, Math.max(0, proj))
    const projX = p0[0] + ux * clampedProj
    const projY = p0[1] + uy * clampedProj
    const dist = Math.round(Math.hypot(x - projX, y - projY))
    const reachable = dist <= 1800
    return { name, x, y, desc, dist, reachable }
  }).sort((a, b) => a.dist - b.dist)
}

const fmtR = (r) => (r >= 100 ? `${Math.round(r)}m` : `${r % 1 ? r.toFixed(1) : r}m`)

const hexA = (hex, a) => {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

const gridCoordLabel = (i) => String.fromCharCode(65 + (i % 26))

function arrowHead(ctx, p, q, size = 16, S = 1) {
  const sz = Math.max(16, size * S)
  const ang = Math.atan2(q[1] - p[1], q[0] - p[0])
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(q[0], q[1])
  ctx.lineTo(q[0] - sz * Math.cos(ang - 0.42), q[1] - sz * Math.sin(ang - 0.42))
  ctx.lineTo(q[0] - sz * Math.cos(ang + 0.42), q[1] - sz * Math.sin(ang + 0.42))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function planeGlyph(ctx, x, y, ang, color, S = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  
  ctx.fillStyle = color
  ctx.strokeStyle = '#070a0f'
  ctx.lineWidth = Math.max(1.5, 1.5 * S)
  
  ctx.beginPath()
  ctx.moveTo(20 * S, 0)
  ctx.lineTo(-2 * S, 22 * S)
  ctx.lineTo(-6 * S, 7 * S)
  ctx.lineTo(-20 * S, 11 * S)
  ctx.lineTo(-16 * S, 0)
  ctx.lineTo(-20 * S, -11 * S)
  ctx.lineTo(-6 * S, -7 * S)
  ctx.lineTo(-2 * S, -22 * S)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(8 * S, 0, 4 * S, 2 * S, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.restore()
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.rect(x, y, w, h)
}

function label(ctx, text, x, y, color, bg = 'rgba(7,10,15,0.92)', fontSize = 11, S = 1) {
  const fontPx = Math.max(11, Math.round(fontSize * S))
  ctx.font = `800 ${fontPx}px Inter, system-ui, sans-serif`
  const tw = ctx.measureText(text).width
  const padX = 6 * S
  const padY = 9 * S
  const h = 18 * S

  ctx.fillStyle = bg
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.0, 1.0 * S)
  ctx.beginPath()
  roundRectPath(ctx, x - tw / 2 - padX, y - padY, tw + padX * 2, h, 4 * S)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 0.5 * S)
}

function drawPin(ctx, x, y, txt, color, S = 1) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x, y + 2 * S, 8 * S, 3.5 * S, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fill()

  ctx.strokeStyle = 'rgba(2,6,12,0.9)'
  ctx.lineWidth = Math.max(3.5, 3.5 * S)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - 14 * S)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y - 18 * S, 7.5 * S, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, 1.5 * S)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  label(ctx, txt, x, y + 15 * S, '#ffffff', 'rgba(7,10,15,0.92)', 11, S)
  ctx.restore()
}

function drawVehicle(ctx, x, y, open, S = 1) {
  const s = 12 * S
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = open ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.3)'
  ctx.strokeStyle = open ? '#10b981' : '#64748b'
  ctx.lineWidth = Math.max(2.0, 2.0 * S)
  ctx.beginPath()
  roundRectPath(ctx, -s, -s, s * 2, s * 2, 4 * S)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = open ? '#34d399' : '#94a3b8'
  ctx.beginPath()
  roundRectPath(ctx, -7 * S, -4 * S, 14 * S, 8 * S, 2 * S)
  ctx.fill()
  ctx.beginPath()
  roundRectPath(ctx, -5 * S, -7 * S, 10 * S, 5 * S, 2 * S)
  ctx.fill()

  if (open) {
    ctx.font = `900 ${Math.max(9, Math.round(9 * S))}px Inter, sans-serif`
    ctx.fillStyle = '#34d399'
    ctx.textAlign = 'center'
    ctx.fillText('SPAWN', 0, -s - 4 * S)
  }
  ctx.restore()
}

// In-memory cache for team logo images (keyed by logoUrl) so exports & live
// render only fetch once per session instead of every frame.
const teamLogoCache = new Map()

// Draws a distinct colored vector emblem (rounded square) for a team on the map.
// If the team has a custom emblem (by id) we draw it; otherwise a colorful
// monogram plate is used. A real logo image (a.logoUrl) always takes priority.
function drawEmblem(ctx, x, y, k, team) {
  const color = team.color || '#facc15'
  const color2 = team.color2 || '#0f172a'
  const short = (team.short || team.name || 'T').slice(0, 3).toUpperCase()
  const id = team.id || ''

  // Backing plate with brand gradient
  const plate = ctx.createLinearGradient(x - 16 * k, y - 18 * k, x + 16 * k, y + 18 * k)
  plate.addColorStop(0, color2)
  plate.addColorStop(1, '#0a0a0f')
  ctx.beginPath()
  roundRectPath(ctx, x - 16 * k, y - 18 * k, 32 * k, 32 * k, 8 * k)
  ctx.fillStyle = plate
  ctx.fill()
  ctx.lineWidth = Math.max(2.5, 2.5 * k)
  ctx.strokeStyle = color
  ctx.stroke()

  const c = (s) => s * k // size-aware scale helper
  const W = 15 * k // emblem half-width

  // ---- Distinct vector emblems for the well-known orgs ----
  switch (id) {
    case 'orangutan': {
      // Orange orangutan face
      ctx.fillStyle = '#ff7a00'
      ctx.beginPath()
      ctx.arc(x, y - 2 * k, W, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffb066'
      ctx.beginPath()
      ctx.ellipse(x, y - 6 * k, 7 * k, 5 * k, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1a24'
      ctx.beginPath()
      ctx.arc(x - 5 * k, y - 2 * k, 1.6 * k, 0, Math.PI * 2)
      ctx.arc(x + 5 * k, y - 2 * k, 1.6 * k, 0, Math.PI * 2)
      ctx.fill()
      // nostrils
      ctx.beginPath()
      ctx.ellipse(x - 1.5 * k, y + 1 * k, 1 * k, 1.2 * k, 0, 0, Math.PI * 2)
      ctx.ellipse(x + 1.5 * k, y + 1 * k, 1 * k, 1.2 * k, 0, 0, Math.PI * 2)
      ctx.fill()
      // mouth grin
      ctx.strokeStyle = '#1a1a24'
      ctx.lineWidth = Math.max(1.2, 1.2 * k)
      ctx.beginPath()
      ctx.arc(x, y + 2 * k, 4 * k, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
      // ears
      ctx.fillStyle = '#ff7a00'
      ctx.beginPath()
      ctx.arc(x - 11 * k, y - 2 * k, 3.5 * k, 0, Math.PI * 2)
      ctx.arc(x + 11 * k, y - 2 * k, 3.5 * k, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'godlike': {
      // Stylized red "G" emblem on black
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, W * 1.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color2
      ctx.font = `900 ${Math.max(16, Math.round(20 * k))}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('G', x, y + 1 * k)
      // red halo ring
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1.6, 1.6 * k)
      ctx.beginPath()
      ctx.arc(x, y, W + 2 * k, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'soul':
    case '_soullogo': {
      // Soul "demon" emblem — dark red horned pentagram head
      ctx.fillStyle = color2
      ctx.beginPath()
      ctx.arc(x, y, W, 0, Math.PI * 2)
      ctx.fill()
      // two horns
      ctx.fillStyle = '#e63946'
      ctx.beginPath()
      ctx.moveTo(x - 8 * k, y - 8 * k)
      ctx.quadraticCurveTo(x - 12 * k, y - 18 * k, x - 3 * k, y - 12 * k)
      ctx.lineTo(x - 4 * k, y - 7 * k)
      ctx.moveTo(x + 8 * k, y - 8 * k)
      ctx.quadraticCurveTo(x + 12 * k, y - 18 * k, x + 3 * k, y - 12 * k)
      ctx.lineTo(x + 4 * k, y - 7 * k)
      ctx.fill()
      // pentagram
      ctx.strokeStyle = '#e63946'
      ctx.lineWidth = Math.max(2, 2 * k)
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        const a2 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 5
        const a3 = -Math.PI / 2 + ((i + 2) * 2 * Math.PI) / 5
        const px1 = x + 7 * k * Math.cos(a1)
        const py1 = y + 7 * k * Math.sin(a1)
        const px2 = x + 7 * k * Math.cos(a2)
        const py2 = y + 7 * k * Math.sin(a2)
        const px3 = x + 7 * k * Math.cos(a3)
        const py3 = y + 7 * k * Math.sin(a3)
        if (i === 0) ctx.moveTo(px1, py1)
        ctx.lineTo(px3, py3)
        ctx.lineTo(px2, py2)
      }
      ctx.stroke()
      break
    }
    case 'genesis': {
      // Golden shield with GEN
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y - 14 * k)
      ctx.lineTo(x + 11 * k, y - 10 * k)
      ctx.lineTo(x + 11 * k, y + 2 * k)
      ctx.quadraticCurveTo(x + 11 * k, y + 12 * k, x, y + 15 * k)
      ctx.quadraticCurveTo(x - 11 * k, y + 12 * k, x - 11 * k, y + 2 * k)
      ctx.lineTo(x - 11 * k, y - 10 * k)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = color2
      ctx.font = `900 ${Math.max(9, Math.round(11 * k))}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('GEN', x, y + 0.5 * k)
      break
    }
    case 'k9': {
      // Navy shield with golden K / hound
      ctx.fillStyle = color2
      ctx.beginPath()
      roundRectPath(ctx, x - 12 * k, y - 13 * k, 24 * k, 27 * k, 6 * k)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, 2 * k)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.font = `900 ${Math.max(15, Math.round(17 * k))}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('K9', x, y + 0.5 * k)
      break
    }
    case 'truerippers': {
      // Cyan claw / jagged burst
      ctx.fillStyle = color
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a0 = (i * Math.PI) / 4
        const a1 = a0 + Math.PI / 4 / 2
        const r1 = W
        const r2 = W * 0.55
        ctx.lineTo(x + r1 * Math.cos(a0), y + r1 * Math.sin(a0))
        ctx.lineTo(x + r2 * Math.cos(a1), y + r2 * Math.sin(a1))
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'victoressumus': {
      // Victory "V" purple crest
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x - 10 * k, y - 8 * k)
      ctx.lineTo(x, y + 12 * k)
      ctx.lineTo(x + 10 * k, y - 8 * k)
      ctx.lineTo(x + 6 * k, y - 8 * k)
      ctx.lineTo(x, y + 4 * k)
      ctx.lineTo(x - 6 * k, y - 8 * k)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'reckoning':
    case 'revenantxspark': {
      // Purple energy bolt
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x + 2 * k, y - 13 * k)
      ctx.lineTo(x - 6 * k, y + 2 * k)
      ctx.lineTo(x - 1 * k, y + 2 * k)
      ctx.lineTo(x - 2 * k, y + 13 * k)
      ctx.lineTo(x + 6 * k, y - 2 * k)
      ctx.lineTo(x + 1 * k, y - 2 * k)
      ctx.closePath()
      ctx.fill()
      break
    }
    case '_8bit': {
      // Pixel block / 8-bit cube
      ctx.fillStyle = color
      ctx.beginPath()
      roundRectPath(ctx, x - 9 * k, y - 11 * k, 18 * k, 22 * k, 3 * k)
      ctx.fill()
      ctx.fillStyle = color2
      ctx.fillRect(x - 3 * k, y - 5 * k, 6 * k, 4 * k)
      ctx.fillRect(x - 6 * k, y + 1 * k, 5 * k, 4 * k)
      ctx.fillRect(x + 1 * k, y + 1 * k, 5 * k, 4 * k)
      ctx.fillRect(x - 6 * k, y + 7 * k, 5 * k, 4 * k)
      ctx.fillRect(x + 1 * k, y + 7 * k, 5 * k, 4 * k)
      break
    }
    case 'vasista': {
      // Red crest / laurel
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y - 2 * k, 5 * k, Math.PI, 0)
      ctx.lineTo(x + 9 * k, y + 9 * k)
      ctx.lineTo(x + 3 * k, y + 7 * k)
      ctx.lineTo(x, y + 13 * k)
      ctx.lineTo(x - 3 * k, y + 7 * k)
      ctx.lineTo(x - 9 * k, y + 9 * k)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'apexgaming':
    case 'godsreign': {
      // Royal tri-crown
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x - 9 * k, y + 8 * k)
      ctx.lineTo(x - 9 * k, y - 5 * k)
      ctx.lineTo(x - 5 * k, y + 0 * k)
      ctx.lineTo(x, y - 11 * k)
      ctx.lineTo(x + 5 * k, y + 0 * k)
      ctx.lineTo(x + 9 * k, y - 5 * k)
      ctx.lineTo(x + 9 * k, y + 8 * k)
      ctx.closePath()
      ctx.fill()
      break
    }
    default: {
      // Colorful monogram plate for all other teams
      ctx.font = `900 ${Math.max(12, Math.round(14 * k))}px Inter, sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(short, x, y + 1 * k)
      // brand-colored corner chevrons so it still looks like a logo
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x - 16 * k, y - 18 * k)
      ctx.lineTo(x - 16 * k, y - 10 * k)
      ctx.lineTo(x - 8 * k, y - 18 * k)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x + 16 * k, y + 18 * k)
      ctx.lineTo(x + 16 * k, y + 10 * k)
      ctx.lineTo(x + 8 * k, y + 18 * k)
      ctx.closePath()
      ctx.fill()
      break
    }
  }
}

function drawTeam(ctx, a, x, y, S = 1, Z = 1) {
  const team = getTeam(a.teamId)
  const color = team ? team.color : '#facc15'
  const color2 = team ? team.color2 : '#0f172a'
  // size as a multiplier (1 = default). Clamp to a sane range.
  const k = Math.max(0.4, Math.min(3, a.size || 1)) * S

  ctx.save()

  // Soft ground shadow
  ctx.beginPath()
  ctx.ellipse(x, y + 3 * k, 16 * k, 6 * k, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fill()

  const logoPath = a.logoUrl || (team ? team.logoUrl : null)
  const hasLogo = !!logoPath
  const cached = hasLogo ? teamLogoCache.get(logoPath) : null

  if (hasLogo) {
    if (!teamLogoCache.has(logoPath)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => teamLogoCache.set(logoPath, img)
      img.onerror = () => {
        const raw = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath
        const fallback = new Image()
        fallback.onload = () => teamLogoCache.set(logoPath, fallback)
        fallback.onerror = () => teamLogoCache.set(logoPath, false)
        fallback.src = `./${raw}`
      }
      const raw = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath
      const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './'
      const full = baseUrl.endsWith('/') ? `${baseUrl}${raw}` : `${baseUrl}/${raw}`
      img.src = full
      teamLogoCache.set(logoPath, null)
    }
    if (cached && cached.width > 0) {
      ctx.beginPath()
      roundRectPath(ctx, x - 16 * k, y - 18 * k, 32 * k, 32 * k, 8 * k)
      ctx.clip()
      ctx.fillStyle = color2
      ctx.fillRect(x - 16 * k, y - 18 * k, 32 * k, 32 * k)

      // Preserve natural aspect ratio & center logo inside badge plate
      const iw = cached.width
      const ih = cached.height
      const maxDim = 28 * k
      const scale = Math.min(maxDim / iw, maxDim / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = x - dw / 2
      const dy = (y - 2 * k) - dh / 2

      ctx.drawImage(cached, dx, dy, dw, dh)
      ctx.restore()
    } else {
      drawEmblem(ctx, x, y, k, team || { id: a.teamId, name: a.label, short: '', color, color2 })
    }
  } else {
    drawEmblem(ctx, x, y, k, team || { id: a.teamId, name: a.label, short: '', color, color2 })
  }

  // Team name label — k already includes export scale factor (S),
  // so no additional S multiplication is needed.
  const name = a.label || (team ? team.name : 'Team')
  const labelFontPx = Math.max(8 * k, Math.round(11 * k))
  ctx.font = `800 ${labelFontPx}px Inter, sans-serif`
  const tw = ctx.measureText(name).width
  const padX = 7 * k
  const gapY = 3 * k
  const labelH = labelFontPx + 6 * k
  const labelY = y + 18 * k + gapY
  ctx.fillStyle = 'rgba(7,10,15,0.92)'
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.0, 1.0 * k)
  ctx.beginPath()
  roundRectPath(ctx, x - tw / 2 - padX, labelY, tw + padX * 2, labelH, 5 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x, labelY + labelH / 2)

  ctx.restore()
}

function drawAnno(ctx, a, X, Y, S = 1, selectedId = null, Z = 1) {
  if (!a.points || !a.points.length || a.hidden) return
  const P = a.points.map((p) => [X(p[0]), Y(p[1])])
  ctx.save()
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const isSelected = selectedId === a.id

  if (a.type === 'brush') {
    if (P.length < 2) {
      ctx.beginPath()
      ctx.arc(P[0][0], P[0][1], (a.width || 3.5) * S * 0.5, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.globalAlpha = 0.88
      ctx.lineWidth = Math.max(2.0, (a.width || 3.5) * S)
      ctx.beginPath()
      ctx.moveTo(P[0][0], P[0][1])
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1])
      ctx.stroke()
    }
  } else if (a.type === 'line' && P.length > 1) {
    ctx.lineWidth = Math.max(2.0, (a.width || 3.5) * S)
    ctx.beginPath()
    ctx.moveTo(P[0][0], P[0][1])
    ctx.lineTo(P[1][0], P[1][1])
    ctx.stroke()
  } else if (a.type === 'arrow' && P.length > 1) {
    const w = a.width || 4.0
    ctx.lineWidth = Math.max(2.0, w * S)
    ctx.shadowColor = hexA(a.color, 0.6)
    ctx.shadowBlur = 8 * S
    ctx.beginPath()
    ctx.moveTo(P[0][0], P[0][1])
    ctx.lineTo(P[1][0], P[1][1])
    ctx.stroke()
    ctx.shadowBlur = 0
    arrowHead(ctx, P[0], P[1], Math.max(14, w * 3.5), S)
  } else if ((a.type === 'flight' || a.type === 'flight1' || a.type === 'flight2') && P.length > 1) {
    const [p0, p1] = a.points
    const dx = p1[0] - p0[0]
    const dy = p1[1] - p0[1]
    const len = Math.hypot(dx, dy) || 1

    ctx.save()

    // Main Flight Vector Line (Alternating Red-White)
    ctx.lineWidth = Math.max(4.0, 4.0 * S)
    ctx.lineCap = 'butt'

    // Pass 1: Red Segments
    ctx.strokeStyle = '#ef4444'
    ctx.setLineDash([20 * S, 20 * S])
    ctx.lineDashOffset = 0
    ctx.beginPath()
    ctx.moveTo(P[0][0], P[0][1])
    ctx.lineTo(P[1][0], P[1][1])
    ctx.stroke()

    // Pass 2: White Segments
    ctx.strokeStyle = '#ffffff'
    ctx.setLineDash([20 * S, 20 * S])
    ctx.lineDashOffset = 20 * S
    ctx.beginPath()
    ctx.moveTo(P[0][0], P[0][1])
    ctx.lineTo(P[1][0], P[1][1])
    ctx.stroke()

    ctx.setLineDash([])
    ctx.lineDashOffset = 0

    const ang = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0])
    planeGlyph(ctx, P[1][0], P[1][1], ang, '#ffffff', S)
    ctx.restore()

  } else if (a.type === 'smoke' && P.length > 0) {
    const r = Math.max(15 * (X.mapScale || 1), 4 * S)
    ctx.beginPath()
    ctx.arc(P[0][0], P[0][1], r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(203, 213, 225, 0.35)'
    ctx.fill()
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = Math.max(2.0, 2.0 * S)
    ctx.setLineDash([])
    ctx.stroke()
    label(ctx, 'SMOKE WALL (15m)', P[0][0], P[0][1] - r - 8 * S, '#e2e8f0', 'rgba(15,23,42,0.9)', 10, S)

  } else if (a.type === 'ridge' && P.length > 1) {
    ctx.lineWidth = Math.max(3.0, 3.0 * S)
    ctx.strokeStyle = '#f59e0b'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(P[0][0], P[0][1])
    ctx.lineTo(P[1][0], P[1][1])
    ctx.stroke()

    const midX = (P[0][0] + P[1][0]) / 2
    const midY = (P[0][1] + P[1][1]) / 2
    label(ctx, 'RIDGE DMR SIGHTLINE', midX, midY - 10 * S, '#f59e0b', 'rgba(7,10,15,0.92)', 10, S)

  } else if (a.type === 'compound' && P.length > 1) {
    const x = Math.min(P[0][0], P[1][0])
    const y = Math.min(P[0][1], P[1][1])
    const w = Math.abs(P[1][0] - P[0][0])
    const h = Math.abs(P[1][1] - P[0][1])
    ctx.setLineDash([])
    ctx.lineWidth = Math.max(2.5, 2.5 * S)
    ctx.strokeStyle = a.color
    ctx.fillStyle = hexA(a.color, 0.10)
    ctx.beginPath()
    roundRectPath(ctx, x, y, w, h, 4 * S)
    ctx.fill()
    ctx.stroke()
    label(ctx, a.label || 'COMPOUND DEFENSE', x + w / 2, y + h / 2, a.color, 'rgba(7,10,15,0.92)', 10, S)
  } else if (a.type === 'text' && P.length > 0) {
    const fs = a.fontSize || 20
    label(ctx, a.label || 'Note', P[0][0], P[0][1], a.color, 'rgba(7,10,15,0.92)', fs, S)
  } else if (a.type === 'team' && P.length > 0) {
    drawTeam(ctx, a, P[0][0], P[0][1], S, Z)
  } else if (a.type === 'pin') {
    drawPin(ctx, P[0][0], P[0][1], a.label || 'P', a.color, S)
  } else if (a.type === 'vehicle') {
    drawVehicle(ctx, P[0][0], P[0][1], !!a.open, S)
  }

  // Draw Glowing Cyan Selection Aura / Bounding Box when annotation is selected
  if (isSelected) {
    ctx.save()
    if (a.type === 'text' && P.length > 0) {
      const fs = a.fontSize || 20
      const fontPx = Math.max(11, Math.round(fs * S))
      ctx.font = `800 ${fontPx}px Inter, system-ui, sans-serif`
      const tw = ctx.measureText(a.label || 'Note').width
      const padX = 10 * S
      const padY = (fs * 0.45) * S
      const h = (fs + 8) * S
      const bx = P[0][0] - tw / 2 - padX
      const by = P[0][1] - padY
      const bw = tw + padX * 2
      ctx.strokeStyle = '#00E5FF'
      ctx.lineWidth = Math.max(2.0, 2.0 * S)
      ctx.setLineDash([5 * S, 4 * S])
      ctx.shadowColor = '#00E5FF'
      ctx.shadowBlur = 10 * S
      ctx.strokeRect(bx, by, bw, h)

      // Small handles on corners
      ctx.fillStyle = '#00E5FF'
      ctx.fillRect(bx - 3 * S, by - 3 * S, 6 * S, 6 * S)
      ctx.fillRect(bx + bw - 3 * S, by - 3 * S, 6 * S, 6 * S)
      ctx.fillRect(bx - 3 * S, by + h - 3 * S, 6 * S, 6 * S)
      ctx.fillRect(bx + bw - 3 * S, by + h - 3 * S, 6 * S, 6 * S)
    } else if (P.length > 0) {
      ctx.strokeStyle = '#00E5FF'
      ctx.lineWidth = Math.max(2.5, 2.5 * S)
      ctx.setLineDash([6 * S, 4 * S])
      ctx.shadowColor = '#00E5FF'
      ctx.shadowBlur = 12 * S
      if (P.length === 1) {
        ctx.beginPath()
        ctx.arc(P[0][0], P[0][1], 18 * S, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(P[0][0], P[0][1])
        for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1])
        ctx.stroke()
        for (const pt of [P[0], P[P.length - 1]]) {
          ctx.fillStyle = '#00E5FF'
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], 5 * S, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  ctx.restore()
}

function drawHighlight(ctx, h, X, Y, t, S = 1) {
  const x = X(h.x)
  const y = Y(h.y)
  const p = 1 + Math.sin(t / 380) * 0.15
  ctx.save()
  ctx.strokeStyle = 'rgba(251,191,36,0.95)'
  ctx.lineWidth = Math.max(2.5, 2.5 * S)
  ctx.beginPath()
  ctx.arc(x, y, 16 * p * S, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(251,191,36,0.4)'
  ctx.beginPath()
  ctx.arc(x, y, 28 * p * S, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.arc(x, y, 4.5 * S, 0, Math.PI * 2)
  ctx.fill()
  label(ctx, `TARGET: ${h.name}`, x, y - 34 * S, '#fcd34d', 'rgba(7,10,15,0.92)', 11, S)
  ctx.restore()
}

// Stage 1 to 8 Circle Outlines with Minimum Stroke Floor for High-Res PNG Exports
function drawCircle(ctx, c, X, Y, selectedId, t, S = 1) {
  const x = X(c.x)
  const y = Y(c.y)
  const r = Math.max(c.r * (X.mapScale || 1), 1.5)
  const contain = c.violating
  const warn = !contain && (c.waterWarn || c.oob)

  ctx.save()
  ctx.setLineDash([])

  const SOLID_STAGE_COLORS = [
    '#FFFFFF', // Stage 1: Solid White
    '#00E5FF', // Stage 2: Solid Cyan
    '#10B981', // Stage 3: Solid Green
    '#FACC15', // Stage 4: Solid Yellow
    '#F97316', // Stage 5: Solid Orange
    '#FF5722', // Stage 6: Solid Orange-Red
    '#EF4444', // Stage 7: Solid Red
    '#DC2626', // Stage 8: Solid Deep Red
  ]

  const strokeColor = contain
    ? '#EF4444'
    : warn
    ? '#F97316'
    : SOLID_STAGE_COLORS[(c.stage - 1) % SOLID_STAGE_COLORS.length] || '#FFFFFF'

  // Proportional stroke scaling matching canvas resolution (exact 1:1 relative proportions)
  const baseWidth = contain ? 3.5 : 2.5
  const strokeWidth = baseWidth * S

  if (contain) {
    const pulse = 0.5 + 0.5 * Math.sin(t / 180)
    ctx.shadowColor = `rgba(239, 68, 68, ${pulse})`
    ctx.shadowBlur = 24 * S
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = '#EF4444'
  } else if (warn) {
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = '#F97316'
  } else {
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = strokeColor
  }

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0

  if (selectedId === c.id) {
    ctx.lineWidth = Math.max(3.0, 3.0 * S)
    ctx.strokeStyle = '#00E5FF'
    ctx.setLineDash([6 * S, 4 * S])
    ctx.beginPath()
    ctx.arc(x, y, r + 4 * S, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Glowing cyan resize handle dot at (x + r, y)
    const handleX = x + r
    const handleY = y
    ctx.fillStyle = '#00E5FF'
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2 * S
    ctx.shadowColor = '#00E5FF'
    ctx.shadowBlur = 12 * S
    ctx.beginPath()
    ctx.arc(handleX, handleY, Math.max(7, 7 * S), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  if (contain && r > 28 * S) {
    label(ctx, '⚠️ INVALID ZONE BOUNDARY', x, y, '#ffffff', 'rgba(220,38,38,0.95)', 12, S)
  } else if (c.waterWarn && r > 28 * S) {
    label(ctx, `! WATER ${Math.round((c.waterRatio || 0) * 100)}%`, x, y, '#fed7aa', 'rgba(154,52,18,0.92)', 11, S)
  } else if (c.oob && r > 24 * S) {
    label(ctx, '! OUT OF BOUNDS', x, y, '#fed7aa', 'rgba(154,52,18,0.92)', 11, S)
  }
  ctx.restore()
}

function drawGrid(ctx, W, H, mapSize, gridOn, minorGridOn, X, Y, Z, S = 1) {
  if (!gridOn) return
  const n = Math.round(mapSize / 1000)
  const kmPx = 1000 * Z

  const majorWidth = 1.0 * S
  ctx.strokeStyle = kmPx < 18 ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.35)'
  ctx.lineWidth = majorWidth
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const gx = X(i * 1000) + 0.5
    ctx.moveTo(gx, Y(0))
    ctx.lineTo(gx, Y(mapSize))
    const gy = Y(i * 1000) + 0.5
    ctx.moveTo(X(0), gy)
    ctx.lineTo(X(mapSize), gy)
  }
  ctx.stroke()

  if (minorGridOn && kmPx > 36) {
    const minorWidth = 0.8 * S
    ctx.strokeStyle = 'rgba(148,163,184,0.12)'
    ctx.lineWidth = minorWidth
    ctx.beginPath()
    for (let g = 0; g < mapSize; g += 100) {
      ctx.moveTo(X(g) + 0.5, Y(0))
      ctx.lineTo(X(g) + 0.5, Y(mapSize))
      ctx.moveTo(X(0), Y(g) + 0.5)
      ctx.lineTo(X(mapSize), Y(g) + 0.5)
    }
    ctx.stroke()
  }

  if (kmPx > 22) {
    const labelFontPx = Math.max(10, Math.round(10 * S))
    ctx.font = `700 ${labelFontPx}px Inter, system-ui, sans-serif`
    for (let i = 0; i < n; i++) {
      const lx = X(i * 1000 + 500)
      const ly = Y(i * 1000 + 500)
      ctx.fillStyle = 'rgba(226,232,240,0.85)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(gridCoordLabel(i), lx, Y(0) + 4 * S)
      ctx.fillText(String(i + 1), X(0) + 4 * S, ly - 5 * S)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(226,232,240,0.45)'
      ctx.fillText(gridCoordLabel(i), lx, Y(mapSize) - 3 * S)
      ctx.fillText(String(i + 1), X(mapSize) - 3 * S, ly + 5 * S)
    }
  }
}

function drawTournamentOverlays(ctx, mapId, X, Y, t, mapSize, showHeatmap, showContours, S = 1) {
  if (mapId === 'erangel') {
    // Ferry route lines removed as requested
  } else if (mapId === 'sanhok' && showHeatmap) {
    ctx.save()
    for (const spot of MAP_TOURNAMENT_CONFIGS.sanhok.cqcHotspots) {
      const sx = X(spot.x)
      const sy = Y(spot.y)
      const grad = ctx.createRadialGradient(sx, sy, 5 * S, sx, sy, 80 * S)
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)')
      grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.25)')
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(sx, sy, 80 * S, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

  } else if (mapId === 'miramar' && showContours) {
    // Red contour lines removed as requested
  }
}

export function renderScene(ctx, W, H, s) {
  const {
    mapSize,
    image,
    gridOn = false,
    minorGridOn = false,
    circles = [],
    annos = [],
    highlights = [],
    view: v,
    temp = null,
    t = 0,
    selectedId = null,
    mapId = 'erangel',
    showHeatmap = true,
    showContours = true,
    exportScaleFactor = null,
  } = s

  // Dynamic Export Scale Factor Calculation: scaleFactor = exportCanvasWidth / viewportWidth
  const S = exportScaleFactor || (s.viewportWidth ? W / s.viewportWidth : Math.max(1, W / 800))
  const Z = v.ppm * v.zoom
  const X = (m) => m * Z + v.ox
  const Y = (m) => m * Z + v.oy
  X.mapScale = Z

  ctx.save()
  ctx.fillStyle = '#070A0F'
  ctx.fillRect(0, 0, W, H)

  if (image) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, X(0), Y(0), mapSize * Z, mapSize * Z)
  } else {
    ctx.fillStyle = '#0F172A'
    ctx.fillRect(X(0), Y(0), mapSize * Z, mapSize * Z)
    ctx.fillStyle = 'rgba(226,232,240,0.6)'
    ctx.font = `600 ${Math.max(14, Math.round(14 * S))}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('No map image loaded', X(mapSize / 2), Y(mapSize / 2))
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(X(0), Y(0), mapSize * Z, mapSize * Z)
  ctx.clip()

  drawGrid(ctx, W, H, mapSize, gridOn, minorGridOn, X, Y, Z, S)
  drawTournamentOverlays(ctx, mapId, X, Y, t, mapSize, showHeatmap, showContours, S)

  for (const h of highlights) drawHighlight(ctx, h, X, Y, t, S)
  for (const a of annos) drawAnno(ctx, a, X, Y, S, selectedId, Z)
  if (temp) drawAnno(ctx, temp, X, Y, S, null, Z)
  for (const c of circles) drawCircle(ctx, c, X, Y, selectedId, t, S)

  ctx.restore()
  ctx.restore()
}
