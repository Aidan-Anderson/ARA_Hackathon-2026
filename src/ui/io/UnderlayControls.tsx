// Track B (B5.1): Import-mode controls for the current Level's Underlay (spec §6.7): import a PNG,
// JPG, or PDF, calibrate its scale, set its opacity, lock it, or remove it.

import { useRef, useState } from 'react'
import { currentLevel, type AppViewProps } from '../../model/ui'
import { setUnderlay } from '../plan/edit'
import { placeUnderlay } from './underlay'
import { readUnderlayFile } from './underlayFile'

export function UnderlayControls({ project, setProject, levelId, editor, setEditor }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null)
  const underlay = level.underlay

  async function importFile(file: File | undefined) {
    if (!file) return
    setStatus({ text: `Reading ${file.name}…`, error: false })
    try {
      const image = await readUnderlayFile(file)
      // A first guess at the scale: as wide as the Grid (or the outline). Calibrate fixes it.
      const gridWidth = project.grid.xSpacings.reduce((sum, s) => sum + s, 0)
      const xs = level.outline.map((p) => p.x)
      const planWidth = gridWidth > 0 ? gridWidth : Math.max(...xs) - Math.min(...xs)
      setProject((p) => setUnderlay(p, level.id, placeUnderlay(image, planWidth)))
      setEditor((e) => ({ ...e, tool: 'calibrate', underlayLocked: false }))
      setStatus(null)
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  return (
    <div className="underlay-controls" role="group" aria-label="Underlay">
      <span className="segmented-label">Underlay</span>
      <button onClick={() => fileInput.current?.click()}>{underlay ? 'Replace…' : 'Import image or PDF…'}</button>
      <input
        ref={fileInput}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        hidden
        onChange={(event) => {
          void importFile(event.target.files?.[0])
          event.target.value = '' // so importing the same file again still fires
        }}
      />
      {underlay && (
        <>
          <button
            className={editor.tool === 'calibrate' ? 'active' : undefined}
            onClick={() => setEditor((e) => ({ ...e, tool: 'calibrate' }))}
          >
            Calibrate
          </button>
          <label>
            Opacity
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={underlay.opacity}
              onChange={(event) =>
                setProject((p) => setUnderlay(p, level.id, { ...underlay, opacity: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={editor.underlayLocked}
              onChange={(event) => setEditor((e) => ({ ...e, underlayLocked: event.target.checked }))}
            />
            Lock
          </label>
          <button onClick={() => setProject((p) => setUnderlay(p, level.id, undefined))}>Remove</button>
          <span className="underlay-scale">1 px = {underlay.ftPerPx.toPrecision(3)} ft</span>
        </>
      )}
      {status && <span className={status.error ? 'underlay-status error' : 'underlay-status'}>{status.text}</span>}
    </div>
  )
}
