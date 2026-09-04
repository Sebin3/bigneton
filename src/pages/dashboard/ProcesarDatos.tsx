import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Download,
  FileSpreadsheet,
  FileUp,
  Gauge,
  Layers,
  Loader2,
  RefreshCw,
  Split,
  Trash2,
  Upload,
} from 'lucide-react'
import { useData } from '../../context/useData'
import {
  DELIMITERS_TO_GUESS,
  analyzeCsvFile,
  delimiterLabel,
  formatBytes,
  formatDuration,
  type ProcessPhase,
} from '../../lib/csvAnalyzer'
import { exportDatasetCsv } from '../../lib/backup'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

const STEPS: { key: ProcessPhase; label: string; detail: string }[] = [
  { key: 'validating', label: 'Validando formato', detail: 'Extensión y tipo MIME del archivo' },
  { key: 'reading', label: 'Leyendo archivo', detail: 'Separador, salto de línea y encabezados' },
  { key: 'analyzing', label: 'Analizando columnas', detail: 'Tipos, estadísticos y valores faltantes' },
  { key: 'finalizing', label: 'Guardando y vinculando', detail: 'Copia en el almacén y métricas del panel' },
]

const STEP_ORDER: ProcessPhase[] = ['idle', 'validating', 'reading', 'analyzing', 'finalizing', 'done']

const AUTO = 'auto'

function stepState(stepKey: ProcessPhase, phase: ProcessPhase) {
  if (phase === 'done') return 'done'
  const currentIdx = STEP_ORDER.indexOf(phase)
  const stepIdx = STEP_ORDER.indexOf(stepKey)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'current'
  return 'pending'
}

const full = new Intl.NumberFormat('es-MX')

