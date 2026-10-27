// Track B: the SVG plan view (spec §6.2). Wheel zooms about the cursor; dragging with Select (or the
// middle button) pans; Fit resets. Tools turn clicks into edits of the current Level.

import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import type { Level, Point, Project } from '../../model/project'
import { currentLevel, type AppViewProps, type EditorState } from '../../model/ui'
import { addShearLine } from './edit'
import { gridlines, nearestGridline, type Gridline } from './grid'
import { GridLayer, OutlineLayer, ShearLineLayer } from './layers'
import { useElementSize } from './useElementSize'
import { boundsOf, fitViewport, toPlan, zoomAt, type Bounds, type Viewport } from './viewport'
import './PlanView.css'

/** Used until the container has been measured (and in server-side render tests). */
const DEFAULT_SIZE = { width: 800, height: 600 }
/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP_PX = 4
/** How close (on screen) a click must be to a Gridline to pick it. */
const SNAP_PX = 10

type Drag = { kind: 'pan' | 'click'; x: number; y: number; start: Viewport; moved: boolean }

const HINTS: Partial<Record<EditorState['tool'], string>> = {
  select: 'Drag to pan, scroll to zoom.',
  shearLine: 'Click a Gridline to add a Shear Line on it.',
}

export function PlanView({ project, setProject, levelId, editor, selection }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const lines = gridlines(project.grid)
  const bounds = planBounds(project, level)
  const [container, measured] = useElementSize<HTMLDivElement>()
  const size = measured ?? DEFAULT_SIZE
  const [userViewport, setUserViewport] = useState<Viewport | null>(null)
  const v = userViewport ?? fitViewport(bounds, size.width, size.height)
  const [hover, setHover] = useState<Point | null>(null)
  const drag = useRef<Drag | null>(null)

  const gridTarget = (at: Point | null): Gridline | null =>
    at && editor.mode === 'grid' && editor.tool === 'shearLine' ? nearestGridline(lines, at, SNAP_PX / v.scale) : null

  function local(event: { clientX: number; clientY: number; currentTarget: Element }) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const p = local(event)
    const pan = event.button === 1 || (event.button === 0 && editor.tool === 'select')
    drag.current = { kind: pan ? 'pan' : 'click', ...p, start: v, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const p = local(event)
    setHover(toPlan(v, p.x, p.y))
    const d = drag.current
    if (!d) return
    if (Math.hypot(p.x - d.x, p.y - d.y) > CLICK_SLOP_PX) d.moved = true
    if (d.kind === 'pan' && d.moved) setUserViewport({ ...d.start, ox: d.start.ox + p.x - d.x, oy: d.start.oy + p.y - d.y })
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    const p = local(event)
    click(toPlan(v, p.x, p.y))
  }

  function click(at: Point) {
    const target = gridTarget(at)
    if (target) {
      setProject((p: Project) =>
        addShearLine(p, level.id, { name: target.label, direction: target.direction, position: target.position }, editor.elementKind),
      )
    }
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    const p = local(event)
    setUserViewport(zoomAt(v, Math.exp(-event.deltaY * 0.0015), p.x, p.y))
  }

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
        <GridLayer lines={lines} v={v} bounds={bounds} highlight={gridTarget(hover)} />
        <OutlineLayer level={level} v={v} />
        <ShearLineLayer level={level} v={v} bounds={bounds} selection={selection} />
      </svg>
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
        {level.name} · {HINTS[editor.tool] ?? ''}
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
