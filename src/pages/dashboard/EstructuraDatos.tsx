import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react'
import { useData } from '../../context/useData'
import { getAllDatasets } from '../../lib/datasetStore'
import { formatBytes, type Dataset } from '../../lib/csvAnalyzer'
import {
  Line,
  LineChart,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Progress } from '../../components/ui/progress'

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (fn: (...args: any[]) => any) => fn as any

const full = new Intl.NumberFormat('es-MX')

function CompletenessGauge({ value }: { value: number }) {
  const data = [{ name: 'Completitud', value, fill: value >= 90 ? '#22c55e' : value >= 70 ? '#eab308' : '#ef4444' }]
  return (
    <div className="flex flex-col items-center gap-2">
      <ResponsiveContainer width={180} height={180}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: 'var(--color-muted)' }} dataKey="value" cornerRadius={10} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
            formatter={fmt((v: number) => [`${v.toFixed(1)}%`, 'Completitud'])}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-4">
        <p className="text-2xl font-bold">{value.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground">Completitud del dataset</p>
      </div>
    </div>
  )
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

  const filteredRows = useMemo(() => {
    if (!selected) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return selected.rows.slice(0, 200)
    return selected.rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
    ).slice(0, 200)
  }, [selected, searchQuery])

  const headers = useMemo(() => selected?.columns.map((c) => c.name) ?? [], [selected])

  const colTypes = useMemo(() => {
    if (!selected) return new Map<string, string>()
    return new Map(selected.columns.map((c) => [c.name, c.type]))
  }, [selected])

  const columnCompleteness = useMemo(() => {
    if (!selected) return []
    return selected.columns.map((c) => ({
      name: c.name,
      completeness: selected.rowCount > 0 ? ((selected.rowCount - c.missing) / selected.rowCount) * 100 : 100,
      type: c.type,
    }))
  }, [selected])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estructura de datasets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Explora la completitud y contenido de cada dataset cargado
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/procesar')}>
          <FileSpreadsheet className="h-4 w-4" /> Procesar CSV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Dataset list */}
        <Card className="h-fit max-h-[calc(100vh-12rem)] overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Datasets ({datasets.length})</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            {datasets.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Database className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay datasets</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/procesar')}>
                  Cargar CSV
                </Button>
              </div>
            ) : (
              datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedId(d.id); setSearchQuery('') }}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    d.id === selectedId
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{d.fileName}</p>
                    {d.id === dataset?.id && <Badge variant="secondary" className="text-[10px] ml-1">activo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {full.format(d.rowCount)} filas · {d.columnCount} cols · {formatBytes(d.sizeBytes)}
                  </p>
                  <Progress value={d.completeness} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">{d.completeness.toFixed(1)}% completo</p>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Main content */}
        <div className="space-y-6">
          {!selected ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
                <Database className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selecciona un dataset para ver su estructura</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <Card className="flex items-center justify-center py-6">
                  <CompletenessGauge value={selected.completeness} />
                </Card>

                <div className="grid gap-4 grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Filas</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{full.format(selected.rowCount)}</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Columnas</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{selected.columnCount}</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Celdas vacías</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{full.format(selected.missingCells)}</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Tamaño</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{formatBytes(selected.sizeBytes)}</p></CardContent>
                  </Card>
                </div>
              </div>

              {/* Chart + table lado a lado */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Column completeness line chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Completitud por columna</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Evolución de la completitud a lo largo de las columnas</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={columnCompleteness} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} interval="preserveStartEnd" tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)} />
                          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                        <Tooltip
                          cursor={{ stroke: 'var(--color-border)' }}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                          labelStyle={{ color: 'var(--color-foreground)' }}
                          formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, 'Completitud']}
                        />
                          <Line
                            type="monotone"
                            dataKey="completeness"
                            name="Completitud"
                            stroke="var(--color-primary)"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            unit="%"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Data table */}
                <Card className="min-w-0">
                  <CardHeader className="px-4 pt-4">
                    <CardTitle className="text-base">Datos del dataset</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mostrando {filteredRows.length} de {full.format(selected.rowCount)} filas
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar en datos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 w-full"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" /> CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-auto max-h-[260px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                          <TableRow>
                            {headers.map((h) => (
                              <TableHead key={h} className="whitespace-nowrap">
                                <span className="font-mono text-xs">{h}</span>
                                <Badge variant="outline" className="ml-1 text-[10px]">{colTypes.get(h)}</Badge>
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
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
