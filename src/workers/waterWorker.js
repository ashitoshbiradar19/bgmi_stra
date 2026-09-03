// Dedicated Web Worker for Off-Main-Thread Water Surface Ratio Calculations
// Calculates water coverage inside active circles without blocking main UI 60 FPS thread.

self.onmessage = function (e) {
  const { id, imageData, width, height, x, y, r, mapSize } = e.data

  if (!imageData) {
    self.postMessage({ id, ratio: 0 })
    return
  }

  const steps = 18
  let water = 0
  let total = 0
  const data = imageData

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const px = x - r + ((i + 0.5) / steps) * r * 2
      const py = y - r + ((j + 0.5) / steps) * r * 2

      if (Math.hypot(px - x, py - y) > r) continue
      total++

      const sx = Math.min(width - 1, Math.max(0, Math.floor((px / mapSize) * width)))
      const sy = Math.min(height - 1, Math.max(0, Math.floor((py / mapSize) * height)))
      const o = (sy * width + sx) * 4

      const red = data[o]
      const green = data[o + 1]
      const blue = data[o + 2]

      // Water detection heuristics:
      const isBlueDominant = blue > red + 8 && blue > 40
      const isDeepWater = blue > 50 && green > 50 && red < 50
      const isVikendiIceWater = blue > 80 && red < 80 && green > 80 && green < 140

      if (isBlueDominant || isDeepWater || isVikendiIceWater) {
        water++
      }
    }
  }

  const ratio = total ? water / total : 0
  self.postMessage({ id, ratio })
}
