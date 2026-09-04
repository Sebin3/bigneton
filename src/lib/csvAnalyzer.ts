import Papa from 'papaparse'

export type ColumnType = 'numeric' | 'date' | 'categorical' | 'text' | 'boolean'

export interface ColumnStats {
  min?: number
  max?: number
  mean?: number
  median?: number
  stddev?: number
  sum?: number
  p25?: number
  p75?: number
  zeros?: number
  negatives?: number
  minDate?: string
  maxDate?: string
  top?: { label: string; count: number }[]
}

/** Metadatos de lectura del archivo: cómo se interpretó el CSV. */
export interface ParseMeta {
  delimiter: string
  linebreak: string
  bom: boolean
  autoDetected: boolean
  skippedErrors: number
}

export interface ColumnProfile {
  name: string
  type: ColumnType
  missing: number
  unique: number | null
  stats: ColumnStats
}

export interface DatasetRoles {
  date?: string
  revenue?: string
  category?: string
}

export interface DatasetInsights {
  timeline: { label: string; value: number }[] | null
  timelineTitle: string
  typeDistribution: { name: string; value: number }[]
  missingByColumn: { name: string; missing: number }[]
  histogram: { bin: string; count: number }[] | null
  histogramColumn: string
  topCategories: { name: string; value: number }[] | null
  topCategoriesTitle: string
}

export interface Dataset {
  id: string
  fileName: string
  sizeBytes: number
  uploadedAt: string
  processMs: number
  rowCount: number
  columnCount: number
  totalCells: number
  missingCells: number
  duplicateRows: number
  completeness: number
  headers: string[]
  columns: ColumnProfile[]
  rows: Record<string, string>[]
  roles: DatasetRoles
  insights: DatasetInsights
  parseMeta?: ParseMeta
}

export interface HistoryEntry {
  id: string
  fileName: string
  sizeBytes: number
  rowCount: number
  columnCount: number
  uploadedAt: string
  processMs: number
  stored?: boolean
  duplicateRows?: number
  delimiter?: string
}

export type ProcessPhase =
  | 'idle'
  | 'validating'
  | 'reading'
  | 'analyzing'
  | 'finalizing'
  | 'done'

type Row = Record<string, string>

const MAX_ROWS = 200_000

const NUMERIC_RE = /^-?\d+(?:[.,]\d+)?$/

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/,
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  /^\d{1,2}-\d{1,2}-\d{4}$/,
]

const BOOLEAN_VALUES = new Set([
  'true',
  'false',
  'verdadero',
  'falso',
  'si',
  'sí',
  'no',
  'yes',
])

const DATE_KEYS = ['fecha', 'date', 'dia', 'dia_', 'created']
const REVENUE_KEYS = ['total', 'monto', 'importe', 'ingreso', 'venta', 'revenue', 'amount']
const CATEGORY_KEYS = ['categoria', 'category', 'rubro', 'linea', 'departamento']

const TYPE_SAMPLE_SIZE = 500
const NUMERIC_THRESHOLD = 0.9
const DATE_THRESHOLD = 0.8
const BOOLEAN_THRESHOLD = 0.95
const CATEGORICAL_MIN_UNIQUE = 12
const CATEGORICAL_MAX_UNIQUE = 50
const CATEGORICAL_MAX_ROW_RATIO = 0.05
const MAX_TIMELINE_POINTS = 24
const MAX_TOP_CATEGORIES = 7
const TOP_VALUES_LIMIT = 5
const MISSING_COLUMNS_LIMIT = 10
const HISTOGRAM_BINS = 10

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Quita la marca de orden de bytes (BOM) que Excel añade al guardar CSV. */
const BOM_CHAR = String.fromCharCode(0xfeff)

function stripBom(text: string): string {
  return text.startsWith(BOM_CHAR) ? text.slice(1) : text
}

