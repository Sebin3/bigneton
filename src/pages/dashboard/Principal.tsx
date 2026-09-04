import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import { useData } from '../../context/useData'
import { useAuth } from '../../context/useAuth'
import { getAllDatasets } from '../../lib/datasetStore'
import type { Dataset } from '../../lib/csvAnalyzer'
import { formatBytes } from '../../lib/csvAnalyzer'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (fn: (...args: any[]) => any) => fn as any
const full = new Intl.NumberFormat('es-MX')

const PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">{msg}</div>
}

function buildDashboardData(dataset: Dataset | null) {
  if (!dataset) return null

  const revenueCol = dataset.roles.revenue
  const categoryCol = dataset.roles.category

  let totalRevenue = 0
  let totalUnits = 0
  const revenueValues: number[] = []

  const qtyCol = dataset.columns.find(
    (c) => c.type === 'numeric' && c.name.toLowerCase().includes('cant'),
  )

  for (const row of dataset.rows) {
    if (revenueCol) {
      const v = parseFloat(String(row[revenueCol] ?? '').replace(/[^0-9.\-]/g, ''))
      if (!isNaN(v)) { revenueValues.push(v); totalRevenue += v }
    }
    if (qtyCol) {
      const u = parseFloat(String(row[qtyCol.name] ?? '').replace(/[^0-9.\-]/g, ''))
      if (!isNaN(u)) totalUnits += u
    }
  }

  const avgTicket = revenueValues.length > 0 ? totalRevenue / revenueValues.length : 0

  const timeline = dataset.insights.timeline ?? []
  const typeDistribution = dataset.insights.typeDistribution
  const topCategories = dataset.insights.topCategories ?? []

  const numericCols = dataset.columns.filter((c) => c.type === 'numeric')
  const numericSummaries = numericCols
    .map((c) => {
      const vals = dataset.rows
        .map((r) => parseFloat(String(r[c.name] ?? '').replace(/[^0-9.\-]/g, '')))
        .filter((v) => !isNaN(v))
      return { name: c.name, total: vals.reduce((a, v) => a + v, 0) }
    })
    .filter((s) => s.total !== 0)

  const colCompleteness = dataset.columns.map((c) => ({
    name: c.name,
    pct: dataset.rowCount > 0 ? Math.round(((dataset.rowCount - c.missing) / dataset.rowCount) * 100) : 100,
  }))

  let categoryBreakdown: { name: string; count: number; total: number }[] = []
  if (categoryCol) {
    const catMap = new Map<string, { count: number; total: number }>()
    for (const row of dataset.rows) {
      const cat = String(row[categoryCol] ?? '').trim() || 'Sin categoría'
      const e = catMap.get(cat) ?? { count: 0, total: 0 }
      e.count++
      if (revenueCol) {
        const v = parseFloat(String(row[revenueCol] ?? '').replace(/[^0-9.\-]/g, ''))
        if (!isNaN(v)) e.total += v
      }
      catMap.set(cat, e)
    }
    categoryBreakdown = [...catMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, total: Math.round(v.total) }))
      .sort((a, b) => b.total - a.total)
  }

  let weeklyPattern: { day: string; count: number }[] = []
  if (dataset.roles.date) {
    const dayMap = new Map<string, number>()
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    for (const row of dataset.rows) {
      const d = new Date(String(row[dataset.roles.date] ?? ''))
      if (isNaN(d.getTime())) continue
      const dayName = days[d.getDay()]
      dayMap.set(dayName, (dayMap.get(dayName) ?? 0) + 1)
    }
    weeklyPattern = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      .filter((d) => dayMap.has(d))
      .map((d) => ({ day: d, count: dayMap.get(d)! }))
  }

  return { totalRevenue, totalUnits, avgTicket, timeline, typeDistribution, topCategories, numericSummaries, colCompleteness, categoryBreakdown, weeklyPattern }
}

