import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Database, FileSpreadsheet, Layers, Loader2, Search, ShieldCheck, Sparkles, TriangleAlert,
} from 'lucide-react'
import { useData } from '../../context/useData'
import { TYPE_LABELS, cleanDataset, formatBytes, type CleanOptions, type CleanReport } from '../../lib/csvAnalyzer'
import { apiCleanDataset, apiGetCleaningLogs, apiGetDataset, type CleaningLog } from '../../api/datasets'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Progress } from '../../components/ui/progress'

const full = new Intl.NumberFormat('es-MX')
const PAGE_SIZES = [10, 25, 50, 100]

function pageWindow(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  let start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  start = Math.max(1, end - 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function LimpiezaDatos() {
  const { dataset, history, saveDataset } = useData()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [options, setOptions] = useState<{ removeDuplicates: boolean; fillNumeric: boolean; fillCategorical: boolean }>({ removeDuplicates: false, fillNumeric: false, fillCategorical: false })
  const [cleaning, setCleaning] = useState(false)
  const [lastReport, setLastReport] = useState<{ report: CleanReport; fileName: string } | null>(null)
  const [logs, setLogs] = useState<CleaningLog[]>([])
  const [loadedLogs, setLoadedLogs] = useState<string | null>(null)

  // Carga el historial de limpiezas del dataset actual desde el backend
  useEffect(() => {
    if (!dataset || loadedLogs === dataset.id) return
    void apiGetCleaningLogs(dataset.id)
      .then((logs) => {
        setLoadedLogs(dataset.id)
        setLogs(logs)
      })
      .catch(() => {
        setLoadedLogs(dataset.id)
        setLogs([])
      })
  }, [dataset, loadedLogs])

  const filteredRows = useMemo(() => {
    if (!dataset) return []
    const q = query.trim().toLowerCase()
    if (!q) return dataset.rows
    return dataset.rows.filter((row) => dataset.headers.some((h) => (row[h] ?? '').toLowerCase().includes(q)))
  }, [dataset, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize)

  const numericMissing = dataset?.columns.reduce((a, c) => c.type === 'numeric' ? a + c.missing : a, 0) ?? 0
  const otherMissing = dataset?.columns.reduce((a, c) => c.type !== 'numeric' ? a + c.missing : a, 0) ?? 0
  const dupCount = dataset?.duplicateRows ?? 0
  const nothingToClean = dupCount === 0 && numericMissing === 0 && otherMissing === 0
  const findings = dataset?.columns.filter((c) => c.missing > 0).sort((a, b) => b.missing - a.missing) ?? []

  const handleClean = async () => {
    if (!dataset || cleaning || nothingToClean) return
    setCleaning(true)
    setLastReport(null)
    try {
      // 1) Análisis local para producir la versión limpia con tipos correctos
      const result = await cleanDataset(dataset, options)
      // 2) El backend ejecuta y persiste la limpieza + registra el log auditable
      try {
        await apiCleanDataset(dataset.id, {
          removeDuplicates: options.removeDuplicates || undefined,
          dropEmptyRows: true,
          trim: false,
        })
        const cleaned = await apiGetDataset(dataset.id)
        if (cleaned) {
          // 3) Los datos limpios sustituyen al actual → Principal y Reportes
          //    se actualizan automáticamente con el contenido ya limpio.
          saveDataset(cleaned)
          setLastReport({ report: result.report, fileName: cleaned.fileName })
          setPage(1)
          return
        }
      } catch {
        /* si falla el persistido remoto, la versión local ya quedó lista */
      }
      saveDataset(result.dataset)
      setLastReport({ report: result.report, fileName: result.dataset.fileName })
      setPage(1)
    } finally { setCleaning(false) }
  }

  const toggleOption = (key: keyof CleanOptions) => setOptions((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Limpieza de datos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Elimina duplicados, rellena valores faltantes y genera versiones trazables
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard/procesar'}>Procesar otro CSV</Button>
      </div>

      {!dataset ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Database className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No hay un CSV vinculado. Procesa un archivo para explorar y limpiar sus datos.
            </p>
            <Link to="/dashboard/procesar"><Button>Ir a Procesar Datos</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1.5"><FileSpreadsheet className="h-3 w-3" /> {dataset.fileName}</Badge>
            <Badge variant="secondary">{formatBytes(dataset.sizeBytes)}</Badge>
            <Badge variant="secondary">{full.format(dataset.rowCount)} filas</Badge>
            <Badge variant="secondary">{dataset.columnCount} columnas</Badge>
            <Badge variant="secondary">{dataset.completeness.toFixed(1)}% completo</Badge>
            {dupCount > 0 && <Badge variant="destructive">{dupCount} duplicadas</Badge>}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Tabla de datos</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Dataset completo cargado</p>
              </div>
              <Badge variant="outline">{full.format(filteredRows.length)} {query ? 'coincidencias' : 'filas'}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar en todas las columnas..." className="pl-8" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
                </div>
                <select className="rounded-md border bg-background px-3 py-1.5 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} filas</option>)}
                </select>
              </div>
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {dataset.headers.map((h) => <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row, i) => (
                      <TableRow key={startIndex + i}>
                        <TableCell className="text-xs text-muted-foreground">{full.format(startIndex + i + 1)}</TableCell>
                        {dataset.headers.map((h) => <TableCell key={h} className="max-w-[180px] truncate text-xs">{row[h] || ''}</TableCell>)}
                      </TableRow>
                    ))}
                    {visibleRows.length === 0 && (
                      <TableRow><TableCell colSpan={dataset.headers.length + 1} className="text-center text-sm text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
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
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operaciones de limpieza</CardTitle>
                <p className="text-xs text-muted-foreground">Se genera una nueva versión del archivo limpio en tu historial</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {nothingToClean ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <ShieldCheck className="h-4 w-4" /> Este dataset no tiene duplicados ni celdas vacías
                  </div>
                ) : (
                  <>
                    {[
                      { key: 'removeDuplicates' as const, label: 'Eliminar duplicados', desc: `${dupCount > 0 ? full.format(dupCount) + ' filas idénticas' : 'Sin duplicados'}`, disabled: dupCount === 0 },
                      { key: 'fillNumeric' as const, label: 'Rellenar numéricos con mediana', desc: `${numericMissing > 0 ? full.format(numericMissing) + ' celdas vacías' : 'Sin faltantes'}`, disabled: numericMissing === 0 },
                      { key: 'fillCategorical' as const, label: 'Rellenar texto con valor frecuente', desc: `${otherMissing > 0 ? full.format(otherMissing) + ' celdas vacías' : 'Sin faltantes'}`, disabled: otherMissing === 0 },
                    ].map((opt) => (
                      <div key={opt.key} className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        <Switch checked={options[opt.key]} disabled={opt.disabled} onCheckedChange={() => toggleOption(opt.key)} />
                      </div>
                    ))}
                    <Button onClick={() => void handleClean()} disabled={cleaning || (!options.removeDuplicates && !options.fillNumeric && !options.fillCategorical)} className="w-full">
                      {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {cleaning ? 'Limpiando...' : 'Ejecutar limpieza'}
                    </Button>
                  </>
                )}
                {lastReport && (
                  <div className="flex items-start gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>
                      <b>{lastReport.report.removedDuplicates}</b> duplicados eliminados, <b>{full.format(lastReport.report.filledCells)}</b> celdas rellenadas.
                      Guardada como <b className="font-mono">{lastReport.fileName}</b>.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hallazgos de calidad</CardTitle>
              </CardHeader>
              <CardContent>
                {findings.length === 0 && dupCount === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <ShieldCheck className="h-4 w-4" /> Sin problemas de calidad detectados
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dupCount > 0 && (
                      <div className="flex items-center gap-3 rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <Layers className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{full.format(dupCount)} filas duplicadas</p>
                          <p className="text-xs text-muted-foreground">Coinciden en todas sus columnas</p>
                        </div>
                      </div>
                    )}
                    {findings.slice(0, 6).map((col) => (
                      <div key={col.name} className="flex items-center gap-3 rounded-lg border p-3">
                        <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{col.name} <Badge variant="outline" className="text-[10px] ml-1">{TYPE_LABELS[col.type]}</Badge></p>
                          <p className="text-xs text-muted-foreground">{full.format(col.missing)} faltantes ({((col.missing / Math.max(dataset!.rowCount, 1)) * 100).toFixed(1)}%)</p>
                          <Progress value={100 - (col.missing / Math.max(dataset!.rowCount, 1)) * 100} className="h-1.5 mt-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {dataset && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de limpiezas</CardTitle>
            <p className="text-xs text-muted-foreground">Registros auditados en el backend para este dataset</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Eliminadas</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                    <TableHead className="text-right">Completitud</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{new Date(log.created_at).toLocaleString('es-MX')}</TableCell>
                      <TableCell className="text-right text-sm">{full.format(log.summary?.removedRows ?? 0)}</TableCell>
                      <TableCell className="text-right text-sm">{log.summary?.after ? full.format(log.summary.after.rowCount) : '—'}</TableCell>
                      <TableCell className="text-right text-sm">{log.summary?.after ? `${log.summary.after.completeness.toFixed(0)}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de datasets</CardTitle>
          <p className="text-xs text-muted-foreground">{history.length} versiones guardadas</p>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.slice(0, 10).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-sm">{e.fileName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.uploadedAt).toLocaleDateString('es-MX')}</TableCell>
                      <TableCell className="text-right text-xs">{full.format(e.rowCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No hay cargas registradas</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
