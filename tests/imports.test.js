// Static import check.
//
// Vite/esbuild do not resolve free identifiers. A component that references an
// icon or helper it forgot to import compiles cleanly, `npm run build` exits 0,
// the whole unit suite stays green, and the app then dies on first render with
// a blank screen and a `ReferenceError` in the console.
//
// That happened three times while adding the Layers panel (App.jsx lost its
// `lib/layers` import, export.js lost its own, Sidebar.jsx used `EyeOff` after
// the old layer-toggles block was deleted). Each was invisible until a browser
// was opened. These tests make it a build failure instead.
//
// The check is intentionally narrow: it only looks at PascalCase JSX
// components and a few known helper names, which is where the mistakes happen.
// It never tries to be a type checker.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(here, '..', 'src')

const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (/\.jsx?$/.test(entry.name)) out.push(p)
  }
  return out
}

const FILES = walk(SRC).map((f) => ({ file: path.relative(path.join(here, '..'), f), src: readFileSync(f, 'utf8') }))

/** Everything bound by an import statement, keyed by local name. */
function importedNames(src) {
  const names = new Set()
  const re = /import\s+(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\}|\*\s+as\s+([\w$]+)|([\w$]+))?\s*from\s*['"][^'"]+['"]/g
  let m
  while ((m = re.exec(src))) {
    if (m[1]) names.add(m[1])
    if (m[3]) names.add(m[3])
    if (m[4]) names.add(m[4])
    for (const part of (m[2] || '').split(',')) {
      const t = part.trim()
      if (!t) continue
      const as = t.split(/\s+as\s+/)
      names.add((as[1] || as[0]).trim())
    }
  }
  // Namespace imports bind whatever is destructured from them.
  for (const m of src.matchAll(/import\s+\*\s+as\s+([\w$]+)\s+from/g)) names.add(m[1])
  return names
}

/** Source with every import statement removed, so usages are seen on their own. */
const withoutImports = (src) =>
  src
    .replace(/import\s+(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*\s+as\s+[\w$]+|[\w$]+)?\s*from\s*['"][^'"]+['"];?/g, '')
    .replace(/import\s*['"][^'"]+['"];?/g, '')

/** PascalCase names used as JSX elements: `<Foo ...` / `</Foo>`. */
function jsxComponents(src) {
  const used = new Set()
  for (const m of withoutImports(src).matchAll(/<\/?([A-Z][\w$]*)/g)) used.add(m[1])
  return used
}

/** Names that are genuinely ambient and need no import. */
const GLOBALS = new Set([
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Set', 'Map', 'WeakMap',
  'Promise', 'Date', 'Error', 'console', 'window', 'document', 'localStorage', 'navigator',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout',
  'ResizeObserver', 'FileReader', 'Image', 'TextEncoder', 'TextDecoder', 'URL', 'Blob', 'isNaN',
  'parseFloat', 'parseInt', 'React', 'Fragment', 'arguments', 'undefined', 'true', 'false',
])

const LITERALS = new Set([
  'null', 'undefined', 'true', 'false', 'this', 'arguments', 'const', 'let', 'var',
  'return', 'if', 'else', 'new', 'typeof', 'await', 'async', 'function', 'void',
  'delete', 'in', 'of', 'do', 'while', 'for', 'switch', 'case', 'break', 'continue', 'throw', 'try', 'catch',
])

/**
 * Real lucide-react export names, read from the installed package.
 *
 * Cross-referencing against this is what keeps the check precise. A local
 * component called `Icon` or `Row` will never appear here, so it can never be
 * reported; a real icon like `EyeOff` only shows up if the file uses it without
 * importing it, which is exactly the bug.
 */
const LUCIDE = new Set(
  [...readFileSync(path.join(here, '..', 'node_modules', 'lucide-react', 'dist', 'lucide-react.d.ts'), 'utf8')
    .matchAll(/declare const ([A-Z][\w$]*)/g)]
    .map((m) => m[1]),
)

