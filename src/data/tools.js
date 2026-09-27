// Single source of truth for every drawing tool in the app.
//
// Before this file existed the same list was duplicated in three places
// (MapCanvas panel, Sidebar tools tab, and the keyboard handler) and the copies
// had drifted apart. Adding a tool now means adding ONE row here.
//
//  id       -> value stored in App's `activeTool` state, and the annotation
//              `type` the canvas creates (except 'select' / 'eraser', which are
//              interaction modes rather than annotation types).
//  key      -> keyboard shortcut. Handled by MapCanvas via KEY_TO_TOOL.
//  label    -> short name, used on the toolbar buttons and tool chips.
//  desc     -> longer name for the help modal's shortcut table.
//  group    -> 'primary' tools get a button in the main toolbar strip.
//              'more' tools live in the toolbar's overflow popover.
//
// KEY ALLOCATION (do not reuse a letter that is already taken):
//   V select · B pen · L line · A arrow · E double arrow · O circle ·
//   D rectangle · T text · P pin · W player · G vehicle · C compound ·
//   X eraser · M measure · N rotation path · S smoke · R ridge ·
//   Z danger zone · H vision cone · F flight 1 · 2 flight 2
// (H is the vision/FOV cone: "line of sig**h**t".)

import {
  MousePointer2,
  PenLine,
  Minus,
  MoveUpRight,
  ArrowLeftRight,
  CircleDot,
  Square,
  Type,
  MapPin,
  User,
  Home,
  Eraser,
  Cloud,
  Compass,
  Car,
  Plane,
  Ruler,
  Route,
  TriangleAlert,
  Eye,
} from 'lucide-react'

export const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select', desc: 'Select / Move / Resize / Rotate', key: 'V', group: 'primary' },
  { id: 'brush', icon: PenLine, label: 'Pen', desc: 'Freehand Pen', key: 'B', group: 'primary' },
  { id: 'line', icon: Minus, label: 'Line', desc: 'Straight Line', key: 'L', group: 'primary' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow', desc: 'Attack Arrow', key: 'A', group: 'primary' },
  { id: 'arrow2', icon: ArrowLeftRight, label: 'Dbl Arrow', desc: 'Double-Headed Arrow', key: 'E', group: 'primary' },
  { id: 'circle', icon: CircleDot, label: 'Circle', desc: 'Circle Annotation', key: 'O', group: 'primary' },
  { id: 'rect', icon: Square, label: 'Rectangle', desc: 'Rectangle Area', key: 'D', group: 'more' },
  { id: 'text', icon: Type, label: 'Text', desc: 'Text Note', key: 'T', group: 'primary' },
  { id: 'pin', icon: MapPin, label: 'Marker', desc: 'Drop Squad Marker', key: 'P', group: 'primary' },
  { id: 'player', icon: User, label: 'Player', desc: 'Player Marker', key: 'W', group: 'more' },
  { id: 'compound', icon: Home, label: 'Zone', desc: 'Compound Bounds', key: 'C', group: 'primary' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', desc: 'Erase Item Under Cursor', key: 'X', group: 'primary' },
  { id: 'measure', icon: Ruler, label: 'Measure', desc: 'Measurement Line', key: 'M', group: 'more' },
  { id: 'rotation', icon: Route, label: 'Rotation', desc: 'Rotation Path', key: 'N', group: 'more' },
  { id: 'smoke', icon: Cloud, label: 'Smoke', desc: 'Smoke Screen', key: 'S', group: 'more' },
  { id: 'ridge', icon: Compass, label: 'Ridge', desc: 'Ridge / Contour Line', key: 'R', group: 'more' },
  { id: 'danger', icon: TriangleAlert, label: 'Danger', desc: 'Danger Zone', key: 'Z', group: 'more' },
  { id: 'fov', icon: Eye, label: 'Vision', desc: 'Vision / FOV Cone', key: 'H', group: 'more' },
  { id: 'vehicle', icon: Car, label: 'Vehicle', desc: 'Vehicle Marker', key: 'G', group: 'more' },
  { id: 'flight1', icon: Plane, label: 'Flight Path', desc: 'Flight Path 1', key: 'F', group: 'more' },
  // Uses the "2" key rather than "F2" so it cannot collide with "F".
  { id: 'flight2', icon: Plane, label: 'Flight Path 2', desc: 'Flight Path 2', key: '2', group: 'more' },
]

export const PRIMARY_TOOLS = TOOLS.filter((t) => t.group === 'primary')
export const MORE_TOOLS = TOOLS.filter((t) => t.group === 'more')

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]))

// Maps an uppercase key press to a tool id.
export const KEY_TO_TOOL = Object.fromEntries(
  TOOLS.filter((t) => t.key).map((t) => [t.key, t.id]),
)

// Human-readable name for the active-tool readout.
export function toolLabel(id) {
  return TOOL_BY_ID[id]?.label || String(id || '').toUpperCase()
}
