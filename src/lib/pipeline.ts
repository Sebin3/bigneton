import type { Dataset } from './csvAnalyzer'
import { parseDateValue, parseNum } from './csvAnalyzer'
import type { UserTable } from './datasetStore'

/** Qué columna del CSV cumple cada rol del pipeline. Cadena vacía = sin asignar. */
export interface PipelineMap {
  datasetId: string
  stage: string
  amount: string
  owner: string
  closeDate: string
  /** Probabilidad de cierre por etapa, 0-100. */
  probabilities: Record<string, number>
}

export const EMPTY_MAP: PipelineMap = {
  datasetId: '',
  stage: '',
  amount: '',
  owner: '',
  closeDate: '',
  probabilities: {},
}

export interface Opportunity {
  id: string
  stage: string
  amount: number
  owner: string
  closeDate: string | null
  source: 'csv' | 'manual'
  /** Sobrescribe la probabilidad de la etapa cuando se captura a mano. */
  probability?: number
}

export interface StageStat {
  stage: string
  count: number
  amount: number
  probability: number
  weighted: number
}

export interface OwnerStat {
  owner: string
  count: number
  amount: number
  ticket: number
}

export interface PipelineSummary {
  total: number
  amount: number
  ticket: number
  weighted: number
  stages: StageStat[]
  owners: OwnerStat[]
  byMonth: { label: string; value: number; weighted: number }[]
  won: number
  lost: number
  /** Ganadas entre cerradas (ganadas + perdidas); null si nada cerró aún. */
  conversion: number | null
  /** Monto que sigue abierto: ni ganado ni perdido. */
  open: number
}

/* ----------------------------- etapas y orden ---------------------------- */

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS, '').trim()
}

const STAGE_RULES: { keys: string[]; rank: number; probability: number }[] = [
  { keys: ['prospecto', 'lead', 'nuevo', 'inicial'], rank: 1, probability: 10 },
  { keys: ['contacto', 'contactado', 'calificado', 'qualified'], rank: 2, probability: 25 },
  { keys: ['propuesta', 'cotizacion', 'quote', 'demo', 'presentacion'], rank: 3, probability: 50 },
  { keys: ['negociacion', 'negotiation', 'revision'], rank: 4, probability: 70 },
  { keys: ['ganado', 'won', 'cerrado', 'cierre', 'facturado', 'pagado'], rank: 5, probability: 100 },
  { keys: ['perdido', 'lost', 'cancelado', 'rechazado', 'descartado'], rank: 6, probability: 0 },
]

function ruleFor(stage: string) {
  const norm = normalize(stage)
  return STAGE_RULES.find((r) => r.keys.some((k) => norm.includes(k)))
}

/** Probabilidad sugerida a partir del nombre de la etapa. */
export function defaultProbability(stage: string): number {
  return ruleFor(stage)?.probability ?? 40
}

export function isWonStage(stage: string): boolean {
  return ruleFor(stage)?.rank === 5
}

export function isLostStage(stage: string): boolean {
  return ruleFor(stage)?.rank === 6
}

/** Ordena las etapas siguiendo el embudo comercial habitual. */
export function orderStages(stages: string[]): string[] {
  return [...stages].sort((a, b) => {
    const ra = ruleFor(a)?.rank ?? 4.5
    const rb = ruleFor(b)?.rank ?? 4.5
    if (ra !== rb) return ra - rb
    return a.localeCompare(b, 'es')
  })
}

/* --------------------------- construir el pipeline ----------------------- */

const NO_STAGE = 'Sin etapa'
const NO_OWNER = 'Sin responsable'

