// The inspector's layout schema, kept in plain JS so it can be unit tested
// without pulling in a JSX transform (the project takes no new dependencies).
//
// `PropControls.jsx` imports these and renders; nothing else may hardcode a
// section name. If a property kind appears in the registry but has no entry
// here, the control would fall through to a boolean toggle — the exact class of
// "control that silently does nothing" this refactor exists to prevent, so
// `inspector.test.js` fails the build on it instead.

/** Every `kind` that `PropControl` knows how to render. */
export const CONTROL_KINDS = new Set([
  'color',
  'opacity',
  'stroke',
  'size',
  'rotation',
  'text',
  'fontSize',
  'fontWeight',
  'radius',
  'fovAngle',
  'fovRange',
  'logoUrl',
  'bool',
])

/** The section headings an inspector may show, in display order. */
export const SECTIONS = [
  'Identity',
  'Geometry',
  'Typography',
  'Appearance',
  'Transform',
  'Options',
]

const SECTION_FOR = {
  text: 'Identity',
  logoUrl: 'Identity',
  radius: 'Geometry',
  fovRange: 'Geometry',
  fovAngle: 'Geometry',
  fontSize: 'Typography',
  fontWeight: 'Typography',
  color: 'Appearance',
  opacity: 'Appearance',
  stroke: 'Appearance',
  size: 'Appearance',
  rotation: 'Transform',
  bool: 'Options',
}

/** Which section a property kind belongs to, or null if it has no home. */
export function sectionFor(kind) {
  return SECTION_FOR[kind] || null
}

/**
 * Split a flat property list into ordered sections.
 *
 * Section order follows `SECTIONS`, not first appearance, so the inspector
 * reads Geometry before Appearance regardless of the order a type happens to
 * list its properties in. Every descriptor is placed exactly once.
 */
export function groupProps(props = []) {
  const bySection = new Map(SECTIONS.map((s) => [s, []]))
  const orphans = []
  for (const prop of props) {
    const section = sectionFor(prop.kind)
    if (!section) {
      orphans.push(prop)
      continue
    }
    bySection.get(section).push(prop)
  }
  const groups = {}
  for (const s of SECTIONS) {
    if (bySection.get(s).length > 0) groups[s] = bySection.get(s)
  }
  return { groups, orphans }
}
