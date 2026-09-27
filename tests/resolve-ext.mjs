// A Node module-resolution hook that lets `node --test` load the app's source
// directly.
//
// The project is bundled by Vite, which resolves extensionless relative imports
// like `import { x } from './geometry'`. Node's ESM loader does not, so without
// this hook every test would have to import a copy of the code instead of the
// real thing — and tests that exercise a copy are worthless.
//
// This hook adds `.js` (and `/index.js`) to the candidates for RELATIVE
// specifiers only. It is registered by `tests/setup.mjs` and is not part of the
// application build; nothing in `src/` knows it exists.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const CANDIDATE_SUFFIXES = ['.js', '.jsx', '/index.js', '/index.jsx']

export async function resolve(specifier, context, nextResolve) {
  // Only relative specifiers are candidates. Bare specifiers ('react',
  // 'lucide-react') must keep going through normal node_modules resolution,
  // and leaving them alone means this hook cannot mask a real dependency bug.
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  if (!isRelative || context.parentURL == null) return nextResolve(specifier, context)

  // Already a real file, or a package subpath — hand it straight back.
  if (/\.(js|jsx|mjs|cjs|json|css)$/.test(specifier)) return nextResolve(specifier, context)

  const parentDir = dirname(fileURLToPath(context.parentURL))
  const base = resolvePath(parentDir, specifier)
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true, format: 'module' }
    }
  }

  // No candidate matched. Let Node produce its normal, helpful error.
  return nextResolve(specifier, context)
}
