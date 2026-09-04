import type { FieldDef, TableGroup, UserTable } from './datasetStore'
import { cellDate, cellNumber, cellNumberOrNull } from './userTables'

/* ------------------------------ plantillas ------------------------------- */

const CANALES = [
  'Tienda física',
  'E-commerce',
  'Marketplace',
  'Redes sociales',
  'Email',
  'Vendedor',
]

/** Campos de una tabla de ofertas o promociones. */
export const OFFER_FIELDS: FieldDef[] = [
  { key: 'nombre', label: 'Oferta', kind: 'text', locked: true },
  {
    key: 'tipo',
    label: 'Tipo',
    kind: 'select',
    options: ['Porcentaje', 'Monto fijo', '2x1', 'Envío gratis', 'Paquete'],
    locked: true,
  },
  { key: 'descuento', label: 'Descuento', kind: 'percent', locked: true },
  { key: 'canal', label: 'Canal', kind: 'select', options: CANALES, locked: true },
  { key: 'inicio', label: 'Inicio', kind: 'date', locked: true },
  { key: 'fin', label: 'Fin', kind: 'date', locked: true },
  { key: 'inversion', label: 'Inversión', kind: 'money', locked: true },
  { key: 'ingreso', label: 'Ingreso atribuido', kind: 'money', locked: true },
  { key: 'redenciones', label: 'Redenciones', kind: 'number', locked: true },
]

/** Campos de una tabla de campañas comerciales. */
export const CAMPAIGN_FIELDS: FieldDef[] = [
  { key: 'nombre', label: 'Campaña', kind: 'text', locked: true },
  {
    key: 'objetivo',
    label: 'Objetivo',
    kind: 'select',
    options: ['Adquisición', 'Retención', 'Recompra', 'Liquidación', 'Lanzamiento'],
    locked: true,
  },
  { key: 'canal', label: 'Canal', kind: 'select', options: CANALES, locked: true },
  { key: 'inicio', label: 'Inicio', kind: 'date', locked: true },
  { key: 'fin', label: 'Fin', kind: 'date', locked: true },
  { key: 'inversion', label: 'Inversión', kind: 'money', locked: true },
  { key: 'meta', label: 'Meta de ingreso', kind: 'money', locked: true },
  { key: 'ingreso', label: 'Ingreso atribuido', kind: 'money', locked: true },
  { key: 'alcance', label: 'Alcance', kind: 'number', locked: true },
  { key: 'conversiones', label: 'Conversiones', kind: 'number', locked: true },
]

const BLANK_FIELDS: FieldDef[] = [
  { key: 'nombre', label: 'Nombre', kind: 'text', locked: true },
]

export interface TableTemplate {
  id: 'ofertas' | 'campanas' | 'libre'
  name: string
  label: string
  description: string
  group: TableGroup
  icon: string
  fields: FieldDef[]
}

export const TEMPLATES: TableTemplate[] = [
  {
    id: 'ofertas',
    name: 'Ofertas y promociones',
    label: 'Ofertas',
    description: 'Descuentos, vigencias, inversión e ingreso atribuido',
    group: 'ofertas',
    icon: 'percent',
    fields: OFFER_FIELDS,
  },
  {
    id: 'campanas',
    name: 'Campañas comerciales',
    label: 'Campañas',
    description: 'Objetivo, alcance, conversiones y meta de ingreso',
    group: 'campanas',
    icon: 'megaphone',
    fields: CAMPAIGN_FIELDS,
  },
  {
    id: 'libre',
    name: 'Tabla nueva',
    label: 'En blanco',
    description: 'Empieza con una columna y agrega las que necesites',
    group: 'libre',
    icon: 'table',
    fields: BLANK_FIELDS,
  },
]

/** Las tablas de estos grupos alimentan la analítica de ofertas. */
export const OFFER_GROUPS: TableGroup[] = ['ofertas', 'campanas']

export function isOfferTable(table: UserTable): boolean {
  return OFFER_GROUPS.includes(table.group ?? 'libre')
}

/* -------------------------------- registros ------------------------------ */