const TYPE_COLORS: Record<string, string> = {
  numeric: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  categorical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  text: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  boolean: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

export default function ProcesarDatos() {
  const { dataset, saveDataset, removeDataset } = useData()
  const [phase, setPhase] = useState<ProcessPhase>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [lastProcessed, setLastProcessed] = useState('')
  const [delimiter, setDelimiter] = useState<string>(AUTO)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = phase !== 'idle' && phase !== 'done'
  const hasResult = Boolean(dataset && !error)

  const handleFile = async (file: File | undefined | null, delimiterOverride: string = delimiter) => {
    if (!file || busy) return
    setError('')
    setLastProcessed('')
    setLastFile(file)
    try {
      const result = await analyzeCsvFile(file, setPhase, {
        delimiter: delimiterOverride === AUTO ? undefined : delimiterOverride,
      })
      saveDataset(result)
      setLastProcessed(result.fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
      setPhase('idle')
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!busy) setDragActive(true)
  }

  const onPickAnother = () => {
    setLastProcessed('')
    if (dataset) removeDataset(dataset.id)
    setPhase('idle')
    inputRef.current?.click()
  }

  const previewHeaders = dataset?.headers.slice(0, 6) ?? []
  const previewRows = dataset?.rows.slice(0, 8) ?? []
  const meta = dataset?.parseMeta

  const analysisCards = dataset
    ? [
        { icon: Layers, label: 'Filas procesadas', value: full.format(dataset.rowCount), sub: `${dataset.columnCount} columnas detectadas` },
        { icon: Gauge, label: 'Completitud', value: `${dataset.completeness.toFixed(1)}%`, sub: dataset.missingCells > 0 ? `${full.format(dataset.missingCells)} celdas vacías` : 'Sin celdas vacías' },
        { icon: FileSpreadsheet, label: 'Duplicados', value: full.format(dataset.duplicateRows), sub: 'Filas repetidas detectadas' },
        { icon: FileUp, label: 'Peso', value: formatBytes(dataset.sizeBytes), sub: formatDuration(dataset.processMs) },
      ]
    : []

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procesar datos</h1>
          <p className="text-sm text-muted-foreground mt-1">Sube tu CSV, el motor lo analiza al instante y te muestra la calidad y el perfil de tus datos.</p>
        </div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Ver panel general</Link>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${!hasResult ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
          <span className="h-6 w-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">{hasResult ? '✓' : '1'}</span>
          <div className="leading-tight"><strong>Subir archivo</strong><br /><span className="text-xs opacity-70">Selecciona tu CSV</span></div>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors ${hasResult ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          <span className="h-6 w-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">2</span>
          <div className="leading-tight"><strong>Revisa el análisis</strong><br /><span className="text-xs opacity-70">Calidad y perfil de datos</span></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="space-y-4">
          {!hasResult ? (
            <>
              {/* Delimiter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Split size={14} /> Separador</span>
                <div className="flex gap-1" role="radiogroup" aria-label="Separador del CSV">
                  <button type="button" role="radio" aria-checked={delimiter === AUTO}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${delimiter === AUTO ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:bg-accent'}`}
                    onClick={() => setDelimiter(AUTO)} disabled={busy}>Automático</button>
                  {DELIMITERS_TO_GUESS.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={delimiter === d}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${delimiter === d ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:bg-accent'}`}
                      onClick={() => setDelimiter(d)} disabled={busy}>{delimiterLabel(d)}</button>
                  ))}
                </div>
                {lastFile && !busy && (
                  <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto" onClick={() => void handleFile(lastFile)} title={`Volver a leer ${lastFile.name}`}>
                    <RefreshCw size={13} /> Releer
                  </button>
                )}
              </div>

              {/* Dropzone */}
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-foreground/30'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => !busy && inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={() => setDragActive(false)}
                role="button"
                tabIndex={0}
                aria-disabled={busy}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click() }}
              >
                <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }} />
                {busy ? (
                  <>
                    <Loader2 size={34} className="animate-spin text-primary" />
                    <strong className="text-sm">Procesando archivo…</strong>
                    <small className="text-xs text-muted-foreground">No cierres ni recargues la ventana</small>
                  </>
                ) : (
                  <>
                    <Upload size={30} strokeWidth={1.8} className="text-muted-foreground" />
                    <strong className="text-sm">Arrastra tu archivo o haz clic para seleccionarlo</strong>
                    <small className="text-xs text-muted-foreground">CSV · TSV · hasta 200,000 filas</small>
                    <span className="text-xs text-muted-foreground/60">El separador se detecta solo</span>
                  </>
                )}
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  <AlertTriangle size={16} /> {error}
                </p>
              )}
            </>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Análisis del archivo</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">«{lastProcessed}» se analizó y guardó correctamente</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                    <Gauge size={13} /> Completitud {dataset?.completeness.toFixed(1)}%
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar CSV" onClick={() => dataset && exportDatasetCsv(dataset, meta?.delimiter ?? ',')}>
                    <Download size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Quitar y subir otro" onClick={onPickAnother}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Analysis stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysisCards.map((k) => (
                    <div key={k.label} className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <k.icon size={16} className="text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-lg font-bold">{k.value}</p>
                      <p className="text-xs text-muted-foreground">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Parse meta */}
                {meta && (
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div><span className="text-muted-foreground">Separador</span> <strong>{delimiterLabel(meta.delimiter)}</strong></div>
                    <div><span className="text-muted-foreground">Salto de línea</span> <strong>{meta.linebreak}</strong></div>
                    <div><span className="text-muted-foreground">Codificación</span> <strong>UTF-8{meta.bom ? ' + BOM' : ''}</strong></div>
                    <div><span className="text-muted-foreground">Columnas</span> <strong>{dataset?.columnCount}</strong></div>
                  </div>
                )}

                {/* Type badges */}
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Columns3 size={14} /> Tipos detectados</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(
                      (dataset?.columns ?? []).reduce((map, c) => { map.set(c.type, (map.get(c.type) ?? 0) + 1); return map }, new Map<string, number>()),
                    ).map(([type, count]) => (
                      <span key={type} className={`px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground'}`}>{type} ×{count}</span>
                    ))}
                  </div>
                </div>

                {/* Preview table */}
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {previewHeaders.map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {previewHeaders.map((h) => <td key={h} className="px-3 py-1.5 text-muted-foreground">{row[h] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vista previa de las primeras 8 filas ·{' '}
                  {dataset && dataset.headers.length > 6 ? `mostrando 6 de ${dataset.headers.length} columnas` : `${dataset?.headers.length ?? 0} columnas`}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onPickAnother}><Upload size={16} /> Procesar otro archivo</Button>
                  <Link to="/dashboard/estructura"><Button variant="outline"><Columns3 size={16} /> Ver estructura</Button></Link>
                  <Link to="/dashboard/graficos"><Button variant="outline">Ver gráficos</Button></Link>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Pipeline de proceso</CardTitle>
                <p className="text-xs text-muted-foreground">Ejecución paso a paso</p>
              </div>
              {!busy && (
                <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setPhase('idle')} title="Reiniciar">
                  <RefreshCw size={14} />
                </button>
              )}
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {STEPS.map((step) => {
                  const state = stepState(step.key, phase)
                  return (
                    <li key={step.key} className={`flex items-start gap-3 text-sm ${state === 'pending' ? 'opacity-40' : ''}`}>
                      <span className="mt-0.5 shrink-0">
                        {state === 'done' ? <CheckCircle2 size={18} className="text-green-500" /> : state === 'current' ? <Loader2 size={18} className="animate-spin text-primary" /> : <span className="block h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                      </span>
                      <div>
                        <strong className="block text-xs">{step.label}</strong>
                        <small className="text-xs text-muted-foreground">{step.detail}</small>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Qué obtienes</CardTitle>
              <p className="text-xs text-muted-foreground">Lo que el motor analiza por ti al importar</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {[
                  ['Tipos', 'Numérico, fecha, texto, categoría y booleano'],
                  ['Calidad', 'Completitud y filas duplicadas'],
                  ['Estadísticos', 'Mín, máx, media, mediana y valores top'],
                  ['Gráficas', 'Evolución, distribución y categorías'],
                ].map(([col, why]) => (
                  <li key={col}>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{col}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{why}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
