import { useEffect, useMemo, useState } from 'react'
import { BadgePercent, Info, Loader2, Plus, Trash2, Wand2 } from 'lucide-react'
import { useData } from '../../context/useData'
import { parseNum } from '../../lib/csvAnalyzer'
import { newRowId, toISODate } from '../../lib/userTables'
import {
  deleteUserTable,
  getUserTables,
  saveUserTable,
  type FieldDef,
  type TableRow,
  type UserTable,
} from '../../lib/datasetStore'
import { apiCrearOferta, apiGetOfertas, type ImpactoOferta, type OfertaSugerencia } from '../../api/datasets'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as TableRowComp } from '../../components/ui/table'

const full = new Intl.NumberFormat('es-MX')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 })

const OFFERS_TABLE_NAME = 'Ofertas y promociones'
const OFFER_FIELDS: FieldDef[] = [
  { key: 'producto', label: 'Producto', kind: 'text', locked: true },
  { key: 'tipo', label: 'Tipo', kind: 'text', locked: true },
  { key: 'descuento', label: 'Descuento (%)', kind: 'number', locked: true },
  { key: 'precioAnterior', label: 'Precio anterior', kind: 'number', locked: true },
  { key: 'precioOferta', label: 'Precio oferta', kind: 'number', locked: true },
  { key: 'vigencia_inicio', label: 'Inicio', kind: 'date', locked: true },
  { key: 'vigencia_fin', label: 'Fin', kind: 'date', locked: true },
]
const TIPO_LABEL: Record<string, string> = {
  descuento_leve: 'FidelizaciÃ³n',
  descuento_medio: 'Impulso de ventas',
  descuento_liquidacion: 'LiquidaciÃ³n',
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function fmtDate(iso: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('es-MX')
}

function formatTipo(tipo: string): string {
  return TIPO_LABEL[tipo] ?? (tipo.trim() ? tipo.trim() : 'Descuento')
}

/** Normaliza una fila del backend (o de versiones viejas) al formato estable. */
function normalizeOfferRow(row: TableRow): TableRow {
  return {
    id: row.id || newRowId(),
    producto: String(row.producto ?? row.nombre ?? 'Sin nombre').trim(),
    tipo: String(row.tipo ?? '').trim(),
    descuento: String(row.descuento ?? '').trim(),
    precioAnterior: String(row.precioAnterior ?? row.precio ?? '').trim(),
    precioOferta: String(row.precioOferta ?? '').trim(),
    vigencia_inicio: String(row.vigencia_inicio ?? '').trim(),
    vigencia_fin: String(row.vigencia_fin ?? '').trim(),
  }
}

/** Construye el UserTable que el backend guarda en el grupo "ofertas". */
function buildOffersTable(id: string, createdAt: string, rows: TableRow[]): UserTable {
  return {
    id,
    name: OFFERS_TABLE_NAME,
    description: 'Creado desde el anÃ¡lisis de ventas',
    icon: 'percent',
    group: 'ofertas',
    fields: OFFER_FIELDS,
    rows,
    createdAt,
    updatedAt: new Date().toISOString(),
  }
}

/** Convierte la respuesta de apiCrearOferta en una fila de Â«Tus ofertasÂ». */
function offerRow(oferta: ImpactoOferta, inicio: string, fin: string): TableRow {
  return {
    id: newRowId(),
    producto: oferta.producto,
    tipo: oferta.tipo ?? '',
    descuento: String(oferta.descuento ?? ''),
    precioAnterior: String(oferta.precioAnterior ?? ''),
    precioOferta: String(oferta.precioOferta ?? ''),
    vigencia_inicio: inicio,
    vigencia_fin: fin,
  }
}

function promoIdeas(items: OfertaSugerencia[]): string[] {
  const top = items[0]
  if (!top) return []
  const ideas: string[] = []
  if (top.unidades > 1 && top.precioPromedio >= 200) ideas.push(`2x1 en Â«${top.producto}Â»`)
  else ideas.push('EnvÃ­o gratis por compras desde $500')
  ideas.push('Combo de temporada con los productos top')
  return ideas.slice(0, 3)
}

export default function Ofertas() {
  const { dataset } = useData()
  const [offers, setOffers] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [backendOffers, setBackendOffers] = useState<OfertaSugerencia[]>([])
  const [suggestionError, setSuggestionError] = useState('')
  const [creating, setCreating] = useState<string | null>(null)
  const [creatingAll, setCreatingAll] = useState(false)
  const [fetchedId, setFetchedId] = useState<string | null>(null)

  const [producto, setProducto] = useState('')
  const [descuento, setDescuento] = useState('')
  const [inicio, setInicio] = useState(() => toISODate(new Date()))
  const [fin, setFin] = useState(() => toISODate(addDays(new Date(), 30)))
  const [manualSaving, setManualSaving] = useState(false)

  const [meta, setMeta] = useState<{ id: string; createdAt: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void getUserTables()
      .then((all) => {
        if (cancelled) return
        const offerTables = all.filter((t) => (t.group ?? 'libre') === 'ofertas')
        if (offerTables.length === 0) {
          setLoading(false)
          return
        }
        const main = offerTables.find((t) => t.name === OFFERS_TABLE_NAME) ?? offerTables[0]
        const extras = offerTables.filter((t) => t.id !== main.id)

        const seen = new Set<string>()
        const rows: TableRow[] = []
        for (const source of [main, ...extras]) {
          for (const row of source.rows ?? []) {
            const norm = normalizeOfferRow(row)
            const key = `${norm.producto}|${norm.tipo}|${norm.descuento}|${norm.precioOferta}`
            if (seen.has(key)) continue
            seen.add(key)
            rows.push(norm)
          }
        }

        const missingIds = (main.rows ?? []).some((row) => !row.id)
        const hasMain = main.name === OFFERS_TABLE_NAME && main.group === 'ofertas'
        const changed = rows.length !== (main.rows?.length ?? 0) || extras.length > 0 || missingIds

        setMeta({ id: main.id, createdAt: main.createdAt })
        setOffers(rows)

        if (changed) {
          const consolidated = buildOffersTable(
            main.id,
            main.createdAt,
            hasMain ? rows : rows.map((r) => ({ ...r, id: r.id || newRowId() })),
          )
          void saveUserTable(consolidated).catch(() => {
            setError('No se pudieron guardar las ofertas consolidadas.')
          })
          for (const extra of extras) {
            void deleteUserTable(extra.id).catch(() => {})
          }
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudieron leer tus ofertas. VerificÃ¡ tu conexiÃ³n.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!dataset) return
    let cancelled = false
    void apiGetOfertas(dataset.id)
      .then((res) => {
        if (!cancelled) {
          setBackendOffers(res?.items ?? [])
          setSuggestionError('')
          setFetchedId(dataset.id)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendOffers([])
          setSuggestionError('No se pudo analizar el dataset para sugerir ofertas.')
          setFetchedId(dataset.id)
        }
      })
    return () => { cancelled = true }
  }, [dataset])

  const suggestionLoading = dataset != null && fetchedId !== dataset.id

  const persistOffers = async (next: TableRow[]) => {
    setOffers(next)
    const createdAt = meta?.createdAt ?? new Date().toISOString()
    const id = meta?.id ?? `tabla-ofertas-promociones-${new Date().getTime().toString(36)}`
    try {
      await saveUserTable(buildOffersTable(id, createdAt, next))
      setMeta({ id, createdAt })
    } catch {
      setError('No se pudo guardar la oferta. VerificÃ¡ tu conexiÃ³n.')
    }
  }

  const addOffer = (row: TableRow) => {
    void persistOffers([...offers, row])
  }

  const createAll = async () => {
    if (backendOffers.length === 0 || creatingAll) return
    setCreatingAll(true)
    setSuggestionError('')
    setNotice('')
    const hoy = toISODate(new Date())
    const finVigencia = toISODate(addDays(new Date(), 30))
    let creadas = 0
    const pendientes: TableRow[] = []
    for (const sug of backendOffers) {
      try {
        const { oferta } = await apiCrearOferta(dataset!.id, {
          producto: sug.producto,
          descuento: sug.descuentoSugerido,
          tipo: sug.tipo,
          vigenciaInicio: hoy,
          vigenciaFin: finVigencia,
          persist: true,
        })
        pendientes.push(offerRow(oferta, hoy, finVigencia))
        creadas++
      } catch {
        /* se omite este producto */
      }
    }
    if (creadas > 0) {
      void persistOffers([...offers, ...pendientes])
      setNotice(`${creadas} oferta${creadas > 1 ? 's' : ''} creada${creadas > 1 ? 's' : ''} desde el anÃ¡lisis.`)
    } else {
      setSuggestionError('No se pudo crear ninguna oferta desde el dataset.')
    }
    setCreatingAll(false)
  }

  const createSuggestion = async (sug: OfertaSugerencia) => {
    setCreating(sug.producto)
    setSuggestionError('')
    setNotice('')
    const hoy = toISODate(new Date())
    const finVigencia = toISODate(addDays(new Date(), 30))
    try {
      const { oferta } = await apiCrearOferta(dataset!.id, {
        producto: sug.producto,
        descuento: sug.descuentoSugerido,
        tipo: sug.tipo,
        vigenciaInicio: hoy,
        vigenciaFin: finVigencia,
        persist: true,
      })
      addOffer(offerRow(oferta, hoy, finVigencia))
      setNotice(`Oferta creada para Â«${oferta.producto}Â»: ${money.format(oferta.precioOferta)} (${pct.format(oferta.descuento / 100)} dto.).`)
    } catch {
      setSuggestionError('No se pudo crear la oferta desde el backend.')
    } finally {
      setCreating(null)
    }
  }

  const submitManual = async () => {
    if (!dataset) return
    const dto = parseNum(descuento) ?? 0
    if (!producto) {
      setError('ElegÃ­ el producto del dataset.')
      return
    }
    setManualSaving(true)
    setError('')
    setNotice('')
    try {
      const { oferta } = await apiCrearOferta(dataset.id, {
        producto,
        descuento: Math.max(0, Math.min(100, dto)),
        vigenciaInicio: inicio || toISODate(new Date()),
        vigenciaFin: fin,
        persist: true,
      })
      addOffer(offerRow(oferta, inicio || toISODate(new Date()), fin))
      setProducto('')
      setDescuento('')
      setNotice(`Oferta guardada para Â«${oferta.producto}Â».`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la oferta.')
    } finally {
      setManualSaving(false)
    }
  }

  const deleteOffer = (id: string) => {
    setNotice('')
    setError('')
    const next = offers.filter((row) => row.id !== id)
    if (next.length === 0) {
      if (meta) {
        void deleteUserTable(meta.id)
          .then(() => setMeta(null))
          .catch(() => setError('No se pudo eliminar la oferta.'))
      }
      setOffers([])
    } else {
      void persistOffers(next)
    }
  }

  const stats = useMemo(() => {
    const discounts = offers
      .map((row) => parseNum(String(row.descuento ?? '')))
      .filter((v): v is number => v !== null && v > 0)
    const avg = discounts.length
      ? discounts.reduce((acc, v) => acc + v, 0) / discounts.length
      : null
    const enVenta = offers.reduce((acc, row) => acc + (parseNum(String(row.precioOferta ?? '')) ?? 0), 0)
    return { total: offers.length, avg, enVenta }
  }, [offers])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BadgePercent className="h-6 w-6 text-primary" /> Ofertas y promociones
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Las sugerencias salen de las ventas reales de Â«{dataset ? dataset.fileName : 'tu dataset'}Â»; crealas y quedan guardadas en <span className="font-medium text-foreground">Tus ofertas</span>.
          </p>
        </div>
        {stats.total > 0 && <Badge variant="outline">{full.format(stats.total)} oferta{stats.total > 1 ? 's' : ''} creada{stats.total > 1 ? 's' : ''}</Badge>}
      </div>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3 py-4">
          {[
            ['1. Analizamos tu dataset', 'Detectamos productos, precios y volumen de ventas.'],
            ['2. ElegÃ­s las ofertas', 'Cada sugerencia trae su % de descuento y precio de oferta ya calculados.'],
            ['3. Quedan en Â«Tus ofertasÂ»', 'Se guardan juntas y podÃ©s eliminarlas cuando quieras.'],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-3 items-start">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && notice && <p className="text-sm text-emerald-600">{notice}</p>}

      {dataset && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" /> Ofertas sugeridas
                </CardTitle>
                <p className="text-xs text-muted-foreground">Basadas en las ventas reales del dataset. Dale Â«CrearÂ» a las que quieras aplicar.</p>
              </div>
              {backendOffers.length > 0 && (
                <Button size="sm" variant="secondary" disabled={creatingAll} onClick={() => void createAll()}>
                  {creatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Aplicar todas
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestionLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando el datasetâ€¦
              </div>
            ) : backendOffers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {suggestionError || 'No se pudieron sugerir ofertas con el dataset actual.'}
              </p>
            ) : (
              <>
                {suggestionError && <p className="text-sm text-destructive">{suggestionError}</p>}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRowComp>
                        <TableHead>Producto</TableHead>
                        <TableHead>Rendimiento</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Precio prom.</TableHead>
                        <TableHead className="text-right">Descuento sugerido</TableHead>
                        <TableHead className="text-right">Precio de oferta</TableHead>
                        <TableHead />
                      </TableRowComp>
                    </TableHeader>
                    <TableBody>
                      {backendOffers.slice(0, 12).map((sug) => (
                        <TableRowComp key={sug.producto}>
                          <TableCell>
                            <p className="text-sm font-medium">{sug.producto}</p>
                            <p className="text-[11px] text-muted-foreground max-w-[260px] truncate">{sug.fundamento}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{sug.etiqueta}</Badge></TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{full.format(sug.unidades)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{money.format(sug.precioPromedio)}</TableCell>
                          <TableCell className="text-right"><Badge className="text-[10px]">{sug.descuentoSugerido}%</Badge></TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-primary font-semibold">{money.format(sug.precioOferta)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" disabled={creating === sug.producto} onClick={() => void createSuggestion(sug)}>
                              {creating === sug.producto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              Crear
                            </Button>
                          </TableCell>
                        </TableRowComp>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">AdemÃ¡s, podÃ©s combinar:</span>
                  {promoIdeas(backendOffers).map((idea) => (
                    <Badge key={idea} variant="secondary" className="text-[10px]">{idea}</Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {dataset && backendOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear manualmente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Producto (del dataset)</label>
                <Select value={producto} onValueChange={setProducto}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ElegÃ­ un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {backendOffers.map((sug) => (
                      <SelectItem key={sug.producto} value={sug.producto}>{sug.producto}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descuento (%)</label>
                <Input type="number" min={0} max={100} placeholder="20" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button disabled={manualSaving} onClick={() => void submitManual()}>
                  {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Guardar oferta
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 mt-3">
              <div>
                <label className="text-xs text-muted-foreground">Vigencia: inicio</label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Vigencia: fin</label>
                <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Tus ofertas</CardTitle>
            {stats.total > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[10px]">Descuento prom. {stats.avg !== null ? `${Math.round(stats.avg)}%` : 'â€”'}</Badge>
                <Badge variant="secondary" className="text-[10px]">Total en oferta {money.format(stats.enVenta)}</Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargandoâ€¦
            </div>
          ) : stats.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              TodavÃ­a no creaste ofertas. ElegÃ­ algunas sugeridas arriba y aparecerÃ¡n acÃ¡.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRowComp>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Precio anterior</TableHead>
                    <TableHead className="text-right">Precio de oferta</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead />
                  </TableRowComp>
                </TableHeader>
                <TableBody>
                  {offers.map((row) => {
                    const precioAnterior = parseNum(String(row.precioAnterior ?? ''))
                    const precioOferta = parseNum(String(row.precioOferta ?? ''))
                    const desde = fmtDate(String(row.vigencia_inicio ?? ''))
                    const hasta = fmtDate(String(row.vigencia_fin ?? ''))
                    return (
                      <TableRowComp key={row.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{row.producto}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{formatTipo(String(row.tipo ?? ''))}</Badge></TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{parseNum(String(row.descuento ?? '')) ?? 'â€”'}{parseNum(String(row.descuento ?? '')) !== null ? '%' : ''}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{precioAnterior !== null ? money.format(precioAnterior) : 'â€”'}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-primary font-semibold">{precioOferta !== null ? money.format(precioOferta) : 'â€”'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {desde && hasta ? `${desde} â€“ ${hasta}` : desde ?? hasta ?? 'Sin vigencia'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => deleteOffer(String(row.id))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRowComp>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