export type OfferStatus = 'activa' | 'programada' | 'vencida' | 'sin-fecha'

export const STATUS_LABEL: Record<OfferStatus, string> = {
  activa: 'Activa',
  programada: 'Programada',
  vencida: 'Vencida',
  'sin-fecha': 'Sin vigencia',
}

export interface OfferRecord {
  id: string
  tableId: string
  tableName: string
  group: TableGroup
  name: string
  type: string
  channel: string
  discount: number | null
  start: Date | null
  end: Date | null
  status: OfferStatus
  investment: number
  revenue: number
  goal: number | null
  redemptions: number
  reach: number
  conversions: number
  /** Retorno sobre la inversión; null cuando no se invirtió nada. */
  roi: number | null
  /** Duración de la vigencia en días; null sin fechas completas. */
  days: number | null
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Estado de la vigencia comparando el rango con la fecha de referencia. */
export function statusOf(
  start: Date | null,
  end: Date | null,
  today = new Date(),
): OfferStatus {
  if (!start && !end) return 'sin-fecha'
  const now = startOfDay(today)
  if (start && startOfDay(start) > now) return 'programada'
  if (end && startOfDay(end) < now) return 'vencida'
  return 'activa'
}

const NO_CHANNEL = 'Sin canal'
const NO_TYPE = 'Sin tipo'

/** Convierte las filas de una tabla en registros comparables de oferta. */
export function offerRecords(
  tables: UserTable[],
  today = new Date(),
): OfferRecord[] {
  const out: OfferRecord[] = []
  for (const table of tables) {
    if (!isOfferTable(table)) continue
    const group = table.group ?? 'libre'
    for (const row of table.rows) {
      const start = cellDate(row, 'inicio')
      const end = cellDate(row, 'fin')
      const investment = cellNumber(row, 'inversion')
      const revenue = cellNumber(row, 'ingreso')
      out.push({
        id: `${table.id}:${row.id}`,
        tableId: table.id,
        tableName: table.name,
        group,
        name: (row.nombre ?? '').trim() || 'Sin nombre',
        type: (row.tipo ?? row.objetivo ?? '').trim() || NO_TYPE,
        channel: (row.canal ?? '').trim() || NO_CHANNEL,
        discount: cellNumberOrNull(row, 'descuento'),
        start,
        end,
        status: statusOf(start, end, today),
        investment,
        revenue,
        goal: cellNumberOrNull(row, 'meta'),
        redemptions: cellNumber(row, 'redenciones'),
        reach: cellNumber(row, 'alcance'),
        conversions: cellNumber(row, 'conversiones'),
        roi: investment > 0 ? (revenue - investment) / investment : null,
        days:
          start && end
            ? Math.max(1, Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1)
            : null,
      })
    }
  }
  return out
}

/* -------------------------------- resumen -------------------------------- */

export interface ChannelStat {
  channel: string
  count: number
  investment: number
  revenue: number
  redemptions: number
  roi: number | null
}

export interface OffersSummary {
  records: OfferRecord[]
  total: number
  active: number
  scheduled: number
  expired: number
  investment: number
  revenue: number
  margin: number
  roi: number | null
  avgDiscount: number | null
  redemptions: number
  ticket: number | null
  conversionRate: number | null
  goal: number
  goalCoverage: number | null
  channels: ChannelStat[]
  byMonth: { label: string; inversion: number; ingreso: number }[]
  topRecords: OfferRecord[]
}

const MAX_TOP = 8

function monthKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return {
    key: `${date.getFullYear()}-${month}`,
    label: date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
  }
}