export default function Principal() {
  const { dataset } = useData()
  const { user } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  useEffect(() => { void getAllDatasets().then(setDatasets) }, [])

  const dash = useMemo(() => buildDashboardData(dataset), [dataset])
  const firstName = (user?.name ?? 'Usuario').split(' ')[0]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenido, {firstName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dataset
              ? `Resumen de ${dataset.fileName} — ${dataset.rowCount.toLocaleString('es-MX')} registros`
              : 'Carga un dataset para comenzar'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* KPI Cards — farmacia */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dash && dash.totalRevenue > 0 ? `$${(dash.totalRevenue / 1000).toFixed(1)}k` : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dash && dash.totalUnits > 0 ? full.format(dash.totalUnits) : dataset ? full.format(dataset.rowCount) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dash && dash.avgTicket > 0 ? `$${dash.avgTicket.toFixed(0)}` : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Datasets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{datasets.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{dataset ? formatBytes(dataset.sizeBytes) : 'Sin datos'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Timeline + Type distribution */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">{dataset?.insights.timelineTitle || 'Línea de tiempo'}</CardTitle>
            <p className="text-xs text-muted-foreground">Tendencia de valores a lo largo del tiempo</p>
          </CardHeader>
          <CardContent>
            {(dash?.timeline.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dash!.timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((value: number) => [value.toLocaleString('es-MX'), 'Valor'])} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty msg="Carga un dataset con columna de fecha" />}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Distribución de tipos</CardTitle>
            <p className="text-xs text-muted-foreground">Tipos de columna en el dataset</p>
          </CardHeader>
          <CardContent>
            {(dash?.typeDistribution.length ?? 0) > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={dash!.typeDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {dash!.typeDistribution.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [String(v), 'Columnas'])} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {dash!.typeDistribution.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </>
            ) : <Empty msg="Sin datos para mostrar" />}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Top categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dataset?.insights.topCategoriesTitle || 'Valores más frecuentes'}</CardTitle>
          <p className="text-xs text-muted-foreground">Distribución de los valores más repetidos</p>
        </CardHeader>
        <CardContent>
          {(dash?.topCategories.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dash!.topCategories} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [v.toLocaleString('es-MX'), 'Cantidad'])} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {dash!.topCategories.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty msg="Carga un dataset para ver los valores más frecuentes" />}
        </CardContent>
      </Card>

      {/* Row 3: Category breakdown + Weekly pattern */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Ingresos por categoría</CardTitle>
            <p className="text-xs text-muted-foreground">Desglose según columna de categoría detectada</p>
          </CardHeader>
          <CardContent>
            {(dash?.categoryBreakdown.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dash!.categoryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number, n: string) => [v.toLocaleString('es-MX'), n === 'total' ? 'Ingresos' : 'Registros'])} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {dash!.categoryBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty msg="Sin categoría detectada en el dataset" />}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Actividad por día</CardTitle>
            <p className="text-xs text-muted-foreground">Distribución de registros por día de semana</p>
          </CardHeader>
          <CardContent>
            {(dash?.weeklyPattern.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dash!.weeklyPattern} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [String(v), 'Registros'])} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40} fill="var(--color-chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty msg="Sin fecha para agrupar por día" />}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Column completeness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completitud por columna</CardTitle>
          <p className="text-xs text-muted-foreground">Porcentaje de datos no vacíos por campo</p>
        </CardHeader>
        <CardContent>
          {(dash?.colCompleteness.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {dash!.colCompleteness.slice(0, 15).map((col) => (
                <div key={col.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-40 truncate text-muted-foreground" title={col.name}>{col.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${col.pct}%`, background: col.pct >= 90 ? 'var(--color-chart-5)' : col.pct >= 70 ? 'var(--color-chart-4)' : 'var(--color-destructive)' }}
                    />
                  </div>
                  <span className="text-xs font-medium w-14 text-right tabular-nums">{col.pct}%</span>
                </div>
              ))}
            </div>
          ) : <Empty msg="Carga un dataset para ver completitud" />}
        </CardContent>
      </Card>

      {/* Row 5: Numeric totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totales por columna numérica</CardTitle>
          <p className="text-xs text-muted-foreground">Suma acumulada de cada campo numérico</p>
        </CardHeader>
        <CardContent>
          {(dash?.numericSummaries.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dash!.numericSummaries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [v.toLocaleString('es-MX'), 'Total'])} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {dash!.numericSummaries.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty msg="Sin columnas numéricas para resumir" />}
        </CardContent>
      </Card>
    </div>
  )
}