/** Convierte una celda a número aceptando coma o punto decimal. */
export function parseNum(value: string): number | null {
  const cleaned = value.trim()
  if (!NUMERIC_RE.test(cleaned)) return null
  const n = Number(cleaned.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Cuantil por interpolación lineal sobre un arreglo ya ordenado. */
function quantileOf(sorted: number[], q: number): number | undefined {
  if (sorted.length === 0) return undefined
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function looksLikeDate(value: string): boolean {
  const v = value.trim()
  if (!DATE_PATTERNS.some((re) => re.test(v))) return false
  return parseDateValue(v) !== null
}

/** Interpreta una celda como fecha (ISO, dd/mm/yyyy o dd-mm-yyyy). */
export function parseDateValue(value: string): Date | null {
  const v = value.trim()
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const dmY = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmY) {
    const d = new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function pickHeader(headers: string[], keys: string[]): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalize(h) }))
  const candidates = keys.map((k) => normalize(k))
  for (const cand of candidates) {
    const exact = normalized.find((h) => h.norm === cand)
    if (exact) return exact.raw
  }
  for (const cand of candidates) {
    const partial = normalized.find(
      (h) =>
        h.norm.includes(cand) &&
        !h.norm.includes('unitario') &&
        !h.norm.includes('unit'),
    )
    if (partial) return partial.raw
  }
  return undefined
}

function detectTypes(
  headers: string[],
  rows: Row[],
): Map<string, ColumnType> {
  const sampleSize = Math.min(rows.length, TYPE_SAMPLE_SIZE)
  const map = new Map<string, ColumnType>()

  for (const header of headers) {
    let seen = 0
    let numHits = 0
    let dateHits = 0
    let boolHits = 0
    const uniques = new Set<string>()

    for (let i = 0; i < rows.length && seen < sampleSize; i++) {
      const raw = rows[i][header]
      const value = (raw ?? '').trim()
      if (!value) continue
      seen++
      uniques.add(value.toLowerCase())
      if (parseNum(value) !== null) numHits++
      if (looksLikeDate(value)) dateHits++
      if (BOOLEAN_VALUES.has(value.toLowerCase())) boolHits++
    }

    if (seen === 0) {
      map.set(header, 'text')
      continue
    }

    const distinctFull = new Set<string>()
    for (const row of rows) {
      const value = (row[header] ?? '').trim()
      if (value) distinctFull.add(value.toLowerCase())
    }

    if (numHits / seen >= NUMERIC_THRESHOLD) map.set(header, 'numeric')
    else if (dateHits / seen >= DATE_THRESHOLD) map.set(header, 'date')
    else if (boolHits / seen >= BOOLEAN_THRESHOLD) map.set(header, 'boolean')
    else if (
      distinctFull.size <=
      Math.min(
        Math.max(CATEGORICAL_MIN_UNIQUE, Math.round(rows.length * CATEGORICAL_MAX_ROW_RATIO)),
        CATEGORICAL_MAX_UNIQUE,
      )
    ) {
      map.set(header, 'categorical')
    } else {
      map.set(header, 'text')
    }
  }

  return map
}

function profileColumn(
  header: string,
  type: ColumnType,
  rows: Row[],
): ColumnProfile {
  let missing = 0
  const numbers: number[] = []
  const dates: Date[] = []
  const freq = new Map<string, number>()
  const uniques = new Set<string>()

  for (const row of rows) {
    const value = (row[header] ?? '').trim()
    if (!value) {
      missing++
      continue
    }
    uniques.add(value.toLowerCase())
    if (type === 'numeric') {
      const n = parseNum(value)
      if (n !== null) numbers.push(n)
    } else if (type === 'date') {
      const d = parseDateValue(value)
      if (d) dates.push(d)
    } else if (type === 'categorical' || type === 'boolean') {
      freq.set(value, (freq.get(value) ?? 0) + 1)
    }
  }

  const stats: ColumnStats = {}
  if (type === 'numeric' && numbers.length > 0) {
    const sum = numbers.reduce((a, b) => a + b, 0)
    const mean = sum / numbers.length
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    const variance =
      numbers.reduce((acc, n) => acc + (n - mean) ** 2, 0) / numbers.length
    stats.min = sorted[0]
    stats.max = sorted[sorted.length - 1]
    stats.mean = mean
    stats.median = median
    stats.stddev = Math.sqrt(variance)
    stats.sum = sum
    stats.p25 = quantileOf(sorted, 0.25)
    stats.p75 = quantileOf(sorted, 0.75)
    stats.zeros = numbers.reduce((acc, n) => acc + (n === 0 ? 1 : 0), 0)
    stats.negatives = numbers.reduce((acc, n) => acc + (n < 0 ? 1 : 0), 0)
  } else if (type === 'date' && dates.length > 0) {
    const times = dates.map((d) => d.getTime())
    stats.minDate = new Date(Math.min(...times)).toISOString()
    stats.maxDate = new Date(Math.max(...times)).toISOString()
  } else if ((type === 'categorical' || type === 'boolean') && freq.size > 0) {
    stats.top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_VALUES_LIMIT)
      .map(([label, count]) => ({ label, count }))
  }

  return {
    name: header,
    type,
    missing,
    unique: type === 'numeric' ? null : uniques.size || null,
    stats,
  }
}

