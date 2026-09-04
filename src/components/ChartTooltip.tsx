interface TooltipItem {
  name?: string | number
  value?: number | string
  color?: string
}

/** Tooltip de recharts con el estilo del panel (clases en dashboard.css). */
export default function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: string | number
  formatValue?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((item, i) => (
        <p key={i} className="chart-tooltip__row">
          <span
            className="chart-tooltip__swatch"
            style={{ background: item.color }}
          />
          {item.name}:{' '}
          <strong>
            {formatValue && typeof item.value === 'number'
              ? formatValue(item.value)
              : item.value}
          </strong>
        </p>
      ))}
    </div>
  )
}
