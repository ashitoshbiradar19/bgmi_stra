# AGENTS.md — BGMI Strategy Board

Permanent development rules for this project. Read this before changing any code.

---

## PROJECT

**BGMI Strategy Board** (`bgmi-strategy-board`)

A professional tactical map analysis and strategy drawing application for BGMI / BGMI esports.

### PURPOSE

A professional tactical map analysis and strategy drawing application for BGMI/esports.

Coaches, analysts, and competitive squads use it to load a map image, place playzone
circles, drop team markers and logos, draw arrows / lines / brushes / zones / labels,
and export the finished board as a high-resolution PNG.

### TECH STACK (do not change without a strong technical reason)

| Concern | Choice |
|---|---|
| UI | React 18 (`react`, `react-dom`) |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Drawing | HTML5 Canvas 2D API (imperative, via `src/lib/render.js`) |
| Icons | `lucide-react` |
| Mobile shells | Capacitor (Android / iOS) |
| Desktop shell | Electron (macOS / Windows) |
| Web | Static build — GitHub Pages, Vercel, Netlify, Render |

Runtime dependencies are intentionally minimal (4 total). **Avoid adding
dependencies.** See rule 12.

### COMMANDS

```bash
npm run dev      # start Vite dev server  -> http://localhost:5173
npm run test     # unit tests (node:test, no extra deps)
npm run build    # production build      -> dist/
npm run preview  # serve the production build locally
npm run deploy   # build + publish to gh-pages
```

`npm test` runs `node --test` over `tests/*.test.js` via `tests/setup.mjs`. These
are pure unit tests — they import the lib modules directly, so there is no browser
and no DOM dependency. There is still **no linter configured.**

**Run `npm test` and `npm run build` before committing anything.** `render.test.js`
and `toolWiring.test.js` are the ones that catch accidental damage to the drawing
model: they assert every tool that makes an annotation is reachable from
`onPointerDown`, and that every creatable tool has both a renderer branch and a
hit-test branch.

### WHERE THINGS LIVE

| File | Responsibility |
|---|---|
| `src/App.jsx` | Owns all board state: `circles`, `annos`, selection, tools, undo/redo, autosave, share links, modals. |
| `src/components/MapCanvas.jsx` | Canvas element, render loop, pointer/touch input, hit-testing, viewport zoom/pan, right-side inspector panel, `exportRef` (delegates to `lib/export.js`). |
| `src/lib/render.js` | **The renderer.** `renderScene(ctx, W, H, state)` is a pure function that draws one frame. Also holds `computeView`, `STAGE_RADII`, `STAGE_COLORS`, `containmentViolation`. |
| `src/lib/geometry.js` | Pure geometry: screen⇄world conversion, hit-testing, snapping, measurement, rotation/compound maths. Split out of `MapCanvas` so it is unit-testable. |
| `src/lib/annoTypes.js` | Per-annotation-type metadata and property schema — which types are creatable, their defaults, and their per-type props. |
| `src/lib/selection.js` | Selection model: hit resolution, multi-select, and selection change bookkeeping. |
| `src/lib/selectionOverlay.js` | The selection/hover chrome drawn on top of the scene (handles, bounds, rotate grips). |
| `src/lib/history.js` | Undo/redo stack. |
| `src/lib/inspectorSchema.js` | Describes the Inspector panel's sections and controls, driven off the tool + selection. |
| `src/lib/brandLogo.js` | **Export-frame brand logo** — local upload, localStorage persistence, and the logo's slot geometry. Not a team logo. See the brand logo section below. |
| `src/lib/export.js` | **Export composition.** `renderExportCanvas()` (async) allocates the canvas, reserves the map rect, translates into it, calls `renderScene()`, then paints the frame around it. Also `ensureFontsReady`, `downloadCanvas`, `exportFilename`. |
| `src/lib/frames.js` | **Frame system.** The 6 export templates, the header/footer field registry, layout metrics, text fitting/wrapping, and the vector logo. Pure geometry + canvas 2D; knows nothing about React. |
| `src/lib/storage.js` | localStorage autosave + saved-strategy CRUD + JSON import/export. |
| `src/lib/share.js` | Board state ⇄ URL hash (LZW + base64url). |
| `src/lib/mapGen.js` | Procedural fallback map art for maps with no image. |
| `src/data/` | Static config: `maps.js`, `teams.js`, `colors.js`, `tournament.js`, `teamRecords.js`, **`tools.js`**. |
| `src/index.css` | Tailwind import, CSS custom properties, glass/gradient utilities, tooltip styles, keyframes, safe-area insets. |
| `public/maps/` | Map imagery. `public/logos/` | Team logo PNGs. |
| `src/components/` | `Sidebar`, `Toolbar`, `MapCanvas`, `ZonePanel`, `TeamRecords`, `TrainingPanel`, `Footer`, `ExportDialog`, `ExportPreview`, `PropControls`, `ui`. |
| `tests/` | `node:test` unit suites. Pure logic only — no DOM, no browser. |

