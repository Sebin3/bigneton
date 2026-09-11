import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BadgePercent, CalendarClock, CheckCircle2, Loader2, Megaphone, Plus, Table2, Upload, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import TableBuilder from '../../components/TableBuilder'
import ChartTooltip from '../../components/ChartTooltip'
import { CHART_CURSOR } from '../../lib/chartTokens'
import { deleteUserTable, getUserTables, saveUserTable, type UserTable } from '../../lib/datasetStore'
import { MANUAL_TABLE_ID } from '../../lib/pipeline'
import { createTable, tableFromCsv } from '../../lib/userTables'
import { STATUS_LABEL, TEMPLATES, buildTimeline, isOfferTable, summarizeOffers, type TableTemplate } from '../../lib/offers'
import { apiCrearOferta, apiGetOfertas, type OfertaSugerencia, type OfertasResult } from '../../api/datasets'
import { useData } from '../../context/useData'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

const full = new Intl.NumberFormat('es-MX')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 })

const TEMPLATE_ICONS: Record<TableTemplate['id'], LucideIcon> = { ofertas: BadgePercent, campanas: Megaphone, libre: Table2 }
const STEPS = ['Plantilla', 'Columnas', 'Datos'] as const

function promoIdeas(items: OfertaSugerencia[]): string[] {
  const ideas: string[] = []
  const top = items[0]
  if (!top) return ideas
  if (top.unidades > 1 && top.precioPromedio >= 200) ideas.push(`2x1 en «${top.producto}»`)
  else ideas.push('Envío gratis por compras desde $500')
  ideas.push('Combo de temporada con los productos top')
  return ideas.slice(0, 3)
}

