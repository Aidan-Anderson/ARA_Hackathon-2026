// Track B: measure an element's size, following resizes.

import { useCallback, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, { width: number; height: number } | null] {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect()
    if (!node) return
    observer.current = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.current.observe(node)
  }, [])
  return [ref, size]
}