### THE THREE CONCEPTS YOU MUST UNDERSTAND

**1. Coordinate system.** World units are **meters**, range `0 … mapSize`
(8000 for an 8×8 km map). The view is `{ ppm, zoom, ox, oy }`.
`Z = ppm * zoom`, and `X(m) = m * Z + ox`. All drawing data is stored in world
(meter) coordinates — never in screen pixels. Screen pixels only exist at draw time.

**2. The `S` scale factor.** Every stroke width and font size in `render.js` is
multiplied by `S` (the export scale factor). This is what makes the same drawing
code produce both the on-screen view and a sharp high-resolution export.
**When adding anything that draws, multiply its size by `S`.** Otherwise it will
look correct on screen and wrong in the export.

**3. One renderer, two consumers.** The live canvas and the PNG exporter both call
`renderScene()`. The exporter allocates an offscreen canvas and passes a different
`exportScaleFactor`. **Never write a second, separate drawing path for export** —
that is how export and editor drift apart. See export rules below.

### DATA MODEL

Two separate top-level collections:

```js
circles: [{ id, stage, x, y, r, color? }]          // playzones
annos:   [{ id, type, points: [[x, y], ...], color, ...typeSpecific }]
```

Annotation `type` is one of:
`brush`, `line`, `arrow`, `flight`, `flight1`, `flight2`, `pin`, `vehicle`,
`compound`, `circle`, `text`, `team`, `smoke`, `ridge`.

**13 drawing tools. All must keep working.**

### The tool list lives in exactly one place

`src/data/tools.js` is the single source of truth. Each entry carries its
`id`, icon, short `label`, long `desc`, keyboard `key`, and a `group`
(`primary` = button in the toolbar rail, `more` = inside the rail's overflow
popover).

| Export | Consumed by |
|---|---|
| `TOOLS` | `Sidebar` tools tab, help-modal shortcut table |
| `PRIMARY_TOOLS` / `MORE_TOOLS` | `Toolbar` rail + overflow menu |
| `KEY_TO_TOOL` | `MapCanvas` keyboard handler |
| `toolLabel(id)` | active-tool readouts |

**To add a tool: add one row to `src/data/tools.js`, then handle it in
`MapCanvas.onPointerDown`.** Do not re-create a local tool array anywhere.
Annotation types that are not simple clicks (flight paths, line, arrow,
compound, text) also need their `onPointerMove` / `onPointerUp` branches.

### Panel layout rules

- `Toolbar` is one element repositioned with flex `order-*`: under the header
  from `md` up, docked above the footer on phones. Do not render it twice.
- The right-hand **inspector** is 272px and collapsible. `hudRight` in
  `MapCanvas` is the single source of truth for where the zoom cluster and the
  coordinate readout sit — do not hard-code `right-[292px]` or similar.
- The inspector holds settings and the selection inspector. It must **not**
  contain a second copy of the tool list; that lives in the toolbar.

---

## IMPORTANT DEVELOPMENT RULES

### Preservation — these are absolute

1. **Never break existing map functionality.** Map loading, switching, per-map
   drawing memory, custom map upload, zoom/pan must keep working.
2. **Never remove existing drawing tools unless explicitly requested.**
3. **Never remove existing export functionality.**
4. **Preserve existing team markers and team logos.** 162 teams, logo rendering,
   drag-to-place, click-to-place, show/hide-name toggle, logo size, custom logo URL.
5. **Preserve existing zone functionality.** Stage 1–8 radii, drag-to-place,
   containment validation and the invalid-boundary warning.
6. **Preserve existing responsive behavior.** Desktop sidebar, mobile overlay
   drawers, 44px minimum touch targets, safe-area insets, tablet/stylus support.

### Working method

7. **Before modifying a major feature, inspect the existing implementation.**
   Read the code first. Understand how it currently works before changing it.
8. **Prefer extending existing components instead of rewriting the entire
   application.** Additive changes are strongly preferred over restructuring.
9. **Keep tactical drawing data separate from UI state.** `circles` and `annos` are
   the document. Modals, open/closed flags, search text, panel state are UI. Do not
   mix them, and do not store drawing data in component-local state.
10. **Keep export rendering separate from editor rendering where practical.**
    Export-specific options (analyst credit, description, resolution) belong to the
    export call, not to the board document.
11. **Use reusable components.** Repeated markup (color palette grids, size sliders
    with steppers, section headers) should be one component, not five copies.
