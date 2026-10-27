// Track B: the SVG plan view (spec §6.2). Wheel zooms about the cursor; dragging with Select (or the
// middle button) pans; Fit resets. Tools turn clicks into edits of the current Level.

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { checkOutline } from '../../model/outline'
import type { Level, Point, Project } from '../../model/project'
import { currentLevel, type AppViewProps, type EditorState, type Selection } from '../../model/ui'
import { sameSelection } from '../panels/selection'
import { addOpening, addShearLine, removeItem, setOutline } from './edit'
import { gridlines, nearestGridline, type Gridline } from './grid'
import { hitTest, type Hit } from './hitTest'
import {
  DraftLayer,
  GridLayer,
  LinePreview,
  OpeningLayer,
  OutlineLayer,
  PlanDefs,
  RectPreview,
  ShearLineLayer,
} from './layers'
import { closeOutline, drawnLineName, nextVertex, snapLinePosition, snapPoint, type SnapContext } from './snap'
import { useElementSize } from './useElementSize'
import { boundsOf, fitViewport, toPlan, zoomAt, type Bounds, type Viewport } from './viewport'
import './PlanView.css'

/** Used until the container has been measured (and in server-side render tests). */
const DEFAULT_SIZE = { width: 800, height: 600 }
/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP_PX = 4
/** How close (on screen) the cursor must be to snap to a Gridline or corner. */
const SNAP_PX = 10

type Drag = {
  kind: 'pan' | 'click' | 'rect'
  x: number
  y: number
  start: Viewport
  moved: boolean
  /** Plan corner where an Opening rectangle started. */
  anchor?: Point
}

/** An outline being drawn, tied to the Level it was started on. */
type Draft = { levelId: string; points: Point[] }

function toSelection(hit: Hit, levelId: string): Selection {
  return hit.kind === 'lateralElement'
    ? { kind: 'lateralElement', levelId, lineId: hit.lineId, id: hit.id }
    : { kind: hit.kind, levelId, id: hit.id }
}

function hint(editor: EditorState, drafting: boolean): string {
  if (editor.tool === 'select') return 'Click to select; drag to pan; scroll to zoom.'
  if (editor.tool === 'opening') return 'Drag a rectangle to add an Opening (stair, shaft).'
  if (editor.tool === 'delete') return 'Click a Shear Line, Lateral Element, or Opening to delete it.'
  if (editor.tool === 'outline') {
    return drafting
      ? 'Click the next corner. Click the first corner or press Enter to close; Backspace undoes; Esc cancels.'
      : 'Click the first corner of the outline.'
  }
  if (editor.tool === 'shearLine') {
    return editor.mode === 'grid'
      ? 'Click a Gridline to add a Shear Line on it.'
      : `Click to add a Shear Line in ${editor.lineDirection}.`
  }
  return ''
}

