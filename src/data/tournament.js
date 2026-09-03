// Official BGMI / BMPS / PMGC Esports Tournament Configuration Engine

export const STAGE_PRESETS = {
  // 8x8 km Maps (Erangel, Miramar, Rondo, Vikendi)
  standard8k: [
    { stage: 1, radius: 2275, diameter: 4550, dps: 0.4, waitSec: 300, shrinkSec: 300 },
    { stage: 2, radius: 1485, diameter: 2970, dps: 0.6, waitSec: 200, shrinkSec: 140 },
    { stage: 3, radius: 740, diameter: 1480, dps: 0.8, waitSec: 150, shrinkSec: 90 },
    { stage: 4, radius: 370, diameter: 740, dps: 1.0, waitSec: 120, shrinkSec: 60 },
    { stage: 5, radius: 180, diameter: 360, dps: 3.0, waitSec: 120, shrinkSec: 40 },
    { stage: 6, radius: 87.5, diameter: 175, dps: 5.0, waitSec: 90, shrinkSec: 30 },
    { stage: 7, radius: 45, diameter: 90, dps: 8.0, waitSec: 90, shrinkSec: 30 },
    { stage: 8, radius: 20, diameter: 40, dps: 11.0, waitSec: 60, shrinkSec: 30 },
  ],

  // 4x4 km Maps (Sanhok)
  scaled4k: [
    { stage: 1, radius: 1137.5, diameter: 2275, dps: 0.6, waitSec: 180, shrinkSec: 180 },
    { stage: 2, radius: 742.5, diameter: 1485, dps: 0.8, waitSec: 140, shrinkSec: 100 },
    { stage: 3, radius: 370, diameter: 740, dps: 1.0, waitSec: 100, shrinkSec: 60 },
    { stage: 4, radius: 185, diameter: 370, dps: 2.0, waitSec: 90, shrinkSec: 45 },
    { stage: 5, radius: 90, diameter: 180, dps: 4.0, waitSec: 80, shrinkSec: 30 },
    { stage: 6, radius: 43.75, diameter: 87.5, dps: 7.0, waitSec: 60, shrinkSec: 25 },
    { stage: 7, radius: 22.5, diameter: 45, dps: 10.0, waitSec: 50, shrinkSec: 20 },
    { stage: 8, radius: 10, diameter: 20, dps: 15.0, waitSec: 40, shrinkSec: 20 },
  ],
}

export const MAP_TOURNAMENT_CONFIGS = {
  erangel: {
    presetKey: 'standard8k',
    title: 'BGIS / BMPS Official Erangel Engine',
    size: 8000,
    features: {
      bridgeCampDetector: true,
      ferryRouteOverlay: true,
      waterHardShiftWarning: true,
    },
    chokePoints: [
      { name: 'Sosnovka North Bridge', x: 3450, y: 7050, radius: 450, alert: 'MILITARY NORTH BRIDGE CAMP DANGER' },
      { name: 'Sosnovka East Bridge', x: 4900, y: 6700, radius: 450, alert: 'NOVOREPNOYE EAST BRIDGE BLOCK' },
    ],
    ferryRoutes: [
      { from: [2200, 5600], to: [3500, 6600], label: 'Ferry Route West' },
      { from: [3500, 6600], to: [4950, 6350], label: 'Ferry Route East' },
    ],
  },
  miramar: {
    presetKey: 'standard8k',
    title: 'PMGC Official Miramar Ridge Engine',
    size: 8000,
    features: {
      highElevationContour: true,
      vehicleRidgeDrawer: true,
      ridgeControlMarkers: true,
    },
    ridgeHolds: [
      { name: 'Pecado North Ridge', x: 2700, y: 2400 },
      { name: 'Chumacera Ridge Chain', x: 4950, y: 2550 },
      { name: 'Los Leones East Overlook', x: 1800, y: 4400 },
    ],
  },
  rondo: {
    presetKey: 'standard8k',
    title: 'PUBG Global Rondo Dual-Plane Engine',
    size: 8000,
    features: {
      dualFlightPath: true,
      jadenaUrbanVsBamboo: true,
    },
    terrainZones: {
      jadenaUrban: { cx: 2600, cy: 2600, r: 1200, label: 'Jadena Metropolis (High Urban Density)' },
      bambooForest: { cx: 4200, cy: 1900, r: 900, label: 'Bamboo Forest Cover Zone' },
    },
  },
  sanhok: {
    presetKey: 'scaled4k',
    title: 'Esports 4x4 Sanhok CQC Engine',
    size: 4000,
    features: {
      cqcHeatmap: true,
      fastZoneTimer: true,
    },
    cqcHotspots: [
      { name: 'Boot Camp', x: 2250, y: 1500, intensity: 1.0 },
      { name: 'Paradise Resort', x: 800, y: 850, intensity: 0.85 },
      { name: 'Ruins', x: 1400, y: 1800, intensity: 0.75 },
    ],
  },
}

// Check if any circle or pin is near Erangel bridge choke points
export function checkBridgeCamp(circles, annos) {
  const bridgeAlerts = []
  const erangelChokes = MAP_TOURNAMENT_CONFIGS.erangel.chokePoints

  for (const choke of erangelChokes) {
    let active = false
    // Check circles
    for (const c of circles) {
      if (Math.hypot(c.x - choke.x, c.y - choke.y) <= c.r + choke.radius) {
        active = true
        break
      }
    }
    // Check pins
    if (!active) {
      for (const a of annos) {
        if (a.points && a.points[0]) {
          const [px, py] = a.points[0]
          if (Math.hypot(px - choke.x, py - choke.y) <= choke.radius) {
            active = true
            break
          }
        }
      }
    }
    if (active) {
      bridgeAlerts.push(choke)
    }
  }
  return bridgeAlerts
}

// Rondo terrain density analysis
export function analyzeRondoTerrain(circle) {
  if (!circle) return { urban: 0, bamboo: 0, open: 100 }
  const rondo = MAP_TOURNAMENT_CONFIGS.rondo.terrainZones
  const distUrban = Math.hypot(circle.x - rondo.jadenaUrban.cx, circle.y - rondo.jadenaUrban.cy)
  const distBamboo = Math.hypot(circle.x - rondo.bambooForest.cx, circle.y - rondo.bambooForest.cy)

  let urbanOverlap = Math.max(0, 1 - distUrban / (circle.r + rondo.jadenaUrban.r))
  let bambooOverlap = Math.max(0, 1 - distBamboo / (circle.r + rondo.bambooForest.r))

  urbanOverlap = Math.min(0.7, urbanOverlap * 0.7)
  bambooOverlap = Math.min(0.5, bambooOverlap * 0.5)

  const openLand = Math.max(0.1, 1 - (urbanOverlap + bambooOverlap))
  const total = urbanOverlap + bambooOverlap + openLand

  return {
    urban: Math.round((urbanOverlap / total) * 100),
    bamboo: Math.round((bambooOverlap / total) * 100),
    open: Math.round((openLand / total) * 100),
  }
}
