function hash(s) {
  let h = 1779033703
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateMap(map) {
  const px = 2048 // 2048x2048 Ultra-HD Crisp Resolution
  const cv = document.createElement('canvas')
  cv.width = cv.height = px
  const ctx = cv.getContext('2d')
  const rnd = mulberry32(hash(map.id))
  const th = map.theme
  const S = map.size

  // 1. BASE LANDMASS & TERRAIN GRADIENT
  const landGrad = ctx.createRadialGradient(px / 2, px / 2, px * 0.1, px / 2, px / 2, px * 0.7)
  landGrad.addColorStop(0, th.land)
  landGrad.addColorStop(1, th.blobs[0] || th.land)
  ctx.fillStyle = landGrad
  ctx.fillRect(0, 0, px, px)

  // 2. TOPOGRAPHIC RELIEF & HILLSHADING CONTOURS
  ctx.save()
  for (let i = 0; i < 450; i++) {
    const rx = rnd() * px
    const ry = rnd() * px
    const rw = 25 + rnd() * 140
    const rh = 15 + rnd() * 90
    const angle = rnd() * Math.PI
    const cIdx = (rnd() * th.blobs.length) | 0

    ctx.globalAlpha = 0.08 + rnd() * 0.12
    ctx.fillStyle = th.blobs[cIdx]
    ctx.beginPath()
    ctx.ellipse(rx, ry, rw, rh, angle, 0, Math.PI * 2)
    ctx.fill()

    // Inner contour line for topographic depth
    if (i % 3 === 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
  ctx.restore()

  // Mountain ranges relief
  if (th.mountains) {
    ctx.save()
    ctx.fillStyle = th.mountains
    for (let i = 0; i < 120; i++) {
      ctx.globalAlpha = 0.2 + rnd() * 0.15
      ctx.beginPath()
      ctx.ellipse(rnd() * px, rnd() * px, 40 + rnd() * 180, 15 + rnd() * 60, rnd() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // 3. MAP SPECIFIC COASTLINES, RIVERS & OCEAN GRADIENTS
  const waterGrad = ctx.createLinearGradient(0, 0, px, px)
  waterGrad.addColorStop(0, th.water)
  waterGrad.addColorStop(1, '#0f2438')

  const drawWaterShape = (pathFn) => {
    ctx.save()
    ctx.fillStyle = waterGrad
    ctx.shadowColor = 'rgba(34, 211, 238, 0.35)'
    ctx.shadowBlur = 12
    ctx.beginPath()
    pathFn()
    ctx.fill()

    // Shoreline shallow water highlight
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()
  }

  if (map.id === 'erangel') {
    // Outer Sea Borders (North, West, East, South)
    drawWaterShape(() => {
      ctx.rect(0, 0, px, px * 0.07)
      ctx.rect(0, 0, px * 0.07, px)
      ctx.rect(px * 0.93, 0, px * 0.07, px)
      ctx.rect(0, px * 0.9, px, px * 0.1)

      // Sosnovka Island Channel River
      ctx.moveTo(px * 0.07, px * 0.67)
      ctx.bezierCurveTo(px * 0.3, px * 0.64, px * 0.65, px * 0.72, px * 0.93, px * 0.65)
      ctx.lineTo(px * 0.93, px * 0.77)
      ctx.bezierCurveTo(px * 0.65, px * 0.83, px * 0.3, px * 0.75, px * 0.07, px * 0.78)
      ctx.closePath()
    })

    // Georgopol Sea Inlet & Ruins Lake
    ctx.fillStyle = waterGrad
    ctx.beginPath()
    ctx.ellipse(px * 0.22, px * 0.28, 90, 45, -0.3, 0, Math.PI * 2)
    ctx.ellipse(px * 0.41, px * 0.39, 40, 30, 0, 0, Math.PI * 2)
    ctx.fill()

    // Sosnovka Steel Bridges
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 9
    // West Bridge (North Bridge)
    ctx.beginPath()
    ctx.moveTo(px * 0.43, px * 0.66)
    ctx.lineTo(px * 0.43, px * 0.76)
    ctx.stroke()

    // East Bridge
    ctx.beginPath()
    ctx.moveTo(px * 0.62, px * 0.68)
    ctx.lineTo(px * 0.62, px * 0.79)
    ctx.stroke()

    // Bridge truss lines
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(px * 0.42, px * 0.66)
    ctx.lineTo(px * 0.44, px * 0.76)
    ctx.moveTo(px * 0.61, px * 0.68)
    ctx.lineTo(px * 0.63, px * 0.79)
    ctx.stroke()

    // Military Base Airfield Runways
    ctx.fillStyle = '#334155'
    ctx.save()
    ctx.translate(px * 0.68, px * 0.86)
    ctx.rotate(-0.2)
    ctx.fillRect(-140, -12, 280, 24)
    ctx.fillRect(-90, -80, 24, 160)
    ctx.restore()

  } else if (map.id === 'miramar') {
    // South-East Ocean & Prison Island
    drawWaterShape(() => {
      ctx.moveTo(px * 0.65, px)
      ctx.bezierCurveTo(px * 0.8, px * 0.82, px, px * 0.65, px, px * 0.45)
      ctx.lineTo(px, px)
      ctx.closePath()
    })

    // Prison Island
    ctx.fillStyle = th.land
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(px * 0.82, px * 0.84, 85, 60, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

  } else if (map.id === 'sanhok') {
    // 3 Islands Y-River
    drawWaterShape(() => {
      ctx.rect(0, 0, px * 0.05, px)
      ctx.rect(px * 0.95, 0, px * 0.05, px)
      ctx.rect(0, 0, px, px * 0.05)
      ctx.rect(0, px * 0.95, px, px * 0.05)
    })

    ctx.fillStyle = waterGrad
    ctx.lineWidth = 75
    ctx.strokeStyle = waterGrad
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px * 0.5, px * 0.48)
    ctx.lineTo(px * 0.5, px * 0.05)
    ctx.moveTo(px * 0.5, px * 0.48)
    ctx.lineTo(px * 0.05, px * 0.78)
    ctx.moveTo(px * 0.5, px * 0.48)
    ctx.lineTo(px * 0.95, px * 0.78)
    ctx.stroke()

    // Boot Camp Central Fortification Wall
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 5
    ctx.strokeRect(px * 0.53 - 35, px * 0.38 - 35, 70, 70)

  } else if (map.id === 'vikendi') {
    // North-South River & Castle Island
    drawWaterShape(() => {
      ctx.moveTo(px * 0.49, 0)
      ctx.bezierCurveTo(px * 0.42, px * 0.35, px * 0.54, px * 0.65, px * 0.47, px)
      ctx.lineTo(px * 0.53, px)
      ctx.bezierCurveTo(px * 0.59, px * 0.65, px * 0.47, px * 0.35, px * 0.54, 0)
      ctx.closePath()
    })

    // Castle Island in central river
    ctx.fillStyle = th.land
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(px * 0.475, px * 0.31, 38, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

  } else if (map.id === 'rondo') {
    // Serpentine River & Jadena Bay
    drawWaterShape(() => {
      ctx.moveTo(0, px * 0.28)
      ctx.bezierCurveTo(px * 0.35, px * 0.2, px * 0.6, px * 0.52, px, px * 0.38)
      ctx.lineTo(px, px * 0.44)
      ctx.bezierCurveTo(px * 0.6, px * 0.58, px * 0.35, px * 0.26, 0, px * 0.34)
      ctx.closePath()
    })

    // Jadena City Bay Harbor
    ctx.fillStyle = waterGrad
    ctx.beginPath()
    ctx.ellipse(px * 0.32, px * 0.32, 70, 50, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 4. CRISP HIGHWAY & ROAD NETWORK
  ctx.save()
  // Asphalt outer road border
  ctx.strokeStyle = th.road || 'rgba(30, 41, 59, 0.7)'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'

  const drawRoads = () => {
    for (let i = 0; i < map.pois.length; i++) {
      let nearest = []
      for (let j = 0; j < map.pois.length; j++) {
        if (i === j) continue
        const dx = map.pois[i][1] - map.pois[j][1]
        const dy = map.pois[i][2] - map.pois[j][2]
        nearest.push({ j, dist: dx * dx + dy * dy })
      }
      nearest.sort((a, b) => a.dist - b.dist)
      for (let k = 0; k < Math.min(2, nearest.length); k++) {
        const target = map.pois[nearest[k].j]
        const [ax, ay] = [map.pois[i][1], map.pois[i][2]]
        const [bx, by] = [target[1], target[2]]
        const mx = (ax + bx) / 2 + (rnd() - 0.5) * S * 0.04
        const my = (ay + by) / 2 + (rnd() - 0.5) * S * 0.04
        ctx.beginPath()
        ctx.moveTo((ax / S) * px, (ay / S) * px)
        ctx.quadraticCurveTo((mx / S) * px, (my / S) * px, (bx / S) * px, (by / S) * px)
        ctx.stroke()
      }
    }
  }

  drawRoads()

  // Highway yellow/white dashed centerline
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  drawRoads()
  ctx.setLineDash([])
  ctx.restore()

  // 5. URBAN COMPOUND STRUCTURE CLUSTERS
  ctx.save()
  for (const [, x, y] of map.pois) {
    const cx = (x / S) * px
    const cy = (y / S) * px

    // City compound drop shadow background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'
    ctx.fillRect(cx - 35, cy - 35, 70, 70)

    // Detailed building structures
    for (let k = 0; k < 18; k++) {
      const bw = 9 + rnd() * 16
      const bh = bw * (0.8 + rnd() * 0.8)
      const bx = cx + (rnd() - 0.5) * 55 - bw / 2
      const by = cy + (rnd() - 0.5) * 55 - bh / 2

      // Building shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(bx + 2, by + 2, bw, bh)

      // Building roof shape
      ctx.fillStyle = k % 4 === 0 ? '#38bdf8' : k % 3 === 0 ? '#f97316' : th.urban || '#94a3b8'
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, bw, bh)
    }
  }
  ctx.restore()

  // 6. HIGH-CONTRAST HD POI CALLOUT BADGES & TEXT LABELS
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const [name, x, y, tag] of map.pois) {
    const cx = (x / S) * px
    const cy = (y / S) * px

    // POI Dot Pulsing Marker
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(34, 211, 238, 0.3)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#38bdf8'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Text Label Pill Background
    ctx.font = '800 16px Inter, system-ui, -apple-system, sans-serif'
    const nameWidth = ctx.measureText(name).width
    const pillW = Math.max(nameWidth + 24, 90)
    const pillH = tag ? 36 : 24
    const pillX = cx - pillW / 2
    const pillY = cy - 36 - (tag ? 12 : 0)

    // Pill background card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
    ctx.lineWidth = 1.5

    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(pillX, pillY, pillW, pillH, 6)
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.fillRect(pillX, pillY, pillW, pillH)
      ctx.strokeRect(pillX, pillY, pillW, pillH)
    }

    // POI Primary Title
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, cx, pillY + (tag ? 11 : 12))

    // POI Subtitle / Tactical Info
    if (tag) {
      ctx.font = '700 10px Inter, sans-serif'
      ctx.fillStyle = '#38bdf8'
      ctx.fillText(tag.toUpperCase(), cx, pillY + 25)
    }
  }
  ctx.restore()

  return cv
}

