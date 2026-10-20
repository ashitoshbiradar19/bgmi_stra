// Generates the international team crests in `public/logos/`.
//
//   npm run logos:generate
//
// (That script loads `tests/setup.mjs` first because it teaches Node to resolve
// the extensionless relative imports the rest of `src/` uses.)
//
// Each crest is a brand-coloured plate drawn from the team row's `color` /
// `color2` in `src/data/intlTeams.js`, with the org's short code as the
// monogram. They are deliberately simple so they stay legible at the 36px and
// 48px tile sizes used by the team pickers.
//
// The SVG sources are kept in `assets/team-logos/` so a crest can be tweaked and
// regenerated. Orgs whose real logo was harvested into `public/logos/<SHORT>.png`
// are listed in `assets/team-logos/real-logos.json` and are skipped, so a
// regeneration never overwrites a real crest. To swap an org onto a real logo
// manually, drop a square PNG with the same file name over
// `public/logos/<SHORT>.png` and add its short code to that manifest.
//
// Rasterising uses macOS `qlmanage` (WebKit). On other platforms the SVG files
// are still written and can be converted with any SVG rasteriser; the app is
// happy with a `.png` produced elsewhere.

import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { INTL_TEAMS } from '../src/data/intlTeams.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SVG_DIR = path.join(ROOT, 'assets', 'team-logos')
const OUT_DIR = path.join(ROOT, 'public', 'logos')
const SIZE = 256

// Shorts whose `public/logos/<SHORT>.png` is an org's real logo (harvested from
// the official esports API). Regenerating those would throw the real crest away,
// so the manifest lists them and the loop below skips them.
const REAL_LOGOS = (() => {
  const manifest = path.join(SVG_DIR, 'real-logos.json')
  if (!existsSync(manifest)) return new Set()
  try {
    return new Set(JSON.parse(readFileSync(manifest, 'utf8')))
  } catch {
    return new Set()
  }
})()

function fitFontSize(text) {
  // Helvetica Bold averages ~0.62em per glyph at these weights; 168px is the
  // usable width inside the plate's inner border.
  return Math.round(Math.min(112, 168 / (text.length * 0.62)))
}

function crestSvg(team, i) {
  const { short, color, color2 } = team
  const fs = fitFontSize(short)
  // Alternate the highlight sweep so a grid of crests does not read as one
  // flat sheet of identical plates.
  const x1 = i % 2 === 0 ? '0' : '1'
  const x2 = i % 2 === 0 ? '1' : '0'
  const y1 = i % 3 === 0 ? '0' : '1'
  const y2 = i % 3 === 0 ? '1' : '0'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${team.name}">
  <defs>
    <linearGradient id="plate" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0%" stop-color="${color2}"/>
      <stop offset="100%" stop-color="#05070b"/>
    </linearGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="plateClip">
      <rect x="6" y="6" width="244" height="244" rx="46"/>
    </clipPath>
  </defs>
  <rect x="6" y="6" width="244" height="244" rx="46" fill="url(#plate)"/>
  <g clip-path="url(#plateClip)">
    <rect x="6" y="6" width="244" height="150" fill="url(#sweep)"/>
    <circle cx="${i % 2 === 0 ? 196 : 60}" cy="${i % 2 === 0 ? 52 : 204}" r="86" fill="${color}" opacity="0.10"/>
  </g>
  <rect x="18" y="18" width="220" height="220" rx="36" fill="none" stroke="${color}" stroke-width="3" opacity="0.55"/>
  <circle cx="128" cy="126" r="62" fill="none" stroke="${color}" stroke-width="5" opacity="0.22"/>
  <text x="128" y="${Math.round(126 + fs * 0.35)}" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700"
        font-size="${fs}" fill="#ffffff">${short}</text>
  <rect x="98" y="200" width="60" height="6" rx="3" fill="${color}" opacity="0.9"/>
</svg>
`
}

function rasterize(svgPath, pngPath) {
  const tmpDir = path.join(OUT_DIR, '.ql-tmp')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  try {
    execFileSync('qlmanage', ['-t', '-s', String(SIZE), '-o', tmpDir, svgPath], { stdio: 'ignore' })
    const produced = path.join(tmpDir, `${path.basename(svgPath)}.png`)
    if (!existsSync(produced)) return false
    renameSync(produced, pngPath)
    return true
  } catch {
    return false
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

mkdirSync(SVG_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

let written = 0
let failed = 0
let skipped = 0
INTL_TEAMS.forEach((team, i) => {
  if (REAL_LOGOS.has(team.short)) {
    skipped += 1
    return
  }
  const svgPath = path.join(SVG_DIR, `${team.short}.svg`)
  writeFileSync(svgPath, crestSvg(team, i))
  const pngPath = path.join(OUT_DIR, `${team.short}.png`)
  if (rasterize(svgPath, pngPath)) {
    written += 1
  } else {
    failed += 1
    console.warn(`  ! could not rasterise ${team.short} — SVG kept at assets/team-logos/${team.short}.svg`)
  }
})

console.log(
  `crest generation: ${written} PNG written, ${failed} failed, ${skipped} real logos kept (${INTL_TEAMS.length} international teams)`,
)