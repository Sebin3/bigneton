import { useEffect, useMemo, useState } from 'react'
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
  let totalRows = dataset.rowCount
  let totalMissing = dataset.missingCells
  let numericSummaries: { name: string; sum: number; avg: number; count: number }[] = []
  let categoryBreakdown: { name: string; count: number; total: number }[] = []

  if (revenueCol) {
    const revenueValues = dataset.rows
      .map((r) => parseFloat(String(r[revenueCol] ?? '').replace(/[^0-9.\-]/g, '')))
      .filter((v) => !isNaN(v))
    totalRevenue = revenueValues.reduce((a, v) => a + v, 0)
  }

  const numericCols = dataset.columns.filter((c) => c.type === 'numeric')
  numericSummaries = numericCols.map((c) => {
    const values = dataset.rows
      .map((r) => parseFloat(String(r[c.name] ?? '').replace(/[^0-9.\-]/g, '')))
      .filter((v) => !isNaN(v))
    const sum = values.reduce((a, v) => a + v, 0)
    return {
      name: c.name,
      sum: Math.round(sum),
      avg: values.length > 0 ? Math.round(sum / values.length) : 0,
      count: values.length,
    }
  }).filter((s) => s.count > 0)

  if (categoryCol) {
    const catMap = new Map<string, { count: number; total: number }>()
    for (const row of dataset.rows) {
      const cat = String(row[categoryCol] ?? 'Sin categoría').trim() || 'Sin categoría'
      const entry = catMap.get(cat) ?? { count: 0, total: 0 }
      entry.count++
      if (revenueCol) {
        const val = parseFloat(String(row[revenueCol] ?? '').replace(/[^0-9.\-]/g, ''))
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

export default function Reportes() {
  const { dataset } = useData()
  const [enrich, setEnrich] = useState<EnrichResult | null>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)

  const data = useMemo(() => extractReportData(dataset), [dataset])

  useEffect(() => {
    if (!dataset) { setEnrich(null); return }
    setEnrich(null)
    void apiEnrichDataset(dataset.id).then(setEnrich).catch(() => setEnrich(null))
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
    </div>
  )
}
