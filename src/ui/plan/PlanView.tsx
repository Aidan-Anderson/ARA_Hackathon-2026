// Track B: SVG plan view, tools, and the results overlay (spec §6.2, §6.3).
// Tickets B1.1, B2.x, B3.x, B4.1, B5.1.

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { crossSection } from '../../model/geometry'
import type { Axis, Point } from '../../model/project'
import { currentLevel, type AppViewProps } from '../../model/ui'
import { updateLevel } from './edit'
import type { EditorProps } from './editor'
import { addShearLineOnGridline, gridlines, hasShearLineOn, type Gridline } from './grid'
import { contentBox, fitView, toScreen, zoomAt, type Size, type View } from './view'
import './PlanView.css'

/** px that Gridlines run past the plan; the bubble sits beyond that. */
const OVERRUN = 20
/** px */
const BUBBLE_RADIUS = 11
/** px a press has to move before it pans instead of clicking. */
const DRAG_THRESHOLD = 4
/** Zoom per px of wheel travel. */
const WHEEL_ZOOM = 0.002
/** Plan size before the first measurement, and in server rendering. */
const DEFAULT_SIZE: Size = { width: 800, height: 600 }

interface Gesture {
  pointerId: number
  x: number
  y: number
  start: View
  panning: boolean
  /** The Gridline under a left-button press while the Shear Line tool is on. */
  gridline: Gridline | null
}