12. **Avoid unnecessary dependencies.** The current 4 runtime deps are sufficient.
    Justify any new one.
13. **Do not hard-code dimensions that prevent responsive behavior.** Use the
    existing `sm:` / `md:` breakpoint prefixes and flexible sizing.
14. **Exported images must maintain correct aspect ratio.**
15. **High-resolution exports must remain sharp.** See export rules.
16. **Do not distort map images.** Never stretch a non-square source image to fill a
    square export canvas. Fit with preserved aspect ratio.

### Design language

The app is a professional esports tool: dark "obsidian" base (`#070A0F` /
`#0B1120` / `#090E1A`), amber-gold primary accent (`#FBBF24`) reserved for primary
actions and active tools, cyan (`#00E5FF`) for interactive/hover/focus states,
slate for secondary text.

17. **Keep UI professional and esports-oriented.** Dense, tactical, information-rich.
    No playful or consumer-app styling.
18. **Avoid excessive gradients, excessive glassmorphism, and unnecessary
    animations.** These are already used for the key surfaces. Do not add more by
    default. Existing utility classes: `glass-panel`, `gradient-border`,
    `bg-tactical-grid`, `card-premium`, `btn-premium`, `section-divider`.
19. **Maintain keyboard accessibility where practical.** Interactive elements get
    `aria-label` / `title` / `aria-pressed`. Visible focus rings already exist via
    `*:focus-visible` in `index.css`. Keep the shortcut list in the help modal
    accurate.

### Discipline

20. **Test the application after major changes.** Run `npm run dev` and exercise the
    actual user flow in the browser.
21. **Run the appropriate build/test command after implementation.** At minimum
    `npm test` and `npm run build`, and both must exit 0.
22. **If a change causes a regression, fix the regression before continuing.** Do not
    stack new work on top of a broken baseline.
23. **Do not replace working functionality simply because a different
    implementation is easier.** Rewrites must be justified by a concrete technical
    need, not preference.
24. **Keep code readable for a student developer.** Clear variable names, small
    functions, comments explaining *why* rather than restating *what*. Avoid clever
    abstractions and dense one-liners.
25. **Explain important architectural changes after implementation.** If you change
    how something is structured, say so explicitly and explain the reasoning.

### Scope

**Do not modify unrelated features.** If a task is about export, do not refactor the
team roster. If you notice an unrelated problem, report it — do not silently fix it
in the same change.

---

## EXPORT RULES

The export pipeline is split across three files, and the split matters:

| File | Role |
|---|---|
| `src/lib/export.js` | `renderExportCanvas()` — the single composer. Decides the map rect, `ctx.translate()`s into it, calls `renderScene()`, then paints the frame. |
| `src/lib/frames.js` | Template + field definitions, layout math, text fitting, vector logo. Knows nothing about the map. |
| `src/components/MapCanvas.jsx` | Only `exportRef.current`, which gathers live board state and calls the composer. |

`ExportPreview` calls **`renderExportCanvas()` at a reduced width** rather than
drawing its own approximation. If you ever add a second preview-only drawing
path, preview and download will drift. Keep it to one function.

1. **Never export only what is visible on screen if a higher-resolution export is
   requested.** A high-res export must re-render the scene at the target resolution,
   not upscale a screen capture.
2. **Support high-resolution rendering.** The exporter renders to an offscreen
   canvas sized for the target, passing a larger `exportScaleFactor`.
3. **Preserve map quality.** Map source imagery must be high enough resolution for
   the export size, and must be scaled with smoothing
   (`imageSmoothingQuality = 'high'`). Do not pixelate or double-compress.
4. **Preserve tactical drawings.** All circles, arrows, lines, brushes, zones,
   flights, pins, vehicles, smoke, ridges and text must be present in the export.
5. **Preserve markers and logos.** Team markers and team logo images must render in
   the export. Logos must be **fully loaded before the export rasterizes** — a logo
   that is still loading silently falls back to a vector emblem, or taints the
   canvas and makes `toBlob()` throw. Verify this before shipping any change to
   logo loading.
6. **Preserve text positioning.** Labels and text notes must sit at the same
   relative position as on the editor canvas.
7. **Preserve frame positioning.** The map, any frame/border, and the styled footer
   banner must be positioned and proportioned as designed.
8. **Make export deterministic.** The same board state must produce the same image
   every time. No dependence on animation phase, timing, or transient state.
   (`t: performance.now()` is currently passed for pulse effects — ensure animated
   effects do not leak into exported output.)

### Frame system rules

The 6 templates live in `src/lib/frames.js`. The `No Frame` template is the
bare map and must stay pixel-identical to the old frame-less export.