export function opportunitiesFromDataset(
  dataset: Dataset | null,
  map: PipelineMap,
): Opportunity[] {
  if (!dataset) return []
  const out: Opportunity[] = []
  dataset.rows.forEach((row, i) => {
    const amount = map.amount ? (parseNum(row[map.amount] ?? '') ?? 0) : 0
    const stage = map.stage ? (row[map.stage] ?? '').trim() || NO_STAGE : NO_STAGE
    const owner = map.owner ? (row[map.owner] ?? '').trim() || NO_OWNER : NO_OWNER
    const date = map.closeDate ? parseDateValue(row[map.closeDate] ?? '') : null
    out.push({
      id: `csv-${i}`,
      stage,
      amount,
      owner,
      closeDate: date ? date.toISOString() : null,
      source: 'csv',
    })
  })
  return out
}

export const MANUAL_TABLE_ID = 'pipeline-oportunidades'

export function opportunitiesFromTable(table: UserTable | null): Opportunity[] {
  if (!table) return []
  return table.rows.map((row, i) => {
    const prob = parseNum(row.probabilidad ?? '')
    const date = parseDateValue(row.cierre ?? '')
    return {
      id: row.id || `manual-${i}`,
      stage: (row.etapa ?? '').trim() || NO_STAGE,
      amount: parseNum(row.monto ?? '') ?? 0,
      owner: (row.responsable ?? '').trim() || NO_OWNER,
      closeDate: date ? date.toISOString() : null,
      source: 'manual' as const,
      probability: prob === null ? undefined : prob,
    }
  })
}

function monthKey(iso: string) {
  const d = new Date(iso)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  return {
    key: `${d.getFullYear()}-${m}`,
    label: d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
  }
}

/** Calcula embudo, ticket promedio, proyección ponderada y desempeño. */
export function summarize(
  opportunities: Opportunity[],
  probabilities: Record<string, number>,
): PipelineSummary {
  const stageMap = new Map<string, { count: number; amount: number }>()
  const ownerMap = new Map<string, { count: number; amount: number }>()
  const monthMap = new Map<
    string,
    { label: string; value: number; weighted: number }
  >()

  let amount = 0
  let weighted = 0
  let won = 0
  let lost = 0
  let open = 0

  for (const opp of opportunities) {
    amount += opp.amount

    const stage = stageMap.get(opp.stage)
    if (stage) {
      stage.count += 1
      stage.amount += opp.amount
    } else {
      stageMap.set(opp.stage, { count: 1, amount: opp.amount })
    }

    const owner = ownerMap.get(opp.owner)
    if (owner) {
      owner.count += 1
      owner.amount += opp.amount
    } else {
      ownerMap.set(opp.owner, { count: 1, amount: opp.amount })
    }

    const prob =
      opp.probability ??
      probabilities[opp.stage] ??
      defaultProbability(opp.stage)
    const oppWeighted = (opp.amount * prob) / 100
    weighted += oppWeighted

    const isWon = isWonStage(opp.stage)
    const isLost = isLostStage(opp.stage)
    if (isWon) won += 1
    if (isLost) lost += 1
    if (!isWon && !isLost) open += opp.amount

    if (opp.closeDate) {
      const { key, label } = monthKey(opp.closeDate)
      const month = monthMap.get(key)
      if (month) {
        month.value += opp.amount
        month.weighted += oppWeighted
      } else {
        monthMap.set(key, { label, value: opp.amount, weighted: oppWeighted })
      }
    }
  }

  const stages: StageStat[] = orderStages([...stageMap.keys()]).map((stage) => {
    const s = stageMap.get(stage) ?? { count: 0, amount: 0 }
    const probability = probabilities[stage] ?? defaultProbability(stage)
    return {
      stage,
      count: s.count,
      amount: s.amount,
      probability,
      weighted: (s.amount * probability) / 100,
    }
  })

  const owners: OwnerStat[] = [...ownerMap.entries()]
    .map(([owner, o]) => ({
      owner,
      count: o.count,
      amount: o.amount,
      ticket: o.count > 0 ? o.amount / o.count : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const byMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)

  const total = opportunities.length
  const closed = won + lost
  return {
    total,
    amount,
    ticket: total > 0 ? amount / total : 0,
    weighted,
    stages,
    owners,
    byMonth,
    won,
    lost,
    conversion: closed > 0 ? won / closed : null,
    open,
  }
}