function buildTimeline(
  rows: Row[],
  dateCol: string | undefined,
  valueCol: ColumnProfile | undefined,
): { points: { label: string; value: number }[] | null; title: string } {
  if (!dateCol) return { points: null, title: '' }
  const buckets = new Map<string, number>()

  for (const row of rows) {
    const raw = (row[dateCol] ?? '').trim()
    const date = parseDateValue(raw)
    if (!date) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const contribution =
      valueCol && valueCol.type === 'numeric'
        ? (parseNum((row[valueCol.name] ?? '').trim()) ?? 0)
        : 1
    buckets.set(key, (buckets.get(key) ?? 0) + contribution)
  }

  if (buckets.size === 0) return { points: null, title: '' }

  const points = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-MAX_TIMELINE_POINTS)
    .map(([key, value]) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Date(y, m - 1, 1)
        .toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
        .replace('.', '')
      return { label: label.charAt(0).toUpperCase() + label.slice(1), value }
    })

  const title = valueCol && valueCol.type === 'numeric'
    ? `Ingresos por mes (${dateCol})`
    : `Registros por mes (${dateCol})`

  return { points, title }
}

function histogramFrom(rows: Row[], profile: ColumnProfile | undefined) {
  if (!profile || profile.stats.min === undefined || profile.stats.max === undefined) {
    return null
  }
  const min = profile.stats.min
  const max = profile.stats.max
  if (min === max) return [{ bin: String(min), count: rows.length }]
  const width = (max - min) / HISTOGRAM_BINS
  const counts = Array<number>(HISTOGRAM_BINS).fill(0)

  for (const row of rows) {
    const n = parseNum((row[profile.name] ?? '').trim())
    if (n === null) continue
    const idx = Math.min(Math.floor((n - min) / width), HISTOGRAM_BINS - 1)
    counts[idx]++
  }

  return counts.map((count, i) => {
    const lo = Math.round(min + i * width)
    const hi = Math.round(min + (i + 1) * width)
    return { bin: `${lo}–${hi}`, count }
  })
}

function buildTopCategories(
  rows: Row[],
  catProfile: ColumnProfile | undefined,
  revenueProfile: ColumnProfile | undefined,
): { points: { name: string; value: number }[] | null; title: string } {
  if (!catProfile) return { points: null, title: '' }

  if (revenueProfile && revenueProfile.stats.sum !== undefined) {
    const sums = new Map<string, number>()
    for (const row of rows) {
      const key = (row[catProfile.name] ?? '').trim()
      if (!key) continue
      const n = parseNum((row[revenueProfile.name] ?? '').trim())
      if (n === null) continue
      sums.set(key, (sums.get(key) ?? 0) + n)
    }
    const points = [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOP_CATEGORIES)
      .map(([name, value]) => ({ name, value }))
    return { points: points.length ? points : null, title: 'Ingresos por categoría' }
  }

  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = (row[catProfile.name] ?? '').trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const points = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_CATEGORIES)
    .map(([name, value]) => ({ name, value }))
  return { points: points.length ? points : null, title: 'Registros por categoría' }
}

function resolveProfiles(columns: ColumnProfile[], roles: DatasetRoles) {
  const revenueProfile = roles.revenue
    ? columns.find((c) => c.name === roles.revenue)
    : undefined
  const categoryProfile = roles.category
    ? columns.find((c) => c.name === roles.category)
    : columns.find((c) => c.type === 'categorical')
  const dateCol = roles.date ?? columns.find((c) => c.type === 'date')?.name
  return { revenueProfile, categoryProfile, dateCol }
}

function computeInsights(
  rows: Row[],
  columns: ColumnProfile[],
  roles: DatasetRoles,
): DatasetInsights {
  const { revenueProfile, categoryProfile, dateCol } = resolveProfiles(columns, roles)

  const timelineResult = buildTimeline(rows, dateCol, revenueProfile)

  const histogramSource =
    revenueProfile && revenueProfile.type === 'numeric'
      ? revenueProfile
      : columns.find((c) => c.type === 'numeric')

  const categoriesResult = buildTopCategories(rows, categoryProfile, revenueProfile)

  const typeCounts = new Map<ColumnType, number>()
  for (const col of columns) typeCounts.set(col.type, (typeCounts.get(col.type) ?? 0) + 1)

  return {
    timeline: timelineResult.points,
    timelineTitle: timelineResult.title,
    typeDistribution: [...typeCounts.entries()].map(([name, value]) => ({
      name: TYPE_LABELS[name],
      value,
    })),
    missingByColumn: columns
      .filter((c) => c.missing > 0)
      .sort((a, b) => b.missing - a.missing)
      .slice(0, MISSING_COLUMNS_LIMIT)
      .map((c) => ({ name: c.name, missing: c.missing })),
    histogram: histogramFrom(rows, histogramSource),
    histogramColumn: histogramSource?.name ?? '',
    topCategories: categoriesResult.points,
    topCategoriesTitle: categoriesResult.title,
  }
}