export function PlanView({ project, setProject, levelId, editor }: AppViewProps & EditorProps) {
  const level = currentLevel(project, levelId)
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [size, setSize] = useState(DEFAULT_SIZE)
  /** null: fitted to the plan, following edits and resizes. Zooming or panning sets it; "Fit" clears it. */
  const [view, setView] = useState<View | null>(null)
  const [panning, setPanning] = useState(false)

  const box = contentBox(project.grid, level)
  const fitted = fitView(box, size)
  const shown = view ?? fitted
  const screen = (p: Point) => toScreen(shown, p)
  const allGridlines = gridlines(project.grid)
  const addingLines = editor.mode === 'grid' && editor.tool === 'shearLine'

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (width > 0 && height > 0)
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // React's onWheel is passive, so it can't stop the page from zooming or scrolling: listen natively.
  const onWheel = useEffectEvent((event: WheelEvent) => {
    const svg = svgRef.current
    if (!svg) return
    event.preventDefault()
    const rect = svg.getBoundingClientRect()
    // Lines and pages to px, roughly.
    const px = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 33 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? rect.height : 1
    const at = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setView((prev) => zoomAt(prev ?? fitted, Math.exp(-event.deltaY * px * WHEEL_ZOOM), at))
  })
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const listener = (event: WheelEvent) => onWheel(event)
    svg.addEventListener('wheel', listener, { passive: false })
    return () => svg.removeEventListener('wheel', listener)
  }, [])

  function startGesture(event: PointerEvent<SVGSVGElement>) {
    // Left button: pan, or click a Gridline. Middle button: pan.
    if (event.button !== 0 && event.button !== 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const target = event.button === 0 ? (event.target as Element).closest('[data-gridline]') : null
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: shown,
      panning: false,
      gridline: target ? allGridlines[Number(target.getAttribute('data-gridline'))] : null,
    }
  }

  function moveGesture(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.panning) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      current.panning = true
      setPanning(true)
    }
    setView({ ...current.start, tx: current.start.tx + dx, ty: current.start.ty + dy })
  }

  function endGesture(event: PointerEvent<SVGSVGElement>, completed: boolean) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    setPanning(false)
    const gridline = current.gridline
    if (completed && !current.panning && gridline && addingLines)
      setProject((p) => updateLevel(p, levelId, (l) => addShearLineOnGridline(l, gridline)))
  }

  /** Screen ends of a Gridline, running OVERRUN past the plan; the second end is the bubble end. */
  function gridlineEnds(gridline: Gridline): [Point, Point] {
    if (gridline.direction === 'Y') {
      const top = screen({ x: gridline.position, y: box.yMax })
      const bottom = screen({ x: gridline.position, y: box.yMin })
      return [
        { x: top.x, y: top.y - OVERRUN },
        { x: bottom.x, y: bottom.y + OVERRUN },
      ]
    }
    const right = screen({ x: box.xMax, y: gridline.position })
    const left = screen({ x: box.xMin, y: gridline.position })
    return [
      { x: right.x + OVERRUN, y: right.y },
      { x: left.x - OVERRUN, y: left.y },
    ]
  }

  /** Bubbles go below numbered Gridlines and left of lettered ones. */
  function bubbleCenter(gridline: Gridline): Point {
    const [, end] = gridlineEnds(gridline)
    return gridline.direction === 'Y' ? { x: end.x, y: end.y + BUBBLE_RADIUS } : { x: end.x - BUBBLE_RADIUS, y: end.y }
  }

  const shearLines = level.shearLines.map((line) => {
    const extent = crossSection(level.outline, line.direction, line.position)
    // A line that misses the outline has no length; draw it across the plan so it can be seen.
    const [lo, hi] = extent ?? (line.direction === 'Y' ? [box.yMin, box.yMax] : [box.xMin, box.xMax])
    return {
      line,
      onOutline: extent !== null,
      from: screen(pointOn(line.direction, line.position, lo)),
      to: screen(pointOn(line.direction, line.position, hi)),
    }
  })

  return (
    <div className="plan">
      <svg
        ref={svgRef}
        className={panning ? 'plan-svg is-panning' : 'plan-svg'}
        aria-label="Plan view"
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={(event) => endGesture(event, true)}
        onPointerCancel={(event) => endGesture(event, false)}
        onLostPointerCapture={(event) => endGesture(event, false)}
        onMouseDown={stopAutoscroll}
      >
        <g className="gridlines">
          {allGridlines.map((gridline) => {
            const [a, b] = gridlineEnds(gridline)
            const c = bubbleCenter(gridline)
            return (
              <g key={gridline.name}>
                <line className="gridline" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <circle className="gridline-bubble" cx={c.x} cy={c.y} r={BUBBLE_RADIUS} />
                <text className="gridline-name" x={c.x} y={c.y}>
                  {gridline.name}
                </text>
              </g>
            )
          })}
        </g>

        <polygon
          className="outline"
          points={level.outline.map((p) => `${screen(p).x},${screen(p).y}`).join(' ')}
        />

        <g className="shear-lines">
          {shearLines.map(({ line, onOutline, from, to }) => (
            <line
              key={line.id}
              className={onOutline ? 'shear-line' : 'shear-line is-off'}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            >
              <title>{onOutline ? `Shear Line ${line.name}` : `Shear Line ${line.name} (misses the outline)`}</title>
            </line>
          ))}
        </g>

        <g className="lateral-elements">
          {level.shearLines.flatMap((line) =>
            line.lateralElements.map((element) => {
              const a = screen(pointOn(line.direction, line.position, element.start))
              const b = screen(pointOn(line.direction, line.position, element.end))
              return <line key={element.id} className="lateral-element" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            }),
          )}
        </g>

        <g className="shear-line-names">
          {shearLines.map(({ line, to }) =>
            line.direction === 'Y' ? (
              <text key={line.id} className="shear-line-name" x={to.x} y={to.y - 8} textAnchor="middle">
                {line.name}
              </text>
            ) : (
              <text key={line.id} className="shear-line-name" x={to.x + 8} y={to.y} dominantBaseline="central">
                {line.name}
              </text>
            ),
          )}
        </g>

        {addingLines && (
          <g className="gridline-targets">
            {allGridlines.map((gridline, index) => {
              if (hasShearLineOn(level, gridline)) return null
              const [a, b] = gridlineEnds(gridline)
              const c = bubbleCenter(gridline)
              return (
                <g key={gridline.name} className="gridline-target" data-gridline={index}>
                  <title>{`Add Shear Line ${gridline.name}`}</title>
                  <line className="gridline-target-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <circle className="gridline-target-hit" cx={c.x} cy={c.y} r={BUBBLE_RADIUS} />
                  <line className="gridline-target-hover" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <circle className="gridline-target-hover" cx={c.x} cy={c.y} r={BUBBLE_RADIUS} />
                </g>
              )
            })}
          </g>
        )}
      </svg>

      <button type="button" className="plan-fit" title="Zoom to fit the plan" onClick={() => setView(null)}>
        Fit
      </button>
      {addingLines && <p className="plan-hint">Click a Gridline to add a Shear Line on it.</p>}
    </div>
  )
}

/** The point `t` ft along a line in `direction` at `position`. */
function pointOn(direction: Axis, position: number, t: number): Point {
  return direction === 'Y' ? { x: position, y: t } : { x: t, y: position }
}

/** The middle button pans, so it must not start the browser's autoscroll. */
function stopAutoscroll(event: MouseEvent<SVGSVGElement>) {
  if (event.button === 1) event.preventDefault()
}