export function PlanView({ project, setProject, levelId, editor, selection, setSelection }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const lines = gridlines(project.grid)
  const bounds = planBounds(project, level)
  const [container, measured] = useElementSize<HTMLDivElement>()
  const size = measured ?? DEFAULT_SIZE
  const [userViewport, setUserViewport] = useState<Viewport | null>(null)
  const v = userViewport ?? fitViewport(bounds, size.width, size.height)
  const [hover, setHover] = useState<Point | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rect, setRect] = useState<{ a: Point; b: Point } | null>(null)
  const drag = useRef<Drag | null>(null)

  // A draft only counts on the Level and tool it was started with.
  const drafting = draft && draft.levelId === level.id && editor.tool === 'outline' ? draft.points : null
  const tolerance = SNAP_PX / v.scale
  const snap: SnapContext = {
    mode: editor.mode,
    vertices: [
      ...level.outline,
      ...(drafting ?? []),
      ...level.openings.flatMap((o) => [
        { x: o.xMin, y: o.yMin },
        { x: o.xMax, y: o.yMax },
      ]),
    ],
    gridlines: lines,
    tolerance,
  }
  const outlineCheck = checkOutline(level.outline)

  const gridTarget = (at: Point | null): Gridline | null =>
    at && editor.mode === 'grid' && editor.tool === 'shearLine' ? nearestGridline(lines, at, tolerance) : null
  const closable = (at: Point | null) =>
    !!drafting && drafting.length >= 3 && !!at && Math.hypot(at.x - drafting[0].x, at.y - drafting[0].y) <= tolerance

  function finishOutline(points: Point[]) {
    const outline = closeOutline(points)
    setDraft(null)
    if (outline.length >= 4) setProject((p: Project) => setOutline(p, level.id, outline))
  }

  // Keys while drawing: Esc cancels, Enter closes, Backspace removes the last corner.
  useEffect(() => {
    if (!drafting) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.key === 'Escape') setDraft(null)
      else if (event.key === 'Enter') finishOutline(drafting)
      else if (event.key === 'Backspace') {
        event.preventDefault()
        setDraft(drafting.length > 1 ? { levelId: level.id, points: drafting.slice(0, -1) } : null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function local(event: { clientX: number; clientY: number; currentTarget: Element }) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const p = local(event)
    const pan = event.button === 1 || (event.button === 0 && editor.tool === 'select')
    if (event.button === 0 && editor.tool === 'opening') {
      const anchor = snapPoint(toPlan(v, p.x, p.y), snap)
      drag.current = { kind: 'rect', ...p, start: v, moved: false, anchor }
      setRect({ a: anchor, b: anchor })
    } else {
      drag.current = { kind: pan ? 'pan' : 'click', ...p, start: v, moved: false }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const p = local(event)
    const at = toPlan(v, p.x, p.y)
    setHover(at)
    const d = drag.current
    if (!d) return
    if (Math.hypot(p.x - d.x, p.y - d.y) > CLICK_SLOP_PX) d.moved = true
    if (d.kind === 'pan' && d.moved) setUserViewport({ ...d.start, ox: d.start.ox + p.x - d.x, oy: d.start.oy + p.y - d.y })
    if (d.kind === 'rect' && d.anchor) setRect({ a: d.anchor, b: snapPoint(at, snap) })
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    drag.current = null
    if (!d || event.button !== 0) return
    const p = local(event)
    const at = toPlan(v, p.x, p.y)
    if (d.kind === 'rect' && d.anchor) {
      const corner = snapPoint(at, snap)
      setRect(null)
      setProject((p) => addOpening(p, level.id, d.anchor!, corner))
      return
    }
    if (!d.moved) click(at)
  }

  function click(at: Point) {
    const hit = hitTest(level, bounds, at, tolerance)
    if (editor.tool === 'select') {
      setSelection(hit ? toSelection(hit, level.id) : null)
    } else if (editor.tool === 'delete') {
      if (!hit) return
      setProject((p) => removeItem(p, level.id, hit))
      if (sameSelection(selection, toSelection(hit, level.id))) setSelection(null)
    } else if (editor.tool === 'shearLine') {
      if (editor.mode === 'grid') {
        const target = gridTarget(at)
        if (target) {
          setProject((p) =>
            addShearLine(p, level.id, { name: target.label, direction: target.direction, position: target.position }, editor.elementKind),
          )
        }
      } else {
        const direction = editor.lineDirection
        const position = snapLinePosition(at, direction, snap)
        setProject((p) => addShearLine(p, level.id, { name: drawnLineName(direction, position), direction, position }, editor.elementKind))
      }
    } else if (editor.tool === 'outline') {
      if (closable(at)) return finishOutline(drafting!)
      const corner = nextVertex(drafting?.at(-1) ?? null, at, snap)
      const last = drafting?.at(-1)
      if (last && last.x === corner.x && last.y === corner.y) return // a zero-length edge
      setDraft({ levelId: level.id, points: [...(drafting ?? []), corner] })
    }
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    const p = local(event)
    setUserViewport(zoomAt(v, Math.exp(-event.deltaY * 0.0015), p.x, p.y))
  }

  const nextCorner = editor.tool === 'outline' && hover ? (closable(hover) ? drafting![0] : nextVertex(drafting?.at(-1) ?? null, hover, snap)) : null
  const linePreview =
    editor.tool === 'shearLine' && editor.mode !== 'grid' && hover ? snapLinePosition(hover, editor.lineDirection, snap) : null

  return (
    <div ref={container} className={`plan-view tool-${editor.tool}`}>
      <svg
        width={size.width}
        height={size.height}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
      >
        <PlanDefs />
        <GridLayer lines={lines} v={v} bounds={bounds} highlight={gridTarget(hover)} />
        <OutlineLayer level={level} v={v} />
        <OpeningLayer level={level} v={v} selection={selection} />
        <ShearLineLayer level={level} v={v} bounds={bounds} selection={selection} />
        {rect && <RectPreview a={rect.a} b={rect.b} v={v} />}
        {linePreview !== null && <LinePreview direction={editor.lineDirection} position={linePreview} bounds={bounds} v={v} />}
        {(drafting || nextCorner) && <DraftLayer points={drafting ?? []} next={nextCorner} closable={closable(hover)} v={v} />}
      </svg>
      {!outlineCheck.ok && (
        <div className="plan-banner" role="alert">
          {outlineCheck.message} {level.name} has no results until the outline is fixed.
        </div>
      )}
      <div className="plan-controls">
        <button title="Zoom in" onClick={() => setUserViewport(zoomAt(v, 1.25, size.width / 2, size.height / 2))}>
          +
        </button>
        <button title="Zoom out" onClick={() => setUserViewport(zoomAt(v, 0.8, size.width / 2, size.height / 2))}>
          −
        </button>
        <button title="Fit the plan in view" onClick={() => setUserViewport(null)}>
          Fit
        </button>
      </div>
      <div className="plan-status">
        {hover ? `x ${hover.x.toFixed(1)}, y ${hover.y.toFixed(1)} ft · ` : ''}
        {level.name} · {hint(editor, !!drafting)}
      </div>
    </div>
  )
}

/** What Fit shows: the Level's outline and the whole Grid. */
function planBounds(project: Project, level: Level): Bounds {
  const width = project.grid.xSpacings.reduce((sum, s) => sum + s, 0)
  const depth = project.grid.ySpacings.reduce((sum, s) => sum + s, 0)
  return boundsOf([...level.outline, { x: 0, y: 0 }, { x: width, y: depth }])!
}
