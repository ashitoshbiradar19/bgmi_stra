// Registers the extensionless-import resolve hook before any test file runs.
// See `resolve-ext.mjs` for why this is needed.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./resolve-ext.mjs', pathToFileURL(import.meta.filename))