9. **A frame must never cover the tactical drawing.** `computeFrameLayout()`
   reserves `mapX/mapY/mapW/mapH` and `drawFrame()` may only paint outside it
   (the single-pixel rules on the map's outer edge are intentional). If you add
   a decoration, check it lands in the gutter.
10. **Frame sizes are design units, not pixels.** Everything in `frames.js` is
    authored against `DESIGN_WIDTH` (2048) and multiplied by `scaleF`. That is
    what lets the 620px preview and the 2048px download be the same layout.
11. **Canvas dimensions must be integers.** Round `pad`, `contentW`, `contentH`
    and `totalH` in `computeFrameLayout()`. The browser silently truncates a
    fractional `canvas.height`, which crops the last band and shifts every rule.
12. **Measure and draw must share one width.** `layout.bandW` is computed once
    and used by both `measureBands()` and `drawFrame()`. Deriving the width
    separately in each is how text ends up wrapping for one width and being
    drawn against another.
13. **Band content needs a margin even on borderless templates.** `pad` may be 0,
    which is why `buildMetrics()` exposes a separate `inset` with a floor. Without
    it the logo and text sit flush against the canvas edge.
14. **Never stretch the map.** The map rect keeps the requested aspect and
    `computeView()` letterboxes the square world inside it. Do not "fix" a
    mismatch by filling the rect.
15. **The brand logo slot must clear both the text and the frame border.**
    `computeLogoBox()` sizes and places the logo; `measureBands()` and
    `drawFrame()` reserve the room. Three things must agree, in both the measure
    and the draw pass, or the logo ends up on top of the frame's own text:
    - a **left/right** logo takes its width off that end of the band, so the
      text simply starts (or ends) later;
    - a **centred** logo owns the middle, so the left and right text columns
      have to be re-derived from the room either side of it — do not just
      shrink the total width and leave the columns at the outer edges;
    - vertically, the logo is clamped clear of `layout.gutter` on the band's
      *outer* edge (top of header, bottom of footer), because the frame border
      lives there. `gutter` must be passed into the provisional layout that
      `computeLogoBox()` sees during the fixed-point loop, not only on the final
      layout.

### Brand logo system

`src/lib/brandLogo.js` owns the export frame's own logo. It is **not** a team
logo and must never be mixed with the two:

| | Brand logo (frame) | Team logo (`anno` `type: 'team'`) |
|---|---|---|
| Stored in | `localStorage` key `bgmi.brandLogo.v1` | the board's `annos` array |
| Travels with | nothing — this browser only | the board, share links, saved strategies |
| Drawn by | `drawFrame()` in `frames.js` | `renderScene()` in `render.js` |

- **Local only.** The file is read with a `FileReader` into a data URL. There is
  no upload, no backend, no network call. Do not add one.
- `renderExportCanvas()` is **async** so it can await `loadLogoImage()` before
  rasterizing. Every caller must await it (`MapCanvas` `exportRef`, `ExportPreview`,
  the dialog, and the test harnesses).
- A logo must be **decoded before drawing**. A data URL is same-origin so it does
  not taint the canvas, and decoding up front is what stops a still-loading image
  from silently drawing nothing.
- SVG sources without `width`/`height` are repaired from their `viewBox` at
  upload time, otherwise they decode to 0×0 and the box maths divides by zero.
- The logo is drawn **directly at final device-pixel size** with
  `imageSmoothingQuality = 'high'`. Never rasterize at preview size and upscale.
- When a custom logo is present it **replaces** the built-in vector mark rather
  than stacking next to it, so the `header.logo` field slot is not reserved twice.
- `No Frame` has no bands, so it gets no logo at all. That is deliberate: it is the
  bare map.

### Known export constraints to respect

- Exported boards must include annotations from **all** layers, not just layers
  currently toggled visible in the editor. Layer visibility is an editor concern.
- Do not hard-code the export pixel dimensions into drawing code. Sizes that should
  scale must go through the `S` factor.
- Watch browser canvas limits (max dimension ~16384px, max area varies by browser)
  if higher resolutions are requested. Tile if necessary.

---

## BEFORE FINISHING ANY MAJOR TASK

- [ ] Run the build (`npm run build`) and confirm it exits 0 with no errors.
- [ ] Check the console and dev-server output for errors or warnings.
- [ ] Verify the main user flow in the browser: load a map → place zones → place
      team logos → draw each annotation type → edit/select/delete → undo/redo →
      export PNG → verify the exported image.
- [ ] Confirm nothing listed under "Preservation" regressed.
- [ ] Report **what files were changed** (with a short description of each).
- [ ] Report **what was tested** (which flows you actually exercised, and anything
      you could not verify).
- [ ] Explain any architectural change and its reasoning (rule 25).
- [ ] Do not commit unless explicitly asked.
