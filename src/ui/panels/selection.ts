// Track A: selecting elements from table rows (A4.2). The plan view sets the same Selection (B3.1).

import type { KeyboardEvent } from 'react'
import type { AppViewProps, Selection } from '../../model/ui'

/** True if both point at the same element. */
export function sameSelection(a: Selection, b: Selection): boolean {
  return selectionKey(a) === selectionKey(b)
}

function selectionKey(selection: Selection): string {
  if (!selection) return ''
  switch (selection.kind) {
    case 'transfer':
      return `transfer|${selection.levelId}|${selection.fromLineId}`
    default:
      return `${selection.kind}|${selection.levelId}|${selection.id}`
  }
}

/** Props that make a table row select `target` on click or Enter, and highlight it when selected. */
export function selectableRow(
  { selection, setSelection }: Pick<AppViewProps, 'selection' | 'setSelection'>,
  target: Selection,
) {
  return {
    className: sameSelection(selection, target) ? 'selectable selected' : 'selectable',
    tabIndex: 0,
    onClick: () => setSelection(target),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') setSelection(target)
    },
  }
}