/** Calcula inversión, ingreso, ROI, descuento promedio y desglose por canal. */
export function summarizeOffers(
  tables: UserTable[],
  today = new Date(),
): OffersSummary {
  const records = offerRecords(tables, today)

  const channelMap = new Map<string, ChannelStat>()
  const monthMap = new Map<
    string,
    { label: string; inversion: number; ingreso: number }
  >()

  let investment = 0
  let revenue = 0
  let redemptions = 0
  let conversions = 0
  let reach = 0
  let goal = 0
  let active = 0
  let scheduled = 0
  let expired = 0
  let discountWeight = 0
  let discountSum = 0

  for (const rec of records) {
    investment += rec.investment
    revenue += rec.revenue
    redemptions += rec.redemptions
    conversions += rec.conversions
    reach += rec.reach
    goal += rec.goal ?? 0

    if (rec.status === 'activa') active += 1
    else if (rec.status === 'programada') scheduled += 1
    else if (rec.status === 'vencida') expired += 1

    if (rec.discount !== null) {
      // Pondera por ingreso para que las ofertas grandes pesen más.
      const weight = rec.revenue > 0 ? rec.revenue : 1
      discountSum += rec.discount * weight
      discountWeight += weight
    }

    const channel = channelMap.get(rec.channel)
    if (channel) {
      channel.count += 1
      channel.investment += rec.investment
      channel.revenue += rec.revenue
      channel.redemptions += rec.redemptions
    } else {
      channelMap.set(rec.channel, {
        channel: rec.channel,
        count: 1,
        investment: rec.investment,
        revenue: rec.revenue,
        redemptions: rec.redemptions,
        roi: null,
      })
    }

    const anchor = rec.start ?? rec.end
    if (anchor) {
      const { key, label } = monthKey(anchor)
      const month = monthMap.get(key)
      if (month) {
        month.inversion += rec.investment
        month.ingreso += rec.revenue
      } else {
        monthMap.set(key, {
          label,
          inversion: rec.investment,
          ingreso: rec.revenue,
        })
      }
    }
  }

  const channels = [...channelMap.values()]
    .map((c) => ({
      ...c,
      roi: c.investment > 0 ? (c.revenue - c.investment) / c.investment : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const byMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value)

  const topRecords = [...records]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, MAX_TOP)

  return {
    records,
    total: records.length,
    active,
    scheduled,
    expired,
    investment,
    revenue,
    margin: revenue - investment,
    roi: investment > 0 ? (revenue - investment) / investment : null,
    avgDiscount: discountWeight > 0 ? discountSum / discountWeight : null,
    redemptions,
    ticket: redemptions > 0 ? revenue / redemptions : null,
    conversionRate: reach > 0 ? conversions / reach : null,
    goal,
    goalCoverage: goal > 0 ? revenue / goal : null,
    channels,
    byMonth,
    topRecords,
  }
}

/* ------------------------------- vigencias -------------------------------- */

export interface TimelineBar {
  record: OfferRecord
  /** Porcentaje desde el inicio de la ventana total. */
  offset: number
  width: number
}

export interface OfferTimeline {
  bars: TimelineBar[]
  from: Date
  to: Date
  /** Posición de hoy en la ventana, o null si queda fuera. */
  todayOffset: number | null
}

const MAX_BARS = 14
/** Ancho mínimo para que una vigencia de pocos días siga siendo visible. */
const MIN_BAR_WIDTH = 2.5

/** Arma la barra de vigencia de cada oferta sobre una ventana común. */
export function buildTimeline(
  records: OfferRecord[],
  today = new Date(),
): OfferTimeline | null {
  const dated = records
    .filter((r) => r.start && r.end)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0))
    .slice(0, MAX_BARS)
  if (dated.length === 0) return null

  const starts = dated.map((r) => startOfDay(r.start as Date))
  const ends = dated.map((r) => startOfDay(r.end as Date))
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  const span = Math.max(max - min, DAY_MS)

  const bars = dated.map((record, i) => {
    const width = Math.min(
      100,
      Math.max(((ends[i] - starts[i]) / span) * 100, MIN_BAR_WIDTH),
    )
    // El ancho mínimo puede empujar la barra fuera del carril: se recorta.
    const offset = Math.min(((starts[i] - min) / span) * 100, 100 - width)
    return { record, offset, width }
  })

  const now = startOfDay(today)
  return {
    bars,
    from: new Date(min),
    to: new Date(max),
    todayOffset:
      now >= min && now <= max ? ((now - min) / span) * 100 : null,
  }
}