export default function Ofertas() {
  const { dataset } = useData()
  const [tables, setTables] = useState<UserTable[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draftName, setDraftName] = useState('')
  const [templateId, setTemplateId] = useState<TableTemplate['id']>('ofertas')
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [wizardOpen, setWizardOpen] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)
  const [backendOffers, setBackendOffers] = useState<OfertasResult | null>(null)
  const [suggestionError, setSuggestionError] = useState('')
  const [suggesting, setSuggesting] = useState<string | null>(null)
  const [creatingAll, setCreatingAll] = useState(false)
  const [fetchedId, setFetchedId] = useState<string | null>(null)

  useEffect(() => {
    void getUserTables().then((all) => {
      const own = all.filter((t) => t.id !== MANUAL_TABLE_ID).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      setTables(own)
      setActiveId((current) => current || own[0]?.id || '')
    }).catch(() => setError('No se pudieron leer las tablas.')).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!dataset) return
    let cancelled = false
    void apiGetOfertas(dataset.id)
      .then((res) => {
        if (cancelled) return
        setBackendOffers(res)
        setSuggestionError('')
        setFetchedId(dataset.id)
      })
      .catch(() => {
        if (cancelled) return
        setBackendOffers(null)
        setSuggestionError('No se pudo analizar el dataset para sugerir ofertas.')
        setFetchedId(dataset.id)
      })
    return () => { cancelled = true }
  }, [dataset])

  const suggestionLoading = dataset != null && fetchedId !== dataset.id

  const applySuggestion = async (sug: OfertaSugerencia) => {
    if (!dataset) return
    setSuggesting(sug.producto)
    setSuggestionError('')
    try {
      const { oferta, persisted } = await apiCrearOferta(dataset.id, {
        producto: sug.producto,
        descuento: sug.descuentoSugerido,
        tipo: sug.tipo,
        vigencia: '30 days',
        persist: true,
      })
      if (!persisted) {
        setSuggestionError('El backend no pudo persistir la oferta.')
        return
      }
      const converted: UserTable = {
        id: persisted,
        name: oferta.producto,
        description: oferta.fundamento ?? '',
        icon: '👑',
        group: 'ofertas',
        fields: [
          { key: 'nombre', label: 'Producto', kind: 'text' },
          { key: 'tipo', label: 'Tipo', kind: 'text' },
          { key: 'descuento', label: 'Descuento', kind: 'number' },
          { key: 'precioOferta', label: 'Precio oferta', kind: 'number' },
        ],
        rows: [{ nombre: oferta.producto, tipo: oferta.tipo, descuento: String(oferta.descuento), precioOferta: String(oferta.precioOferta) }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTables((prev) => [...prev, converted].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
      setActiveId(persisted)
      setNotice(`Oferta «${oferta.producto}» creada con ${pct.format(oferta.descuento)} de descuento.`)
    } catch { setSuggestionError('No se pudo crear la oferta desde el backend.') } finally { setSuggesting(null) }
  }

  const applyAll = async () => {
    if (!dataset || !backendOffers || creatingAll) return
    setCreatingAll(true)
    setSuggestionError('')
    const added: UserTable[] = []
    let created = 0
    try {
      for (const sug of backendOffers.items) {
        try {
          const { oferta, persisted } = await apiCrearOferta(dataset.id, {
            producto: sug.producto,
            descuento: sug.descuentoSugerido,
            tipo: sug.tipo,
            vigencia: '30 days',
            persist: true,
          })
          if (!persisted) continue
          added.push({
            id: persisted,
            name: oferta.producto,
            description: oferta.fundamento ?? '',
            icon: '👑',
            group: 'ofertas',
            fields: [
              { key: 'nombre', label: 'Producto', kind: 'text' },
              { key: 'tipo', label: 'Tipo', kind: 'text' },
              { key: 'descuento', label: 'Descuento', kind: 'number' },
              { key: 'precioOferta', label: 'Precio oferta', kind: 'number' },
            ],
            rows: [{ nombre: oferta.producto, tipo: oferta.tipo, descuento: String(oferta.descuento), precioOferta: String(oferta.precioOferta) }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          created++
        } catch {
          continue
        }
      }
      if (created > 0) {
        setTables((prev) => [...added, ...prev].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
        setActiveId(added[0].id)
        setNotice(`${created} oferta${created > 1 ? 's' : ''} creada${created > 1 ? 's' : ''} desde el análisis del dataset.`)
      } else {
        setSuggestionError('No se pudo crear ninguna oferta desde el dataset.')
      }
    } finally { setCreatingAll(false) }
  }

  const activeTable = useMemo(() => tables.find((t) => t.id === activeId) ?? null, [tables, activeId])
  const summary = useMemo(() => summarizeOffers(tables), [tables])
  const timeline = useMemo(() => buildTimeline(summary.records), [summary.records])
  const offerTables = useMemo(() => tables.filter(isOfferTable), [tables])
  const hasData = tables.length > 0
  const showWizard = !loading && (!hasData || wizardOpen)
  const selectedTemplate = useMemo(() => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0], [templateId])

  const persist = useCallback(async (next: UserTable) => {
    setError('')
    setTables((prev) => prev.map((t) => (t.id === next.id ? next : t)))
    try { await saveUserTable(next) } catch { setError('No se pudo guardar.') }
  }, [])

  const create = async (template: TableTemplate) => {
    const table = createTable({ name: draftName.trim() || template.name, description: template.description, icon: template.icon, group: template.group, fields: template.fields })
    setTables((prev) => [...prev, table])
    setActiveId(table.id)
    setDraftName('')
    setNotice(`Tabla «${table.name}» creada.`)
    setStep(2)
    setWizardOpen(false)
    try { await saveUserTable(table) } catch { setError('No se pudo guardar.') }
  }

  const createFromCsv = async (file: File) => {
    try {
      const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]
      const table = await tableFromCsv(file, { name: draftName.trim() || undefined, group: template.group })
      setTables((prev) => [...prev, table])
      setActiveId(table.id)
      setDraftName('')
      setNotice(`«${table.name}» creada con ${table.rows.length} filas.`)
      setStep(2)
      setWizardOpen(false)
      await saveUserTable(table)
    } catch (err) { setNotice(''); setError(err instanceof Error ? err.message : 'No se pudo importar.') }
  }

  const remove = async (table: UserTable) => {
    if (!window.confirm(`¿Eliminar «${table.name}»?`)) return
    setTables((prev) => { const next = prev.filter((t) => t.id !== table.id); setActiveId((c) => c === table.id ? next[0]?.id ?? '' : c); return next })
    try { await deleteUserTable(table.id) } catch (err) { void err }
  }

  const kpis = [
    { label: 'Vigentes', value: full.format(summary.active), sub: `${full.format(summary.scheduled)} programadas · ${full.format(summary.expired)} vencidas` },
    { label: 'Inversión', value: money.format(summary.investment), sub: `${full.format(summary.total)} registros` },
    { label: 'Ingreso', value: money.format(summary.revenue), sub: summary.goalCoverage !== null ? `${pct.format(summary.goalCoverage)} de meta` : 'Sin meta' },
    { label: 'ROI', value: summary.roi === null ? '—' : pct.format(summary.roi), sub: `Margen ${money.format(summary.margin)}` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ofertas y promociones</h1>
          <p className="text-muted-foreground text-sm mt-1">El dataset sugiere ofertas y promociones automáticamente; convierte las mejores en tablas y mide su retorno</p>
        </div>
        {hasData && <Badge variant="outline">{full.format(summary.total)} registros · {tables.length} tablas</Badge>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && notice && <p className="text-sm text-emerald-600">{notice}</p>}

      {dataset && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" /> Análisis automático: ofertas y promociones
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sugerencias generadas a partir del contenido de «{dataset.fileName}»
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">Método insight</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestionLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando el dataset…
              </div>
            ) : backendOffers ? (
              <>
                {suggestionError && <p className="text-sm text-destructive">{suggestionError}</p>}
                {backendOffers.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No se pudieron sugerir ofertas con el dataset actual.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {backendOffers.productoColumn
                          ? `Producto detectado en «${backendOffers.productoColumn}» · ${money.format(backendOffers.totalRevenue)} en ventas`
                          : 'El backend no detectó una columna de producto clara'}
                      </p>
                      <Button size="sm" disabled={creatingAll} onClick={() => void applyAll()}>
                        {creatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        Aplicar todas las sugeridas
                      </Button>
                    </div>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Rendimiento</TableHead>
                            <TableHead className="text-right">Unidades</TableHead>
                            <TableHead className="text-right">Precio prom.</TableHead>
                            <TableHead className="text-right">Descuento sugerido</TableHead>
                            <TableHead className="text-right">Precio de oferta</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {backendOffers.items.slice(0, 12).map((sug) => (
                            <TableRow key={sug.producto}>
                              <TableCell>
                                <p className="text-sm font-medium">{sug.producto}</p>
                                <p className="text-[11px] text-muted-foreground max-w-[260px] truncate">{sug.fundamento}</p>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px]">{sug.etiqueta}</Badge></TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{full.format(sug.unidades)}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{money.format(sug.precioPromedio)}</TableCell>
                              <TableCell className="text-right"><Badge className="text-[10px]">{pct.format(sug.descuentoSugerido)}</Badge></TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-primary font-semibold">{money.format(sug.precioOferta)}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" disabled={suggesting === sug.producto} onClick={() => void applySuggestion(sug)}>
                                  {suggesting === sug.producto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                  Crear
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Ideas de promociones:</span>
                      {promoIdeas(backendOffers.items).map((idea) => (
                        <Badge key={idea} variant="secondary" className="text-[10px]">{idea}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                {suggestionError || 'No hay dataset vinculado para analizar.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showWizard && (
        <nav className="flex items-center gap-2 bg-card border rounded-xl p-3">
          {STEPS.map((label, i) => (
            <span key={label} className={`flex items-center gap-1.5 text-sm font-medium ${step >= i ? 'text-primary' : 'text-muted-foreground'}`}>
              {step > i ? <CheckCircle2 className="h-4 w-4" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs">{i + 1}</span>}
              {label}
              {i < STEPS.length - 1 && <span className="mx-1 text-border">→</span>}
            </span>
          ))}
        </nav>
      )}

      {showWizard && step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Elegí una plantilla</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {TEMPLATES.map((template) => {
                const Icon = TEMPLATE_ICONS[template.id]
                return (
                  <button key={template.id} onClick={() => setTemplateId(template.id)} className={`text-left rounded-xl border p-4 transition-colors ${templateId === template.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted'}`}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2"><Icon className="h-5 w-5" /></span>
                    <p className="font-semibold text-sm">{template.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mt-2">{template.fields.length} columnas base</p>
                  </button>
                )
              })}
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1"><label className="text-xs text-muted-foreground">Nombre</label><Input placeholder={`Nombre (por defecto «${selectedTemplate.name}»)`} value={draftName} onChange={(e) => setDraftName(e.target.value)} /></div>
              <Button onClick={() => setStep(1)}>Siguiente →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showWizard && step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Columnas de «{draftName.trim() || selectedTemplate.name}»</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3">
              {selectedTemplate.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="font-mono text-xs text-primary font-semibold w-20 truncate">{f.key}</span>
                  <span className="text-sm flex-1">{f.label}</span>
                  <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void createFromCsv(file) }} />
              <Button variant="outline" onClick={() => csvRef.current?.click()}><Upload className="h-4 w-4" /> Importar CSV</Button>
              <Button onClick={() => void create(selectedTemplate)}>Crear vacía</Button>
              <Button variant="ghost" onClick={() => setStep(0)}>← Atrás</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && offerTables.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{k.label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground mt-1">{k.sub}</p></CardContent>
              </Card>
            ))}
          </div>

          {timeline && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Vigencias</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {timeline.bars.map(({ record, offset, width }) => (
                  <div key={record.id} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-32 truncate">{record.name}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full relative overflow-hidden">
                      {timeline.todayOffset !== null && <span className="absolute top-0 bottom-0 w-0.5 bg-destructive" style={{ left: `${timeline.todayOffset}%` }} />}
                      <span className="absolute top-1 h-3 rounded-full bg-primary/70" style={{ left: `${offset}%`, width: `${width}%` }} />
                    </div>
                    <Badge variant={record.status === 'activa' ? 'default' : record.status === 'programada' ? 'secondary' : 'outline'} className="text-[10px]">{STATUS_LABEL[record.status]}</Badge>
                    <span className="text-xs font-semibold text-primary w-20 text-right">{money.format(record.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Inversión vs Ingreso por mes</CardTitle></CardHeader>
              <CardContent>
                {summary.byMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.byMonth} margin={{ left: -12, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip formatValue={(v) => money.format(v)} />} cursor={{ fill: CHART_CURSOR, opacity: 0.4 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar name="Inversión" dataKey="inversion" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar name="Ingreso" dataKey="ingreso" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sin fechas capturadas</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Rendimiento por canal</CardTitle></CardHeader>
              <CardContent>
                {summary.channels.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Canal</TableHead><TableHead className="text-right">Inversión</TableHead><TableHead className="text-right">Ingreso</TableHead><TableHead className="text-right">ROI</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {summary.channels.map((c) => (
                          <TableRow key={c.channel}>
                            <TableCell className="font-medium text-sm">{c.channel}</TableCell>
                            <TableCell className="text-right text-sm">{money.format(c.investment)}</TableCell>
                            <TableCell className="text-right text-sm">{money.format(c.revenue)}</TableCell>
                            <TableCell className="text-right text-sm"><Badge variant={c.roi !== null && c.roi < 0 ? 'destructive' : 'default'}>{c.roi === null ? '—' : pct.format(c.roi)}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sin canales</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {tables.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tables.map((t) => (
            <Button key={t.id} variant={t.id === activeId ? 'default' : 'outline'} size="sm" onClick={() => setActiveId(t.id)}>
              {t.name} <Badge variant="secondary" className="ml-1 text-[10px]">{t.rows.length}</Badge>
            </Button>
          ))}
          <span className="text-xs text-muted-foreground px-1">Tablas manuales</span>
          <Button variant="ghost" size="sm" onClick={() => { setStep(0); setWizardOpen(true) }}><Plus className="h-3.5 w-3.5" /> Nueva tabla</Button>
        </div>
      )}

      {activeTable ? (
        <TableBuilder key={activeTable.id} table={activeTable} onChange={(next) => void persist(next)} onDelete={(t) => void remove(t)} />
      ) : !loading && !showWizard && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Table2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No tienes tablas aún. Creá una desde el asistente manual.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
