// Track B: the SVG plan view (spec §6.2). Wheel zooms about the cursor; dragging empty plan with
// Select (or the middle button) pans; dragging a Shear Line with Select moves it; Fit resets.
// Tools turn clicks and drags into edits of the current Level.

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { checkOutline } from '../../model/outline'
import type { Level, Point, Project } from '../../model/project'
import { currentLevel, type AppViewProps, type EditorState, type Selection } from '../../model/ui'
import { sameSelection } from '../panels/selection'
import { addElement, addOpening, addShearLine, moveShearLine, removeItem, setOutline } from './edit'
import { GhostLayer } from './GhostLayer'
import { gridlines, nearestGridline, type Gridline } from './grid'
import { hitTest, type Hit } from './hitTest'
import {
  DraftLayer,
  ElementPreview,
  GridLayer,
  LinePreview,
  OpeningLayer,
  OutlineLayer,
  PlanDefs,
  RectPreview,
  ShearLineLayer,
} from './layers'
import { levelBelow } from './levels'
import {
  closeOutline,
  drawnLineName,
  nextVertex,
  snapAlong,
  snapLinePosition,
  snapPoint,
  type SnapContext,
} from './snap'
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
  kind: 'pan' | 'click' | 'rect' | 'element' | 'moveLine'
  x: number
  y: number
  start: Viewport
  moved: boolean
  /** Plan corner where an Opening rectangle started. */
  anchor?: Point
  /** The Shear Line being moved, or being drawn on with the Element tool. */
  lineId?: string
  /** Where a new Lateral Element started along its line. */
  along?: number
  /** What a Select press landed on, selected if the press turns out to be a click. */
  hit?: Hit
}

/** An outline being drawn, tied to the Level it was started on. */
type Draft = { levelId: string; points: Point[] }

function toSelection(hit: Hit, levelId: string): Selection {
  return hit.kind === 'lateralElement'
    ? { kind: 'lateralElement', levelId, lineId: hit.lineId, id: hit.id }
    : { kind: hit.kind, levelId, id: hit.id }
}

function hint(editor: EditorState, drafting: boolean): string {
  if (editor.tool === 'select') return 'Click to select; drag a Shear Line to move it; drag elsewhere to pan; scroll to zoom.'
  if (editor.tool === 'element') {
    return `Drag along a Shear Line to add a ${editor.elementKind === 'bracedFrame' ? 'braced frame' : 'shear wall'}.`
  }
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
  const below = levelBelow(project, level.id)
  const lines = gridlines(project.grid)
  const bounds = planBounds(project, level)
  const [container, measured] = useElementSize<HTMLDivElement>()
  const size = measured ?? DEFAULT_SIZE
  const [userViewport, setUserViewport] = useState<Viewport | null>(null)
  const v = userViewport ?? fitViewport(bounds, size.width, size.height)
  const [hover, setHover] = useState<Point | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rect, setRect] = useState<{ a: Point; b: Point } | null>(null)
  const [newElement, setNewElement] = useState<{ lineId: string; a: number; b: number } | null>(null)
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

  /** The Shear Line under p: directly, or through one of its Lateral Elements. */
  function lineUnder(p: Point): { hit: Hit; lineId: string } | null {
    const hit = hitTest(level, bounds, p, tolerance)
    if (hit?.kind === 'lateralElement') return { hit, lineId: hit.lineId }
    if (hit?.kind === 'shearLine') return { hit, lineId: hit.id }
    return null
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const p = local(event)
    const at = toPlan(v, p.x, p.y)
    const base = { ...p, start: v, moved: false }
    const under = event.button === 0 && (editor.tool === 'select' || editor.tool === 'element') ? lineUnder(at) : null
    const line = under && level.shearLines.find((l) => l.id === under.lineId)

    if (event.button === 0 && editor.tool === 'opening') {
      const anchor = snapPoint(at, snap)
      drag.current = { kind: 'rect', ...base, anchor }
      setRect({ a: anchor, b: anchor })
    } else if (editor.tool === 'element' && line) {
      const along = snapAlong(line.direction, at, snap)
      drag.current = { kind: 'element', ...base, lineId: line.id, along }
      setNewElement({ lineId: line.id, a: along, b: along })
    } else if (editor.tool === 'select' && under) {
      drag.current = { kind: 'moveLine', ...base, lineId: under.lineId, hit: under.hit }
    } else {
      const pan = event.button === 1 || (event.button === 0 && editor.tool === 'select')
      drag.current = { kind: pan ? 'pan' : 'click', ...base }
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
    const line = d.lineId ? level.shearLines.find((l) => l.id === d.lineId) : undefined
    if (d.kind === 'pan' && d.moved) setUserViewport({ ...d.start, ox: d.start.ox + p.x - d.x, oy: d.start.oy + p.y - d.y })
    if (d.kind === 'rect' && d.anchor) setRect({ a: d.anchor, b: snapPoint(at, snap) })
    if (d.kind === 'element' && line && d.along !== undefined) {
      setNewElement({ lineId: line.id, a: d.along, b: snapAlong(line.direction, at, snap) })
    }
    if (d.kind === 'moveLine' && d.moved && line) {
      // Results update live as the line moves.
      const position = snapLinePosition(at, line.direction, snap)
      if (position !== line.position) setProject((p) => moveShearLine(p, level.id, line.id, position, lines))
    }
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
    if (d.kind === 'element') {
      const line = level.shearLines.find((l) => l.id === d.lineId)
      setNewElement(null)
      if (d.moved && line && d.along !== undefined) {
        const end = snapAlong(line.direction, at, snap)
        setProject((p) => addElement(p, level.id, line.id, d.along!, end, editor.elementKind))
      }
      return
    }
    if (d.kind === 'moveLine') {
      if (!d.moved && d.hit) setSelection(toSelection(d.hit, level.id))
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
        {editor.layers.ghost && below && <GhostLayer level={below} v={v} bounds={bounds} />}
        <ShearLineLayer level={level} v={v} bounds={bounds} selection={selection} />
        {rect && <RectPreview a={rect.a} b={rect.b} v={v} />}
        {newElement && (
          <ElementPreview
            line={level.shearLines.find((l) => l.id === newElement.lineId)}
            a={newElement.a}
            b={newElement.b}
            kind={editor.elementKind}
            v={v}
          />
        )}
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
