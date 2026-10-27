// Track B (B4.2): autosave the project to browser storage, debounced (spec §6.6).

import { useEffect, useState } from 'react'
import type { Project } from '../../model/project'
import { writeAutosave } from './saveLoad'

const DEBOUNCE_MS = 500

/** Autosaves `project` 500 ms after the last change. Returns a one-time notice if storage ran out. */
export function useAutosave(project: Project): string | null {
  const [notice, setNotice] = useState<string | null>(null)
  const [warned, setWarned] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      const outcome = writeAutosave(project)
      if (outcome === 'saved' || warned) return
      setWarned(true)
      setNotice(
        outcome === 'saved-without-underlays'
          ? 'Browser storage is full, so the autosave leaves out imported Underlays. Use Save to keep them.'
          : 'Autosave is not available in this browser. Use Save to keep your work.',
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [project, warned])

  return notice
}
