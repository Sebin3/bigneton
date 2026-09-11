import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarRange,
  Coins,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Receipt,
  Rows3,
  Search,
  Tags,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useData } from '../../context/useData'
import { getAllDatasets } from '../../lib/datasetStore'
import { exportDatasetCsv } from '../../lib/backup'
import { TYPE_LABELS, type Dataset } from '../../lib/csvAnalyzer'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (fn: (...args: any[]) => any) => fn as any

const full = new Intl.NumberFormat('es-MX')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

const PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const TYPE_BADGE: Record<string, string> = {
  numeric: 'border-transparent bg-sky-500/10 text-sky-600 dark:text-sky-400',
  date: 'border-transparent bg-violet-500/10 text-violet-600 dark:text-violet-400',
  categorical: 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400',
  boolean: 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  text: 'bg-muted text-foreground',
}

interface Kpi {
  icon: typeof Rows3
  label: string
  value: string
  sub: string
  tone: string
}

function KpiCard({ icon: Icon, label, value, sub, tone }: Kpi) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  )
}

function toNumber(value: string | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? null : n
}

export default function EstructuraDatos() {
  const { dataset } = useData()
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let alive = true
    void getAllDatasets().then((d) => {
      if (!alive) return
      setDatasets(d)
      setSelectedId((prev) => prev ?? dataset?.id ?? d[0]?.id ?? null)
    }).catch(() => alive && setDatasets([]))
    return () => { alive = false }
  }, [dataset?.id])

  const selected = useMemo(() => datasets.find((d) => d.id === selectedId) ?? null, [datasets, selectedId])

  const business = useMemo(() => {
    if (!selected) return null
    const revenueCol = selected.roles.revenue
    const catCol = selected.roles.category
    const values = revenueCol
      ? selected.rows
          .map((r) => toNumber(r[revenueCol]))
          .filter((v): v is number => v !== null)
      : []

    const total = values.reduce((a, b) => a + b, 0)
    const max = values.length ? Math.max(...values) : null
    const min = values.length ? Math.min(...values) : null
    const avg = values.length ? total / values.length : null

    const categories = catCol
      ? new Set(selected.rows.map((r) => String(r[catCol] ?? '').trim()).filter(Boolean)).size
      : 0

    const dateCol = selected.roles.date

    return {
      revenueCol,
      catCol,
      dateCol,
      total,
      max,
      min,
      avg,
      categories,
      withRevenue: values.length,
    }
  }, [selected])

  const filteredRows = useMemo(() => {
    if (!selected) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return selected.rows.slice(0, 200)
    return selected.rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
    ).slice(0, 200)
  }, [selected, searchQuery])

  const headers = useMemo(() => selected?.columns.map((c) => c.name) ?? [], [selected])

  if (datasets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estructura de datos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Descubre qué contiene tu dataset y cómo se comporta el negocio
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard/procesar')}>
            <FileSpreadsheet className="h-4 w-4" /> Procesar CSV
          </Button>
        </div>
        <Card className="flex flex-col items-center justify-center gap-3 py-16">
          <Database className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">Aún no hay datasets</p>
            <p className="text-sm text-muted-foreground mt-1">Sube un archivo CSV para analizar su estructura y contenido.</p>
          </div>
          <Button onClick={() => navigate('/dashboard/procesar')}>Cargar CSV</Button>
        </Card>
      </div>
    )
  }

  const kpis: Kpi[] = [
    {
      icon: Coins,
      label: 'Dinero total',
      value: business?.revenueCol != null ? money.format(business.total) : '—',
      sub: business?.revenueCol != null ? `Columna «${business.revenueCol}»` : 'No se detectó columna de ingresos',
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Receipt,
      label: 'Ticket promedio',
      value: business?.withRevenue ? money.format(business.avg ?? 0) : '—',
      sub: business?.withRevenue ? `${full.format(business.withRevenue)} ventas` : 'Sin ingresos detectados',
      tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      icon: TrendingUp,
      label: 'Monto máximo',
      value: business?.max != null ? money.format(business.max) : '—',
      sub: 'Mayor venta registrada',
      tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      icon: TrendingDown,
      label: 'Monto mínimo',
      value: business?.min != null ? money.format(business.min) : '—',
      sub: 'Menor venta registrada',
      tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      icon: Rows3,
      label: 'Registros',
      value: selected ? full.format(selected.rowCount) : '—',
      sub: selected ? `Subido el ${new Date(selected.uploadedAt).toLocaleDateString('es-MX')}` : '',
      tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      icon: Tags,
      label: 'Categorías',
      value: business?.categories ? full.format(business.categories) : '—',
      sub: business?.catCol ? `Columna «${business.catCol}»` : 'Sin columna de categoría',
      tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
  ]

  const rolesRows = [
    { role: 'Ingresos', col: business?.revenueCol, icon: Banknote },
    { role: 'Categoría', col: business?.catCol, icon: Tags },
    { role: 'Fecha', col: business?.dateCol, icon: CalendarRange },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estructura de datos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Descubre qué contiene tu dataset y cómo se comporta el negocio
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected && (
            <Button variant="outline" onClick={() => exportDatasetCsv(selected)}>
              <Download className="h-4 w-4" /> Descargar CSV
            </Button>
          )}
          <Button onClick={() => navigate('/dashboard/procesar')}>
            <FileSpreadsheet className="h-4 w-4" /> Procesar CSV
          </Button>
        </div>
      </div>

      {/* Selector de datasets */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {datasets.map((d) => {
          const isSelected = d.id === selectedId
          return (
            <button
              key={d.id}
              onClick={() => { setSelectedId(d.id); setSearchQuery('') }}
              className={`group rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/30 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{d.fileName}</p>
                {d.id === dataset?.id && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">activo</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {full.format(d.rowCount)} registros · {new Date(d.uploadedAt).toLocaleDateString('es-MX')}
              </p>
              {d.roles.revenue && (
                <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  Ingresos en «{d.roles.revenue}»
                </p>
              )}
            </button>
          )
        })}
      </div>

      {!selected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16">
            <Database className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecciona un dataset para ver su estructura</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs de negocio del contenido */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* Estructura detectada */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" /> Estructura detectada
              </CardTitle>
              <CardDescription>Cómo interpretó el motor tu dataset para el análisis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {rolesRows.map(({ role, col, icon: Icon }) => {
                  const profile = col ? selected.columns.find((c) => c.name === col) : undefined
                  return (
                    <div key={role} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{role}</p>
                        <p className="truncate text-sm font-semibold">{col ?? '—'}</p>
                      </div>
                      {profile && (
                        <Badge variant="outline" className={`shrink-0 text-[10px] ${TYPE_BADGE[profile.type] ?? ''}`}>
                          {TYPE_LABELS[profile.type as keyof typeof TYPE_LABELS] ?? profile.type}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Comportamiento del contenido */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" /> {selected.insights.timelineTitle || 'Evolución temporal'}
                </CardTitle>
                <CardDescription>Comportamiento del dataset en el tiempo</CardDescription>
              </CardHeader>
              <CardContent>
                {selected.insights.timeline && selected.insights.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={selected.insights.timeline} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                        formatter={fmt((v: number) => [money.format(v), business?.revenueCol ? 'Ingresos' : 'Registros'])}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
                        {selected.insights.timeline.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No se detectó una columna de fecha para graficar la evolución
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground" /> {selected.insights.topCategoriesTitle || 'Valores más frecuentes'}
                </CardTitle>
                <CardDescription>Los protagonistas del contenido de tu dataset</CardDescription>
              </CardHeader>
              <CardContent>
                {selected.insights.topCategories && selected.insights.topCategories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={selected.insights.topCategories} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                        formatter={fmt((v: number) => [money.format(v), 'Valor'])}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {selected.insights.topCategories.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No se detectó una columna de categoría para este análisis
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Vista previa del contenido */}
          <Card>
            <CardHeader className="px-4 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <CardTitle className="text-base">Contenido del dataset</CardTitle>
                  <CardDescription className="mt-0.5">
                    Mostrando {filteredRows.length} de {full.format(selected.rowCount)} filas
                  </CardDescription>
                </div>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar en datos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => exportDatasetCsv(selected)}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-md border max-h-[320px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap font-mono text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="max-w-[160px] truncate text-xs">
                            {row[h] != null ? String(row[h]) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={headers.length} className="py-8 text-center text-sm text-muted-foreground">
                          Sin resultados para «{searchQuery}»
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}