function countDuplicates(rows: Row[], headers: string[]): number {
  const fingerprints = new Set<string>()
  let duplicates = 0
  for (const row of rows) {
    const fp = headers.map((h) => row[h] ?? '').join('\u0001')
    if (fingerprints.has(fp)) duplicates++
    else fingerprints.add(fp)
  }
  return duplicates
}

/** Separadores que el motor intenta adivinar, en orden de preferencia. */
export const DELIMITERS_TO_GUESS = [',', ';', '\t', '|']

export const DELIMITER_LABELS: Record<string, string> = {
  ',': 'Coma  ,',
  ';': 'Punto y coma  ;',
  '\t': 'Tabulador  ⇥',
  '|': 'Pleca  |',
}

export function delimiterLabel(delimiter: string): string {
  return DELIMITER_LABELS[delimiter] ?? `«${delimiter}»`
}

export interface AnalyzeOptions {
  /** Fuerza un separador en lugar de dejar que el motor lo detecte. */
  delimiter?: string
}

export async function analyzeCsvFile(
  file: File,
  onPhase?: (phase: ProcessPhase) => void,
  options: AnalyzeOptions = {},
): Promise<Dataset> {
  const started = performance.now()

  onPhase?.('validating')
  const isCsv =
    file.name.toLowerCase().endsWith('.csv') ||
    file.name.toLowerCase().endsWith('.tsv') ||
    file.name.toLowerCase().endsWith('.txt') ||
    file.type === 'text/csv'
  if (!isCsv) {
    throw new Error('El archivo debe ser .csv, .tsv o .txt para poder procesarse.')
  }
  await sleep(180)

  onPhase?.('reading')
  const forced = options.delimiter
  const parsed = await new Promise<Papa.ParseResult<Row>>(
    (resolve, reject) => {
      Papa.parse<Row>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        // Sin `delimiter`, papaparse adivina entre `delimitersToGuess`.
        delimiter: forced ?? '',
        delimitersToGuess: DELIMITERS_TO_GUESS,
        transformHeader: (h) => stripBom(h).trim(),
        complete: resolve,
        error: (err) => reject(new Error(`No se pudo leer el CSV: ${err.message}`)),
      })
    },
  )

  const headers = (parsed.meta.fields ?? []).filter((h) => h && h.trim() !== '')
  const rows = parsed.data.filter(
    (row) => row && Object.values(row).some((v) => (v ?? '').toString().trim() !== ''),
  )

  const parseMeta: ParseMeta = {
    delimiter: parsed.meta.delimiter || forced || ',',
    linebreak: parsed.meta.linebreak === '\r\n' ? 'CRLF' : 'LF',
    bom: Boolean((parsed.meta as { bom?: boolean }).bom),
    autoDetected: !forced,
    skippedErrors: parsed.errors?.length ?? 0,
  }

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('El archivo no contiene filas ni encabezados legibles.')
  }
  if (headers.length === 1 && rows.length > 1) {
    throw new Error(
      `Solo se detectó 1 columna con el separador «${parseMeta.delimiter}». Elige el separador correcto e inténtalo de nuevo.`,
    )
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(
      `El archivo supera el límite de ${MAX_ROWS.toLocaleString('es-MX')} filas por proceso.`,
    )
  }
  await sleep(220)

  onPhase?.('analyzing')
  await sleep(200)

  const types = detectTypes(headers, rows)
  const columns = headers.map((h) => profileColumn(h, types.get(h) ?? 'text', rows))

  let missingCells = 0
  for (const col of columns) missingCells += col.missing
  const totalCells = headers.length * rows.length

  const duplicateRows = countDuplicates(rows, headers)

  const roles: DatasetRoles = {
    date: pickHeader(headers, DATE_KEYS) ?? columns.find((c) => c.type === 'date')?.name,
    revenue:
      pickHeader(headers, REVENUE_KEYS) ??
      columns.find((c) => c.type === 'numeric' && /total|monto|importe|venta|ingreso/.test(normalize(c.name)))?.name,
    category: pickHeader(headers, CATEGORY_KEYS),
  }

  const insights = computeInsights(rows, columns, roles)

  onPhase?.('finalizing')
  await sleep(180)

  const dataset: Dataset = {
    id: makeId(),
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    processMs: performance.now() - started,
    rowCount: rows.length,
    columnCount: headers.length,
    totalCells,
    missingCells,
    duplicateRows,
    completeness: totalCells > 0 ? (1 - missingCells / totalCells) * 100 : 100,
    headers,
    columns,
    rows,
    roles,
    insights,
    parseMeta,
  }

  onPhase?.('done')
  return dataset
}

