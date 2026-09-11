import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
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
import { Download, Printer, TrendingUp, DollarSign, ShoppingCart, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { useData } from '../../context/useData'
import { useAuth } from '../../context/useAuth'
import { exportDatasetCsv } from '../../lib/backup'
import { apiEnrichDataset } from '../../api/datasets'
import type { EnrichResult } from '../../api/datasets'
import type { Dataset } from '../../lib/csvAnalyzer'

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

function extractReportData(dataset: Dataset | null) {
  if (!dataset) return null

  const timeline = dataset.insights.timeline ?? []
  const topCategories = dataset.insights.topCategories ?? []
  const typeDistribution = dataset.insights.typeDistribution
  const missingByColumn = dataset.insights.missingByColumn

  const revenueCol = dataset.roles.revenue
  const categoryCol = dataset.roles.category

  let totalRevenue = 0
  const totalRows = dataset.rowCount
  const totalMissing = dataset.missingCells
  const numericSummaries: { name: string; sum: number; avg: number; count: number }[] = dataset.columns
    .filter((c) => c.type === 'numeric')
    .map((c) => {
      const values = dataset.rows
        .map((r) => parseFloat(String(r[c.name] ?? '').replace(/[^0-9.-]/g, '')))
        .filter((v) => !isNaN(v))
      const sum = values.reduce((a, v) => a + v, 0)
      return {
        name: c.name,
        sum: Math.round(sum),
        avg: values.length > 0 ? Math.round(sum / values.length) : 0,
        count: values.length,
      }
    })
    .filter((s) => s.count > 0)

  if (revenueCol) {
    const revenueValues = dataset.rows
      .map((r) => parseFloat(String(r[revenueCol] ?? '').replace(/[^0-9.-]/g, '')))
      .filter((v) => !isNaN(v))
    totalRevenue = revenueValues.reduce((a, v) => a + v, 0)
  }

  let categoryBreakdown: { name: string; count: number; total: number }[] = []

  if (categoryCol) {
    const catMap = new Map<string, { count: number; total: number }>()
    for (const row of dataset.rows) {
      const cat = String(row[categoryCol] ?? 'Sin categoría').trim() || 'Sin categoría'
      const entry = catMap.get(cat) ?? { count: 0, total: 0 }
      entry.count++
      if (revenueCol) {
        const val = parseFloat(String(row[revenueCol] ?? '').replace(/[^0-9.-]/g, ''))
        if (!isNaN(val)) entry.total += val
      }
      catMap.set(cat, entry)
    }
    categoryBreakdown = [...catMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, total: Math.round(v.total) }))
      .sort((a, b) => b.total - a.total)
  }

  return {
    timeline,
    topCategories,
    typeDistribution,
    missingByColumn,
    totalRevenue,
    totalRows,
    totalMissing,
    numericSummaries,
    categoryBreakdown,
    completeness: dataset.completeness,
    columnCount: dataset.columnCount,
  }
}

function toN(value: string | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? null : n
}

const printCell = {
  padding: '5px 8px',
  borderBottom: '1px solid #d0d7de',
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
}

const printHead = {
  padding: '5px 8px',
  borderBottom: '2px solid #17324d',
  textAlign: 'left' as const,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.04,
  color: '#17324d',
}

function PSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#17324d', borderBottom: '2px solid #17324d', paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function PrintReport({
  dataset,
  data,
  user,
}: {
  dataset: Dataset
  data: NonNullable<ReturnType<typeof extractReportData>>
  user: { name?: string; email?: string } | null
}) {
  const revenueCol = dataset.roles.revenue
  const values = revenueCol
    ? dataset.rows.map((r) => toN(r[revenueCol])).filter((v): v is number => v !== null)
    : []
  const total = values.reduce((a, b) => a + b, 0)
  const avg = values.length ? total / values.length : null
  const max = values.length ? Math.max(...values) : null
  const min = values.length ? Math.min(...values) : null

  const generated = new Date().toLocaleString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return createPortal(
    <div className="print-report">
      <div style={{ background: '#17324d', color: '#ffffff', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>BigData <span style={{ fontWeight: 400 }}>· Informe Comercial</span></div>
          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>Plataforma de análisis de datos para la toma de decisiones</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.85 }}>
          <div>Generado el {generated}</div>
          <div>{user?.name ? `Elaborado por ${user.name}` : ''}</div>
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['Dataset', dataset.fileName],
            ['Registros', full.format(data.totalRows)],
            ['Columnas', String(data.columnCount)],
            ['Fecha de carga', new Date(dataset.uploadedAt).toLocaleDateString('es-MX')],
            ['Completitud', `${data.completeness.toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.05, color: '#57606a' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16181f', marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        <PSection title="Resumen ejecutivo">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={{ ...printCell, width: '50%' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#57606a' }}>Dinero total</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#17324d' }}>{money.format(total)}</div>
                </td>
                <td style={{ ...printCell, width: '50%' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#57606a' }}>Ticket promedio</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#17324d' }}>{avg != null ? money.format(avg) : '—'}</div>
                </td>
              </tr>
              <tr>
                <td style={{ ...printCell }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#57606a' }}>Monto máximo</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{max != null ? money.format(max) : '—'}</div>
                </td>
                <td style={{ ...printCell }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#57606a' }}>Monto mínimo</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{min != null ? money.format(min) : '—'}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </PSection>

        {data.timeline.length > 0 && (
          <PSection title={dataset.insights.timelineTitle || 'Evolución temporal'}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={printHead}>Período</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>{revenueCol ? 'Ingresos' : 'Registros'}</th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.map((t) => (
                  <tr key={t.label}>
                    <td style={printCell}>{t.label}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {revenueCol ? money.format(t.value) : full.format(t.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PSection>
        )}

        {data.categoryBreakdown.length > 0 && (
          <PSection title={dataset.insights.topCategoriesTitle.includes('categor') ? dataset.insights.topCategoriesTitle : 'Desglose por categoría'}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={printHead}>Categoría</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>Registros</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {data.categoryBreakdown.map((c) => (
                  <tr key={c.name}>
                    <td style={printCell}>{c.name}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{full.format(c.count)}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.total > 0 ? money.format(c.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PSection>
        )}

        {data.numericSummaries.length > 0 && (
          <PSection title="Resumen de columnas numéricas">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={printHead}>Columna</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>Total</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>Promedio</th>
                  <th style={{ ...printHead, textAlign: 'right' }}>Registros</th>
                </tr>
              </thead>
              <tbody>
                {data.numericSummaries.map((s) => (
                  <tr key={s.name}>
                    <td style={printCell}>{s.name}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money.format(s.sum)}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money.format(s.avg)}</td>
                    <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{full.format(s.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PSection>
        )}

        <PSection title="Calidad del dataset">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={{ ...printCell, width: '33%' }}><b>Registros:</b> {full.format(data.totalRows)}</td>
                <td style={{ ...printCell, width: '33%' }}><b>Duplicados:</b> {full.format(dataset.duplicateRows)}</td>
                <td style={{ ...printCell, width: '34%' }}><b>Celdas vacías:</b> {full.format(data.totalMissing)}</td>
              </tr>
            </tbody>
          </table>
          {data.missingByColumn.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#57606a' }}>Valores faltantes por columna:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 4 }}>
                <tbody>
                  {data.missingByColumn.slice(0, 10).map((c) => {
                    const pct = data.totalRows > 0 ? (c.missing / data.totalRows) * 100 : 0
                    return (
                      <tr key={c.name}>
                        <td style={{ ...printCell }}>{c.name}</td>
                        <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{full.format(c.missing)}</td>
                        <td style={{ ...printCell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PSection>

        <div style={{ marginTop: 26, borderTop: '1px solid #d0d7de', paddingTop: 10, fontSize: 9, color: '#57606a', display: 'flex', justifyContent: 'space-between' }}>
          <span>BigData — Informe generado automáticamente a partir del dataset cargado.</span>
          <span>Confidencial · Uso interno</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Reportes() {
  const { dataset } = useData()
  const { user } = useAuth()
  const [enrich, setEnrich] = useState<EnrichResult | null>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)

  const data = useMemo(() => extractReportData(dataset), [dataset])

  useEffect(() => {
    if (!dataset) return
    let cancelled = false
    void apiEnrichDataset(dataset.id)
      .then((res) => { if (!cancelled) setEnrich(res) })
      .catch(() => { if (!cancelled) setEnrich(null) })
    return () => { cancelled = true }
  }, [dataset])

  const handleExport = () => {
    if (dataset) exportDatasetCsv(dataset)
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes de negocio</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data
              ? `Análisis de ${dataset?.fileName ?? 'dataset'} — ${full.format(data.totalRows)} registros`
              : 'Carga un dataset para ver reportes reales'}
          </p>
        </div>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Exportar</Button>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Imprimir</Button>
          </div>
        )}
      </div>

      {!data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <DollarSign className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carga un dataset para ver reportes con datos reales</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-muted-foreground">Total registros</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{full.format(data.totalRows)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-muted-foreground">Ingresos totales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{money.format(data.totalRevenue)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-muted-foreground">Completitud</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.completeness.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{full.format(data.totalMissing)} celdas vacías</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs text-muted-foreground">Columnas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.columnCount}</p></CardContent>
            </Card>
          </div>

          <Tabs defaultValue="resumen" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="categorias">Categorías</TabsTrigger>
              <TabsTrigger value="columnas">Columnas</TabsTrigger>
              <TabsTrigger value="calidad">Calidad</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4">
              {/* Timeline */}
              {data.timeline.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">{dataset?.insights.timelineTitle || 'Línea de tiempo'}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [v.toLocaleString('es-MX'), 'Valor'])} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
                          {data.timeline.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Numeric summaries */}
              {data.numericSummaries.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Resumen de columnas numéricas</CardTitle></CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Columna</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Promedio</TableHead>
                            <TableHead className="text-right">Registros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.numericSummaries.map((s) => (
                            <TableRow key={s.name}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-right">{money.format(s.sum)}</TableCell>
                              <TableCell className="text-right">{money.format(s.avg)}</TableCell>
                              <TableCell className="text-right">{full.format(s.count)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="categorias" className="space-y-4">
              {/* Category breakdown chart + table */}
              {data.categoryBreakdown.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Distribución por categoría</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={data.categoryBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count">
                            {data.categoryBreakdown.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [String(v), 'Registros'])} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Detalle por categoría</CardTitle></CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Categoría</TableHead>
                              <TableHead className="text-right">Registros</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.categoryBreakdown.map((c) => (
                              <TableRow key={c.name}>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell className="text-right">{full.format(c.count)}</TableCell>
                                <TableCell className="text-right">{c.total > 0 ? money.format(c.total) : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No se detectaron categorías en el dataset actual
                  </CardContent>
                </Card>
              )}

              {/* Top categories from insights */}
              {data.topCategories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{dataset?.insights.topCategoriesTitle || 'Valores más frecuentes'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.topCategories} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={120} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [v.toLocaleString('es-MX'), 'Cantidad'])} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                          {data.topCategories.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="columnas" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Perfil de columnas</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Columna</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Únicos</TableHead>
                          <TableHead className="text-right">Vacíos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataset?.columns.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-mono text-xs">{c.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{c.type}</Badge></TableCell>
                            <TableCell className="text-right">{c.unique != null ? full.format(c.unique) : '—'}</TableCell>
                            <TableCell className="text-right">{c.missing > 0 ? <span className="text-destructive">{full.format(c.missing)}</span> : '0'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calidad" className="space-y-4">
              {/* Type distribution */}
              {data.typeDistribution.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribución de tipos de dato</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.typeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }} formatter={fmt((v: number) => [String(v), 'Columnas'])} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {data.typeDistribution.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Missing by column */}
              {data.missingByColumn.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Valores faltantes por columna</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.missingByColumn
                        .filter((c) => c.missing > 0)
                        .sort((a, b) => b.missing - a.missing)
                        .map((c) => {
                          const pct = data.totalRows > 0 ? (c.missing / data.totalRows) * 100 : 0
                          return (
                            <div key={c.name} className="flex items-center gap-3">
                              <span className="text-xs font-mono w-40 truncate text-muted-foreground">{c.name}</span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct > 20 ? 'var(--color-destructive)' : pct > 5 ? 'var(--color-chart-4)' : 'var(--color-chart-5)',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium w-20 text-right tabular-nums">{full.format(c.missing)} ({pct.toFixed(1)}%)</span>
                            </div>
                          )
                        })}
                    </div>
                    {data.missingByColumn.filter((c) => c.missing > 0).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No hay valores faltantes</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Enriquecimiento sugerido por el backend */}
              {enrich && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Enriquecimiento sugerido</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{enrich.message}</p>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-foreground p-1"
                      onClick={() => { setEnrichLoading(true); void apiEnrichDataset(dataset!.id).then(setEnrich).finally(() => setEnrichLoading(false)) }}
                      title="Reanalizar enriquecimiento"
                    >
                      {enrichLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </button>
                  </CardHeader>
                  {enrich.suggestions.length > 0 && (
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Columna</TableHead>
                              <TableHead className="text-right">Faltantes</TableHead>
                              <TableHead>Acción sugerida</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {enrich.suggestions.slice(0, 10).map((s) => (
                              <TableRow key={s.column}>
                                <TableCell className="font-mono text-xs">{s.column}</TableCell>
                                <TableCell className="text-right">{full.format(s.missing)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{s.action}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {dataset && data && <PrintReport dataset={dataset} data={data} user={user} />}
    </div>
  )
}
