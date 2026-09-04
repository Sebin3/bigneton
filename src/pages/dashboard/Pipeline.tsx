import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Settings2, Target, Trash2 } from 'lucide-react'
import { useData } from '../../context/useData'
import { getUserTables, saveUserTable, deleteUserTable, type UserTable } from '../../lib/datasetStore'
import { EMPTY_MAP, MANUAL_TABLE_ID, defaultProbability, opportunitiesFromDataset, opportunitiesFromTable, orderStages, summarize, type Opportunity, type PipelineMap } from '../../lib/pipeline'
import { apiGetPipeline, apiSavePipeline } from '../../api/pipelines'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'

const full = new Intl.NumberFormat('es-MX')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function shortDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function advanceStage(stage: string, ordered: string[]): string | null {
  const i = ordered.indexOf(stage)
  if (i < 0 || i >= ordered.length - 1) return null
  return ordered[i + 1]
}

export default function Pipeline() {
  const { dataset } = useData()
  const [map, setMap] = useState<PipelineMap>({ ...EMPTY_MAP })
  const [table, setTable] = useState<UserTable | null>(null)
  const [error, setError] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [draft, setDraft] = useState({ etapa: '', monto: '', responsable: '', cierre: '' })

  useEffect(() => {
    void getUserTables().then((tables) => {
      const found = tables.find((t) => t.id === MANUAL_TABLE_ID)
      if (found) setTable(found)
    })
  }, [])

  useEffect(() => {
    if (!dataset) return
    void apiGetPipeline(dataset.id).then((saved) => {
      if (saved) setMap(saved)
      else setMap((prev) => ({ ...EMPTY_MAP, datasetId: dataset.id, amount: dataset.roles.revenue ?? '', closeDate: dataset.roles.date ?? '', stage: dataset.roles.category ?? '', probabilities: prev.probabilities }))
    }).catch(() => {
      setMap((prev) => ({ ...prev, datasetId: dataset.id, amount: dataset.roles.revenue ?? '', closeDate: dataset.roles.date ?? '', stage: dataset.roles.category ?? '' }))
    })
  }, [dataset])

  const columnNames = useMemo(() => (dataset?.columns ?? []).map((c) => c.name), [dataset])
  const numericNames = useMemo(() => (dataset?.columns ?? []).filter((c) => c.type === 'numeric').map((c) => c.name), [dataset])
  const dateNames = useMemo(() => (dataset?.columns ?? []).filter((c) => c.type === 'date').map((c) => c.name), [dataset])

  const activeMap = useMemo(() => {
    if (!dataset) return { ...EMPTY_MAP, probabilities: map.probabilities }
    if (map.datasetId === dataset.id) return map
    return { ...EMPTY_MAP, datasetId: dataset.id, amount: dataset.roles.revenue ?? '', closeDate: dataset.roles.date ?? '', stage: dataset.roles.category ?? '', probabilities: map.probabilities }
  }, [dataset, map])

  const updateMap = useCallback((patch: Partial<PipelineMap>) => {
    setMap((prev) => {
      const next = { ...prev, ...patch }
      if (next.datasetId) apiSavePipeline(next).catch(() => setError('No se pudo guardar el mapeo.'))
      return next
    })
  }, [])

  const opportunities = useMemo(() => [...opportunitiesFromDataset(dataset, activeMap), ...opportunitiesFromTable(table)], [dataset, activeMap, table])
  const summary = useMemo(() => summarize(opportunities, activeMap.probabilities), [opportunities, activeMap.probabilities])
  const stageOrder = useMemo(() => orderStages([...new Set(opportunities.map((o) => o.stage))]), [opportunities])

  const columns = useMemo(() => {
    const byStage = new Map<string, Opportunity[]>()
    for (const o of opportunities) {
      if (!byStage.has(o.stage)) byStage.set(o.stage, [])
      byStage.get(o.stage)!.push(o)
    }
    return stageOrder.map((stage) => ({
      stage,
      opps: byStage.get(stage) ?? [],
      prob: activeMap.probabilities[stage] ?? defaultProbability(stage),
      amount: (byStage.get(stage) ?? []).reduce((a, o) => a + o.amount, 0),
    })).filter((c) => c.opps.length > 0)
  }, [opportunities, stageOrder, activeMap.probabilities])

  const persist = useCallback(async (next: UserTable) => {
    setTable(next)
    try { await saveUserTable(next) } catch { setError('No se pudo guardar.') }
  }, [])

  const addManual = async () => {
    const amount = Number(draft.monto.replace(',', '.'))
    if (!draft.etapa.trim() || !amount) { setError('Completa etapa y monto.'); return }
    setError('')
    const base: UserTable = table ?? { id: MANUAL_TABLE_ID, name: 'Oportunidades manuales', description: '', icon: 'target', group: 'libre', fields: [], rows: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const row = { id: `manual-${Date.now().toString(36)}`, etapa: draft.etapa.trim(), monto: String(amount), responsable: draft.responsable.trim(), cierre: draft.cierre, probabilidad: '' }
    await persist({ ...base, rows: [row, ...base.rows], updatedAt: new Date().toISOString() })
    setDraft({ etapa: '', monto: '', responsable: '', cierre: '' })
  }

  const advanceManual = async (id: string) => {
    if (!table) return
    const row = table.rows.find((r) => r.id === id)
    if (!row) return
    const next = advanceStage(row.etapa, stageOrder)
    if (!next) return
    await persist({ ...table, rows: table.rows.map((r) => r.id === id ? { ...r, etapa: next } : r), updatedAt: new Date().toISOString() })
  }

  const removeManual = async (id: string) => {
    if (!table) return
    const rows = table.rows.filter((r) => r.id !== id)
    if (rows.length === 0) { setTable(null); await deleteUserTable(MANUAL_TABLE_ID).catch(() => {}); return }
    await persist({ ...table, rows, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de ventas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organiza tus oportunidades por etapa: desde el primer contacto hasta el cierre
          </p>
        </div>
        <div className="flex gap-2">
          {dataset && (
            <Button variant="outline" onClick={() => setShowConfig((v) => !v)}>
              <Settings2 className="h-4 w-4" /> Columnas
            </Button>
          )}
        </div>
      </div>

      {/* Explanation card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">¿Cómo funciona el pipeline?</p>
            <p className="text-muted-foreground">
              Cada oportunidad avanza por etapas: <strong>Contacto → Propuesta → Negociación → Cierre</strong>.
              Las oportunidades del CSV se mapean automáticamente según las columnas que configures.
              Puedes agregar oportunidades manualmente o vincularlas a tu dataset.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Config panel */}
      {showConfig && dataset && (
        <Card>
          <CardHeader><CardTitle className="text-base">Mapeo de columnas del CSV</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {([['Etapa', 'stage', columnNames], ['Monto', 'amount', numericNames], ['Responsable', 'owner', columnNames], ['Cierre', 'closeDate', dateNames.length > 0 ? dateNames : columnNames]] as const).map(([label, key, options]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={(activeMap as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => updateMap({ [key]: e.target.value })}
                >
                  <option value="">— sin asignar —</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Oportunidades</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{full.format(summary.total)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">En pipeline</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money.format(summary.open)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ticket promedio</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money.format(summary.ticket)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Proyección ponderada</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{money.format(summary.weighted)}</p></CardContent>
        </Card>
      </div>

      {/* Quick add */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground">Etapa</label>
            <Input placeholder="Ej. Propuesta" value={draft.etapa} onChange={(e) => setDraft({ ...draft, etapa: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground">Monto</label>
            <Input placeholder="50000" inputMode="decimal" value={draft.monto} onChange={(e) => setDraft({ ...draft, monto: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground">Responsable</label>
            <Input placeholder="Nombre" value={draft.responsable} onChange={(e) => setDraft({ ...draft, responsable: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground">Cierre estimado</label>
            <Input type="date" value={draft.cierre} onChange={(e) => setDraft({ ...draft, cierre: e.target.value })} />
          </div>
          <Button onClick={() => void addManual()}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </CardContent>
      </Card>

      {/* Kanban board */}
      {columns.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const won = col.prob >= 100
            return (
              <div key={col.stage} className="flex-shrink-0 w-[300px]">
                <div className={`rounded-xl border ${won ? 'border-emerald-300 bg-emerald-50/50' : 'bg-muted/30'}`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div>
                      <p className="font-semibold text-sm">{col.stage}</p>
                      <p className="text-xs text-muted-foreground">{full.format(col.opps.length)} · {money.format(col.amount)}</p>
                    </div>
                    <Badge variant={won ? 'default' : 'secondary'} className="text-xs">{col.prob}%</Badge>
                  </div>
                  <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                    {col.opps.map((o) => (
                      <div key={o.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{money.format(o.amount)}</p>
                          <Badge variant="outline" className="text-[10px]">{o.source === 'manual' ? 'Manual' : 'CSV'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{o.owner || 'Sin responsable'}</p>
                        <p className="text-xs text-muted-foreground">Cierre: {shortDate(o.closeDate)}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-primary font-medium">{money.format((o.amount * (activeMap.probabilities[o.stage] ?? defaultProbability(o.stage))) / 100)} proy.</span>
                          {o.source === 'manual' && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={advanceStage(o.stage, stageOrder) === null} onClick={() => void advanceManual(o.id)}>
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => void removeManual(o.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Target className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Tu tablero está vacío. Agrega una oportunidad manual o configura las columnas de tu CSV para empezar.
            </p>
            {dataset ? (
              <Button variant="outline" onClick={() => setShowConfig(true)}>Configurar columnas</Button>
            ) : (
              <Link to="/dashboard/procesar"><Button variant="outline">Procesar un CSV</Button></Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