test('every lucide icon used is imported from lucide-react', () => {
  assert.ok(LUCIDE.size > 1000, 'read the real lucide export list')
  const problems = []
  for (const { file, src } of FILES) {
    const body = withoutImports(src)
    const bound = importedNames(src)
    for (const m of body.matchAll(/<\/?([A-Z][\w$]*)/g)) {
      const name = m[1]
      if (!LUCIDE.has(name)) continue
      if (bound.has(name)) continue
      // Bound locally in this file, so it shadows any icon of the same name.
      // Covers `const Icon = x`, `function Icon(){}` and the very common
      // destructured-prop rename `icon: Icon`.
      const declared = new RegExp(
        `(?:const|let|var|function|class)\\s+${name}\\b` +
          `|\\b[A-Za-z_$][\\w$]*\\s*:\\s*${name}\\s*[,}]` +
          `|(?:\\(\\s*[^)]*\\b[A-Za-z_$][\\w$]*\\s*:\\s*${name}\\s*[,}])`,
      ).test(body)
      if (declared) continue
      problems.push(`${file}: <${name}> is a lucide icon used but not imported`)
    }
  }
  assert.deepEqual(problems, [], 'a missing icon import renders a blank screen at runtime')
})

test('every locally-declared helper used across files is imported', () => {
  // Covers the layers regression specifically: App.jsx and export.js both used
  // lib/layers helpers with no import statement, and the build stayed green.
  const moduleFiles = FILES.filter((f) => f.file.startsWith('src/lib/') && f.file.endsWith('.js'))
  const moduleExports = new Map()
  for (const { file, src } of moduleFiles) {
    const names = new Set()
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([\w$]+)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s+const\s+([\w$]+)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const t = part.trim()
        if (t) names.add((t.split(/\s+as\s+/)[1] || t).trim())
      }
    }
    moduleExports.set(file, names)
  }

  const problems = []
  for (const { file, src } of FILES) {
    const body = withoutImports(src)
    for (const m of body.matchAll(/from\s*['"](?:\.\.\/)?(?:lib\/)?([\w/]+)['"]/g)) {
      const spec = m[1]
      const target = spec.startsWith('lib/')
        ? `src/${spec}`
        : file.includes('/components/') || file.startsWith('src/components')
          ? `src/lib/${spec}`
          : `src/${spec}`
      const exported = moduleExports.get(target)
      if (!exported) continue
      const bound = importedNames(src)
      const specRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*${spec.split('/').pop()}\\.[jt]sx?['"]`)
      const specMatch = src.match(specRe)
      const specNames = new Set(
        (specMatch ? specMatch[1] : '')
          .split(',')
          .map((x) => x.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean),
      )
      for (const name of exported) {
        if (bound.has(name) || specNames.has(name)) continue
        const re = new RegExp(`(?<![\\w$.'"\`])${name}(?![\\w$])`)
        if (re.test(body)) problems.push(`${file}: uses ${name}() from ${target} but does not import it`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('the project still has no hard-coded inspector offsets in the canvas', () => {
  // A guard left in place from the panel layout rules, cheap to keep.
  const canvas = FILES.find((f) => f.file.endsWith('MapCanvas.jsx'))
  assert.ok(canvas, 'MapCanvas.jsx exists')
  assert.doesNotMatch(canvas.src, /right-\[292px\]/)
})

/**
 * The body of every `onXxx={...}` prop, brace-matched so a block-bodied handler
 * is captured whole. Returns the inner text of each handler.
 */
function handlerExpressions(src) {
  const out = []
  const re = /\bon[A-Z][\w$]*\s*=\s*\{/g
  let m
  while ((m = re.exec(src))) {
    let depth = 0
    let i = m.index + m[0].length - 1
    const start = i + 1
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth === 0) out.push({ expr: src.slice(start, i), offset: start })
    re.lastIndex = i + 1
  }
  return out
}

/**
 * Every name bound by a destructuring pattern in `src`, wherever it appears:
 * a `const { a, b } = x`, a `function f({ a })`, or an arrow `([a, b]) =>`.
 * Brace/bracket matched, because a props list can contain a nested object
 * default that a `[^}]*` pattern truncates.
 */
function destructuredNames(src) {
  const names = new Set()
  const push = (raw) => {
    // A parameter list arrives wrapped in its own brackets: `({ a, b }) =>`.
    // Strip one layer first, or depth starts at 1 and nothing ever splits.
    // Comments glue onto the name that follows them in a comma-separated
    // segment, so `\n // why\n updateAnnoField` stops looking like an
    // identifier. Strip them before splitting.
    let chunk = raw
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
      .trim()
    if (/^[({[]/.test(chunk) && /[)\]}]$/.test(chunk)) chunk = chunk.slice(1, -1)
    let depth = 0
    let cur = ''
    const parts = []
    for (const ch of chunk) {
      if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') depth--
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue }
      cur += ch
    }
    parts.push(cur)
    for (const part of parts) {
      const t = part.trim().split(/[:=]/)[0].trim()
      if (t && /^[A-Za-z_$][\w$]*$/.test(t)) names.add(t)
    }
  }

  // `const { ... }` / `let [` / `var [`
  const decl = /\b(?:const|let|var)\s*[\[{]/g
  let m
  while ((m = decl.exec(src))) {
    const open = m[0].trim().slice(-1)
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let i = m.index + m[0].length - 1
    const start = i + 1
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === open) depth++
      else if (c === close) { depth--; if (depth === 0) break }
    }
    if (depth === 0) push(src.slice(start, i))
    decl.lastIndex = i + 1
  }

  // Function and arrow parameters: `(a, { b }, [c])` before `=>` or in `function`
  for (const pm of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) push(pm[1])
  return names
}

test('every callback referenced in a JSX handler is bound in that file', () => {
  // A component that calls a callback it never received does not fail to
  // compile and does not fail to render — it throws the first time the user
  // touches that control. `Sidebar.jsx` called `updateAnnoField` in the
  // inspector's field handler while never destructuring it, so every inspector
  // field edit was a silent no-op wrapped in a ReferenceError.
  const problems = []
  for (const { file, src } of FILES) {
    const body = withoutImports(src)
    const bound = new Set()
    for (const n of importedNames(src)) bound.add(n)
    // Destructured props (everywhere they appear) and any local declaration
    // count as bound.
    for (const m of src.matchAll(/\b(?:const|let|var|function|class)\s+([\w$]+)/g)) bound.add(m[1])
    for (const n of destructuredNames(src)) bound.add(n)

    // Bare identifiers inside inline handler props. Brace matching rather than
    // a regex, because `onChange={(patch) => { ... }}` has a block body and a
    // non-greedy pattern skips it entirely — which is exactly how the
    // updateAnnoField bug stayed hidden.
    for (const { expr, offset } of handlerExpressions(body)) {
      // Strip comments and string literals: neither is a reference. Without
      // this, prose in a comment and a key in an object literal both look like
      // free identifiers.
      const e = expr
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')

      for (const id of e.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const name = id[0]
        if (!/^[a-z]/.test(name)) continue
        if (bound.has(name)) continue
        if (GLOBALS.has(name) || LITERALS.has(name)) continue

        const before = e.slice(0, id.index).trimEnd()
        const after = e.slice(id.index + name.length).trimStart()
        // `foo.bar` / `foo?.bar` is a member read, not a free reference.
        if (/(?:\.|\?\.)$/.test(before)) continue
        // `key:` inside an object literal is a key, not a reference.
        if (/^:/.test(after)) continue
        // Shorthand `{ name }` is a genuine reference, so only `: ` is skipped.
        if (/^(?:=|\|\||&&|\?)/.test(after) && !/^:/.test(after)) continue
        // Locals declared inside the handler body are fine.
        if (new RegExp(`(?:const|let|var|function)\\s+${name}\\b`).test(e)) continue

        const line = body.slice(0, offset).split('\n').length
        problems.push(
          `${file}:${line}: a JSX handler references ${name}, which is not bound in this file`,
        )
      }
    }
  }
  assert.deepEqual(problems, [], 'an unbound callback throws on first use, not at build time')
})
