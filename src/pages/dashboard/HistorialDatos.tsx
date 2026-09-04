import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Database, FileSpreadsheet, GitCompareArrows, HardDrive, Layers, Loader2, Search } from 'lucide-react'
import { useData } from '../../context/useData'
import { getDatasetFromStore } from '../../lib/datasetStore'
import { formatBytes, type Dataset } from '../../lib/csvAnalyzer'
import { apiCompareDatasets, type CompareResult } from '../../api/datasets'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

const full = new Intl.NumberFormat('es-MX')
const PAGE_SIZES = [10, 25, 50, 100]

interface CombinedRow { __source: string; [column: string]: unknown }

function pageWindow(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  let start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  start = Math.max(1, end - 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function HistorialDatos() {
  const { history } = useData()
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [baseId, setBaseId] = useState('')
  const [otherId, setOtherId] = useState('')
  const [compare, setCompare] = useState<CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState('')

  // Only load clean datasets (stored=true means it went through processing/cleaning)
  const cleanHistory = useMemo(() => history.filter((e) => e.stored), [history])
  const storedIds = useMemo(() => cleanHistory.map((e) => e.id), [cleanHistory])

  useEffect(() => {
    if (storedIds.length === 0) { setDatasets([]); return }
    let cancelled = false
    void Promise.all(storedIds.map((id) => getDatasetFromStore(id)))
      .then((found) => { if (!cancelled) setDatasets(found.filter((d): d is Dataset => d !== null)) })
      .catch(() => { if (!cancelled) setDatasets([]) })
    return () => { cancelled = true }
  }, [storedIds])

  const columns = useMemo(() => {
    if (!datasets?.length) return [] as string[]
    const seen = new Set<string>()
    const cols: string[] = []
    for (const ds of datasets) {
      for (const h of ds.headers) {
        if (!seen.has(h)) { seen.add(h); cols.push(h) }
      }
    }
    return cols
  }, [datasets])

  const rows: CombinedRow[] = useMemo(() => {
    if (!datasets) return []
    return datasets.flatMap((ds) => ds.rows.map((r) => ({ __source: ds.fileName, ...r })))
  }, [datasets])

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q)))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize)

  const totalBytes = cleanHistory.reduce((a, e) => a + e.sizeBytes, 0)
  const totalDups = cleanHistory.reduce((a, e) => a + (e.duplicateRows ?? 0), 0)

  const effectiveBaseId = baseId || datasets?.[0]?.id || ''
  const effectiveOtherId = otherId && otherId !== effectiveBaseId ? otherId : datasets?.[1]?.id ?? datasets?.[0]?.id ?? ''

  const runCompare = async () => {
    if (!effectiveBaseId || !effectiveOtherId || effectiveBaseId === effectiveOtherId || comparing) return
    setComparing(true)
    setCompareError('')
    setCompare(null)
    try {
      const result = await apiCompareDatasets(effectiveBaseId, effectiveOtherId)
      setCompare(result)
    } catch {
      setCompareError('No se pudieron comparar los datasets.')
    } finally { setComparing(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de datos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Datos limpios de todos los CSVs que has procesado, unidos en una sola tabla
          </p>
        </div>
        <Link to="/dashboard/procesar"><Button><FileSpreadsheet className="h-4 w-4" /> Procesar CSV</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Database, label: 'Datasets guardados', value: cleanHistory.length > 0 ? full.format(cleanHistory.length) : '—' },
          { icon: Layers, label: 'Filas totales', value: datasets && datasets.length > 0 ? full.format(rows.length) : '—' },
          { icon: FileSpreadsheet, label: 'Columnas únicas', value: columns.length > 0 ? full.format(columns.length) : '—' },
          { icon: HardDrive, label: 'Volumen', value: totalBytes > 0 ? formatBytes(totalBytes) : '—', sub: totalDups > 0 ? `${full.format(totalDups)} duplicadas` : undefined },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
              {k.sub && <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {cleanHistory.length === 0 || (datasets !== null && datasets.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Database className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No hay datos limpios aún. Procesa un CSV para que aparezca aquí.
            </p>
            <Link to="/dashboard/procesar"><Button>Ir a Procesar Datos</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><GitCompareArrows className="h-4 w-4" /> Comparar datasets</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Calcula la superposición de filas entre dos datasets en el backend</p>
            </CardHeader>
            <CardContent>
              {datasets === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] items-end">
                    <div>
                      <label className="text-xs text-muted-foreground">Base</label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring"
                        value={baseId}
                        onChange={(e) => { setBaseId(e.target.value); setCompare(null) }}
                      >
                        {datasets.map((d) => <option key={d.id} value={d.id}>{d.fileName} ({full.format(d.rowCount)} filas)</option>)}
                      </select>
                    </div>
                    <GitCompareArrows className="hidden md:block h-5 w-5 text-muted-foreground pb-1" />
                    <div>
                      <label className="text-xs text-muted-foreground">A comparar</label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring"
                        value={otherId}
                        onChange={(e) => { setOtherId(e.target.value); setCompare(null) }}
                      >
                        {datasets.map((d) => <option key={d.id} value={d.id} disabled={d.id === baseId}>{d.fileName} ({full.format(d.rowCount)} filas)</option>)}
                      </select>
                    </div>
                    <Button disabled={!baseId || !otherId || baseId === otherId || comparing} onClick={() => void runCompare()}>
                      {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />} Comparar
                    </Button>
                  </div>
                  {compareError && <p className="text-sm text-destructive mt-3">{compareError}</p>}
                  {compare && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Comparando</p>
                        <p className="text-sm font-medium mt-1">«{compare.base.fileName}» ↔ «{compare.other.fileName}»</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Filas en común</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{full.format(compare.overlappingRows)}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Superposición</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums text-primary">{compare.overlapPercent}%</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tabla consolidada (solo datos limpios)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{full.format(columns.length)} columnas · {full.format(rows.length)} filas</p>
            </div>
          </CardHeader>
          <CardContent>
            {datasets === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando datasets...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar en datos limpios..." className="pl-8" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
                  </div>
                  <select className="rounded-md border bg-background px-3 py-1.5 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                    {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} filas</option>)}
                  </select>
                </div>
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Origen</TableHead>
                        {columns.map((c) => <TableHead key={c} className="whitespace-nowrap text-xs">{c}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((row, i) => (
                        <TableRow key={startIndex + i}>
                          <TableCell className="text-xs text-muted-foreground">{full.format(startIndex + i + 1)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] font-mono">{row.__source}</Badge></TableCell>
                          {columns.map((c) => {
                            const v = row[c]
                            return <TableCell key={c} className="max-w-[180px] truncate text-xs">{v === undefined || v === null || v === '' ? <span className="text-muted-foreground">—</span> : String(v)}</TableCell>
                          })}
                        </TableRow>
                      ))}
                      {filteredRows.length === 0 && (
                        <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-sm text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>Mostrando {filteredRows.length === 0 ? 0 : full.format(startIndex + 1)}–{full.format(Math.min(startIndex + pageSize, filteredRows.length))} de {full.format(filteredRows.length)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 1} onClick={() => setPage(1)}><ChevronsLeft className="h-3 w-3" /></Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                    {pageWindow(safePage, totalPages).map((p) => (
                      <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(p)}>{p}</Button>
                    ))}
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-3 w-3" /></Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
