// Small numeric helpers shared by the engine modules.

/** Tolerance for comparing positions (ft) and forces. */
export const EPS = 1e-9

/** Sorted copy with values closer than EPS merged. */
export function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((value, i) => i === 0 || value - sorted[i - 1] > EPS)
}

export function maxAbs(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
}
