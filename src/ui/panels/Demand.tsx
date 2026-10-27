// Track A: a strength value with its ASD value (× asdFactor) beneath, as used in the Results and
// Detail tables. Styles live in ResultsPanel.css (.asd).

export function Demand({ value, asd, digits = 2 }: { value: number; asd: number; digits?: number }) {
  return (
    <>
      {value.toFixed(digits)}
      <span className="asd">{(value * asd).toFixed(digits)}</span>
    </>
  )
}
