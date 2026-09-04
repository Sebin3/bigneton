import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarRange,
  ChartColumn,
  ChartLine,
  ChartPie,
  Database,
  Tags,
} from 'lucide-react'
import { useData } from '../../context/useData'
import ChartTooltip from '../../components/ChartTooltip'
import { CHART_COLORS, CHART_CURSOR, CHART_GRID, CHART_TICK } from '../../lib/chartTokens'
import { parseDateValue, parseNum } from '../../lib/csvAnalyzer'
import type { ColumnProfile } from '../../lib/csvAnalyzer'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

const full = new Intl.NumberFormat('es-MX')
const dec = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 })

const COUNT = '__count__'
const GRANULARITIES = [{ key: 'day', label: 'Día' }, { key: 'week', label: 'Semana' }, { key: 'month', label: 'Mes' }] as const
type Granularity = (typeof GRANULARITIES)[number]['key']
const BIN_OPTIONS = [0, 8, 12, 20, 30]

function bucketOf(date: Date, granularity: Granularity) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  if (granularity === 'month') return { key: `${y}-${m}`, label: date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) }
  if (granularity === 'week') {
    const start = new Date(date); const shift = (start.getDay() + 6) % 7; start.setDate(start.getDate() - shift)
    return { key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`, label: `sem. ${start.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}` }
  }
  return { key: `${y}-${m}-${d}`, label: date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) }
}

function shortNum(v: number) {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 10_000) return compact.format(v)
  return dec.format(Number(v.toFixed(2)))
}

interface Bin { bin: string; count: number }

function buildHistogram(values: number[], binCount: number): Bin[] {
  if (values.length === 0) return []
  let min = values[0]; let max = values[0]
  for (const v of values) { if (v < min) min = v; if (v > max) max = v }
  if (min === max) return [{ bin: shortNum(min), count: values.length }]
  const width = (max - min) / binCount
  const counts = new Array<number>(binCount).fill(0)
  for (const v of values) { let idx = Math.floor((v - min) / width); if (idx >= binCount) idx = binCount - 1; if (idx < 0) idx = 0; counts[idx] += 1 }
  return counts.map((count, i) => ({ bin: `${shortNum(min + i * width)} – ${shortNum(min + (i + 1) * width)}`, count }))
}

function sturges(n: number) { if (n < 2) return 1; return Math.min(30, Math.max(5, Math.ceil(Math.log2(n) + 1))) }

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (fn: (...args: any[]) => any) => fn as any

function ColumnSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export default function Graficos() {
  const { dataset } = useData()
  const rows = useMemo(() => dataset?.rows ?? [], [dataset])
  const columns = useMemo<ColumnProfile[]>(() => dataset?.columns ?? [], [dataset])

  const dateCols = useMemo(() => columns.filter((c) => c.type === 'date'), [columns])
  const numericCols = useMemo(() => columns.filter((c) => c.type === 'numeric'), [columns])
  const catCols = useMemo(() => columns.filter((c) => c.type === 'categorical' || c.type === 'boolean' || c.type === 'text'), [columns])

  const [pickedDateCol, setDateCol] = useState('')
  const [pickedMeasure, setMeasure] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [pickedHistCol, setHistCol] = useState('')
  const [bins, setBins] = useState(0)
  const [pickedCatCol, setCatCol] = useState('')
  const [catTop, setCatTop] = useState(8)
  const [catMode, setCatMode] = useState<'bars' | 'pie'>('bars')

  const has = (list: ColumnProfile[], name: string) => list.some((c) => c.name === name)
  const dateCol = has(dateCols, pickedDateCol) ? pickedDateCol : (dateCols[0]?.name ?? '')
  const measure = pickedMeasure === COUNT || has(numericCols, pickedMeasure) ? pickedMeasure : (dataset?.roles.revenue ?? COUNT)
  const histCol = has(numericCols, pickedHistCol) ? pickedHistCol : (numericCols[0]?.name ?? '')
  const catCol = has(catCols, pickedCatCol) ? pickedCatCol : (dataset?.roles.category ?? catCols[0]?.name ?? '')

  const timeline = useMemo(() => {
    if (!dateCol) return []
    const map = new Map<string, { label: string; value: number }>()
    for (const row of rows) {
      const date = parseDateValue(row[dateCol] ?? ''); if (!date) continue
      const { key, label } = bucketOf(date, granularity)
      let delta = 1
      if (measure !== COUNT) { const n = parseNum(row[measure] ?? ''); if (n === null) continue; delta = n }
      const entry = map.get(key); if (entry) entry.value += delta; else map.set(key, { label, value: delta })
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
  }, [rows, dateCol, measure, granularity])

  const histValues = useMemo(() => {
    if (!histCol) return []
    const out: number[] = []
    for (const row of rows) { const n = parseNum(row[histCol] ?? ''); if (n !== null) out.push(n) }
    return out
  }, [rows, histCol])

  const histogram = useMemo(() => buildHistogram(histValues, bins || sturges(histValues.length)), [histValues, bins])

  const distribution = useMemo(() => {
    if (!catCol) return { data: [] as { name: string; value: number }[], total: 0 }
    const counts = new Map<string, number>(); let total = 0
    for (const row of rows) { const raw = (row[catCol] ?? '').trim(); if (!raw) continue; counts.set(raw, (counts.get(raw) ?? 0) + 1); total += 1 }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const head = sorted.slice(0, catTop).map(([name, value]) => ({ name, value }))
    const restCount = sorted.slice(catTop).reduce((acc, [, v]) => acc + v, 0)
    if (restCount > 0) head.push({ name: 'Otros', value: restCount })
    return { data: head, total }
  }, [rows, catCol, catTop])

  if (!dataset) {
    return (
      <div className="space-y-6">
        <header><h1 className="text-2xl font-bold tracking-tight">Gráficos de tus datos</h1><p className="text-sm text-muted-foreground mt-1">Histogramas, distribuciones y series de tiempo generadas automáticamente.</p></header>
        <Card><CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
          <Database size={30} className="text-muted-foreground" />
          <p className="text-sm font-medium">Aún no hay un dataset vinculado</p>
          <p className="text-xs text-muted-foreground">Carga un CSV y aquí aparecerán los gráficos de sus columnas.</p>
          <Link to="/dashboard/procesar" className="text-sm text-primary hover:underline mt-2">Ir a Procesar Datos</Link>
        </CardContent></Card>
      </div>
    )
  }

  const measureLabel = measure === COUNT ? 'Registros' : measure
  const histProfile = numericCols.find((c) => c.name === histCol)

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gráficos de tus datos</h1>
          <p className="text-sm text-muted-foreground mt-1">«{dataset.fileName}» — {numericCols.length} numéricas · {catCols.length} categóricas · {dateCols.length} de fecha</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-full"><ChartColumn size={14} /> {full.format(dataset.rowCount)} filas</span>
      </header>

      {/* Serie de tiempo */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><CalendarRange size={17} /> Serie de tiempo</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Evolución del periodo agrupando por día, semana o mes</p>
          </div>
          {timeline.length > 0 && <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{timeline.length} periodos</span>}
        </CardHeader>
        <CardContent>
          {dateCols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"><Database size={28} /><p className="text-sm mt-2">No se detectaron columnas de fecha</p></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <ColumnSelect label="Fecha" value={dateCol} onChange={setDateCol} options={dateCols.map((c) => ({ value: c.name, label: c.name }))} />
                <ColumnSelect label="Medida" value={measure} onChange={setMeasure} options={[{ value: COUNT, label: 'Conteo de registros' }, ...numericCols.map((c) => ({ value: c.name, label: `Suma de ${c.name}` }))]} />
                <div className="flex gap-1">
                  {GRANULARITIES.map((g) => (
                    <button key={g.key} type="button" className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${granularity === g.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border'}`} onClick={() => setGranularity(g.key)}>{g.label}</button>
                  ))}
                </div>
              </div>
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeline} margin={{ left: -18, right: 10, top: 8 }}>
                    <defs><linearGradient id="gradSerie" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.42} /><stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 12 }} dy={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 12 }} tickFormatter={compact.format} />
                    <Tooltip cursor={{ stroke: CHART_CURSOR, strokeWidth: 2 }} content={<ChartTooltip formatValue={fmt((v: number) => dec.format(v))} />} />
                    <Area type="monotone" name={measureLabel} dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2.6} fill="url(#gradSerie)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-surface)' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">La columna elegida no tiene fechas interpretables</div>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Histogram + Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><ChartLine size={17} /> Histograma</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Frecuencia de valores por intervalo</p>
            </div>
            {histProfile && <span className="text-xs bg-muted px-2.5 py-1 rounded-full">{full.format(histValues.length)} valores</span>}
          </CardHeader>
          <CardContent>
            {numericCols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Database size={28} /><p className="text-sm mt-2">Sin columnas numéricas</p></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <ColumnSelect label="Columna" value={histCol} onChange={setHistCol} options={numericCols.map((c) => ({ value: c.name, label: c.name }))} />
                  <div className="flex gap-1">
                    {BIN_OPTIONS.map((b) => (
                      <button key={b} type="button" className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${bins === b ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border'}`} onClick={() => setBins(b)}>{b === 0 ? 'Auto' : `${b} barras`}</button>
                    ))}
                  </div>
                </div>
                {histogram.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={268}>
                      <BarChart data={histogram} margin={{ left: -20, right: 8, top: 8 }}>
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="bin" tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 10.5 }} interval="preserveStartEnd" dy={6} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 12 }} tickFormatter={compact.format} />
                        <Tooltip cursor={{ fill: CHART_CURSOR, opacity: 0.45 }} content={<ChartTooltip formatValue={fmt((v: number) => full.format(v))} />} />
                        <Bar name="Registros" dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} maxBarSize={54} />
                      </BarChart>
                    </ResponsiveContainer>
                    {histProfile && (
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3">
                        <span>Mín <strong className="text-foreground">{shortNum(histProfile.stats.min ?? 0)}</strong></span>
                        <span>Media <strong className="text-foreground">{shortNum(histProfile.stats.mean ?? 0)}</strong></span>
                        <span>Mediana <strong className="text-foreground">{shortNum(histProfile.stats.median ?? 0)}</strong></span>
                        <span>Máx <strong className="text-foreground">{shortNum(histProfile.stats.max ?? 0)}</strong></span>
                      </div>
                    )}
                  </>
                ) : <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Sin valores numéricos</div>}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Tags size={17} /> Distribución</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Reparto de valores de una columna categórica</p>
            </div>
            <div className="flex gap-1">
              <button type="button" className={`p-1.5 rounded transition-colors ${catMode === 'bars' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setCatMode('bars')} title="Barras"><ChartColumn size={15} /></button>
              <button type="button" className={`p-1.5 rounded transition-colors ${catMode === 'pie' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setCatMode('pie')} title="Pastel"><ChartPie size={15} /></button>
            </div>
          </CardHeader>
          <CardContent>
            {catCols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Database size={28} /><p className="text-sm mt-2">Sin columnas categóricas</p></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <ColumnSelect label="Columna" value={catCol} onChange={setCatCol} options={catCols.map((c) => ({ value: c.name, label: c.name }))} />
                  <div className="flex gap-1">
                    {[5, 8, 12].map((n) => (
                      <button key={n} type="button" className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${catTop === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border'}`} onClick={() => setCatTop(n)}>Top {n}</button>
                    ))}
                  </div>
                </div>
                {distribution.data.length > 0 ? (
                  catMode === 'bars' ? (
                    <ResponsiveContainer width="100%" height={268}>
                      <BarChart data={distribution.data} layout="vertical" margin={{ left: 4, right: 18, top: 6, bottom: 6 }}>
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 12 }} tickFormatter={compact.format} />
                        <YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} tick={{ fill: CHART_TICK, fontSize: 11.5 }} />
                        <Tooltip cursor={{ fill: CHART_CURSOR, opacity: 0.45 }} content={<ChartTooltip formatValue={fmt((v: number) => full.format(v))} />} />
                        <Bar name="Registros" dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
                          {distribution.data.map((entry, i) => <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                          <Pie data={distribution.data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2}>
                            {distribution.data.map((entry, i) => <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip formatValue={fmt((v: number) => full.format(v))} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {distribution.data.map((entry, i) => (
                          <span key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            {entry.name} <strong className="text-foreground">{((entry.value / Math.max(distribution.total, 1)) * 100).toFixed(1)}%</strong>
                          </span>
                        ))}
                      </div>
                    </>
                  )
                ) : <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Sin valores para contar</div>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