export const TYPE_LABELS: Record<ColumnType, string> = {
  numeric: 'Numérico',
  date: 'Fecha',
  categorical: 'Categórico',
  text: 'Texto',
  boolean: 'Booleano',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`
}

export interface CleanOptions {
  removeDuplicates: boolean
  fillNumeric: boolean
  fillCategorical: boolean
}

export interface CleanReport {
  removedDuplicates: number
  filledCells: number
  rowsBefore: number
  rowsAfter: number
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function modeOf(rows: Row[], header: string): string | null {
  const freq = new Map<string, number>()
  for (const row of rows) {
    const value = (row[header] ?? '').trim()
    if (!value) continue
    freq.set(value, (freq.get(value) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = -1
  for (const [value, count] of freq) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

export async function cleanDataset(
  source: Dataset,
  options: CleanOptions,
): Promise<{ dataset: Dataset; report: CleanReport }> {
  const started = performance.now()
  await sleep(400)

  let rows: Row[] = [...source.rows]
  let removedDuplicates = 0

  if (options.removeDuplicates && source.duplicateRows > 0) {
    const seen = new Set<string>()
    const kept: Row[] = []
    for (const row of rows) {
      const fp = source.headers.map((h) => row[h] ?? '').join('\u0001')
      if (seen.has(fp)) continue
      seen.add(fp)
      kept.push(row)
    }
    removedDuplicates = rows.length - kept.length
    rows = kept
  }

  let filledCells = 0

  for (const col of source.columns) {
    const isNumeric = col.type === 'numeric'
    const shouldFill =
      isNumeric ? options.fillNumeric : options.fillCategorical
    if (!shouldFill) continue

    let fillValue: string | null
    if (isNumeric) {
      const numbers: number[] = []
      for (const row of rows) {
        const n = parseNum((row[col.name] ?? '').trim())
        if (n !== null) numbers.push(n)
      }
      const median = medianOf(numbers)
      fillValue = median === null ? null : String(Math.round(median * 100) / 100)
    } else {
      fillValue = modeOf(rows, col.name) ?? 'Desconocido'
    }
    if (!fillValue) continue

    for (const row of rows) {
      const current = row[col.name]
      if (current !== undefined && String(current).trim() !== '') continue
      row[col.name] = fillValue
      filledCells++
    }
  }

  await sleep(350)

  const typeByName = new Map(source.columns.map((c) => [c.name, c.type]))
  const columns = source.headers.map((h) =>
    profileColumn(h, typeByName.get(h) ?? 'text', rows),
  )

  let missingCells = 0
  for (const col of columns) missingCells += col.missing
  const totalCells = source.headers.length * rows.length

  const insights = computeInsights(rows, columns, source.roles)

  const baseName = source.fileName.replace(/\.csv$/i, '')
  const dataset: Dataset = {
    id: makeId(),
    fileName: `${baseName} (limpio).csv`,
    sizeBytes: Math.max(
      1,
      Math.round(source.sizeBytes * (rows.length / Math.max(source.rowCount, 1))),
    ),
    uploadedAt: new Date().toISOString(),
    processMs: performance.now() - started,
    rowCount: rows.length,
    columnCount: source.columnCount,
    totalCells,
    missingCells,
    duplicateRows: countDuplicates(rows, source.headers),
    completeness: totalCells > 0 ? (1 - missingCells / totalCells) * 100 : 100,
    headers: [...source.headers],
    columns,
    rows,
    roles: { ...source.roles },
    insights,
    parseMeta: source.parseMeta,
  }

  return {
    dataset,
    report: {
      removedDuplicates,
      filledCells,
      rowsBefore: source.rowCount,
      rowsAfter: rows.length,
    },
  }
}
