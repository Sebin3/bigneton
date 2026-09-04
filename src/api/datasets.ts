import apiRequest from './client'
import type { Dataset, HistoryEntry } from '../lib/csvAnalyzer'

/** Registro tal como lo devuelve la API (nombres camelCase). */
export interface BackendDataset {
  id: string
  fileName: string
  file?: string
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
  columns: Dataset['columns']
  rows: Dataset['rows']
  roles: Dataset['roles']
  insights: Dataset['insights']
  parseMeta: Dataset['parseMeta']
  delimiter?: string | null
}

/** Convierte un registro devuelto por la API al tipo Dataset del frontend. */
function toDataset(record: BackendDataset): Dataset {
  return {
    id: record.id,
    fileName: record.fileName,
    sizeBytes: record.sizeBytes ?? 0,
    uploadedAt: record.uploadedAt,
    processMs: record.processMs ?? 0,
    rowCount: record.rowCount ?? 0,
    columnCount: record.columnCount ?? 0,
    totalCells: record.totalCells ?? 0,
    missingCells: record.missingCells ?? 0,
    duplicateRows: record.duplicateRows ?? 0,
    completeness: record.completeness ?? 0,
    headers: record.headers ?? [],
    columns: record.columns ?? [],
    rows: record.rows ?? [],
    roles: record.roles ?? {},
    insights: record.insights ?? {},
    parseMeta: record.parseMeta,
  }
}

/** HistoryEntry para el historial a partir de un registro de metadatos. */
function toHistory(record: BackendDataset): HistoryEntry {
  return {
    id: record.id,
    fileName: record.fileName,
    sizeBytes: record.sizeBytes ?? 0,
    rowCount: record.rowCount ?? 0,
    columnCount: record.columnCount ?? 0,
    uploadedAt: record.uploadedAt ?? new Date().toISOString(),
    processMs: record.processMs ?? 0,
    stored: true,
    duplicateRows: record.duplicateRows,
    delimiter: record.delimiter ?? undefined,
  }
}

/** GET /api/datasets — historial de datasets del usuario. */
export async function apiListDatasets(): Promise<HistoryEntry[]> {
  const res = await apiRequest<{ datasets: BackendDataset[] }>('/datasets')
  return (res?.datasets ?? []).map(toHistory)
}

/** GET /api/datasets/:id — dataset completo. */
export async function apiGetDataset(id: string): Promise<Dataset | null> {
  const res = await apiRequest<{ dataset: BackendDataset | null } | null>(`/datasets/${encodeURIComponent(id)}`)
  const data = res?.dataset ?? null
  return data ? toDataset(data) : null
}

/** POST /api/datasets — crea/actualiza un dataset. */
export async function apiSaveDataset(dataset: Dataset): Promise<Dataset> {
  const res = await apiRequest<{ dataset: BackendDataset }>('/datasets', {
    method: 'POST',
    body: dataset,
  })
  return toDataset(res.dataset)
}

/** DELETE /api/datasets/:id — elimina un dataset. */
export async function apiDeleteDataset(id: string): Promise<boolean> {
  await apiRequest<{ deleted: boolean }>(`/datasets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return true
}

/** GET /api/datasets → lista completa para respaldos (con filas). */
export async function apiAllDatasets(): Promise<Dataset[]> {
  const res = await apiRequest<{ datasets: BackendDataset[] }>('/datasets')
  const records = res?.datasets ?? []
  const full = await Promise.all(
    records.map((r) => apiGetDataset(r.id)),
  )
  return full.filter((d): d is Dataset => d !== null)
}

/* ------------------------------------------------------------------ */
/*  POST /api/datasets/parse — análisis en el backend                  */
/* ------------------------------------------------------------------ */

/**
 * Envía las filas crudas al backend para que `analyzeRows` calcule todo el
 * análisis (tipos, calidad, insights) y lo guarde en Supabase.
 */
export async function apiParseDataset(payload: {
  id: string
  fileName: string
  sizeBytes?: number
  processMs?: number
  delimiter?: string
  rows: Record<string, unknown>[]
}): Promise<Dataset> {
  const res = await apiRequest<{ dataset: BackendDataset }>('/datasets/parse', {
    method: 'POST',
    body: payload,
  })
  return toDataset(res.dataset)
}

/* ------------------------------------------------------------------ */
/*  Calidad                                                            */
/* ------------------------------------------------------------------ */

export interface QualitySummary {
  rowCount: number
  columnCount: number
  totalCells: number
  missingCells: number
  missingPercent: number
  duplicateRows: number
  completeness: number
  score: number
}

/** GET /api/datasets/:id/quality — resumen de calidad del dataset. */
export async function apiGetQuality(id: string): Promise<QualitySummary | null> {
  const res = await apiRequest<{ quality: QualitySummary }>(`/datasets/${encodeURIComponent(id)}/quality`)
  return res?.quality ?? null
}

/* ------------------------------------------------------------------ */
/*  Limpieza                                                           */
/* ------------------------------------------------------------------ */

export interface CleanOptions {
  removeDuplicates?: boolean
  trim?: boolean
  dropEmptyRows?: boolean
}

export interface CleanSummary {
  removedRows: number
  before: { rowCount: number; missingCells: number }
  after: { rowCount: number; missingCells: number; duplicateRows: number; completeness: number }
}

/**
 * POST /api/datasets/:id/clean — ejecuta limpieza en el backend.
 * Con `dryRun: true` solo previsualiza sin persistir.
 */
export async function apiCleanDataset(
  id: string,
  options: CleanOptions,
  dryRun = false,
): Promise<{ removedRows: number; dryRun: boolean; summary: CleanSummary; analysis: BackendDataset['columns'] }> {
  const qs = dryRun ? '?dryRun=true' : ''
  return apiRequest<{ removedRows: number; dryRun: boolean; summary: CleanSummary; analysis: BackendDataset['columns'] }>(
    `/datasets/${encodeURIComponent(id)}/clean${qs}`,
    { method: 'POST', body: { options } },
  )
}

export interface CleaningLog {
  id: string
  action: string
  summary: CleanSummary
  created_at: string
}

/** GET /api/datasets/:id/cleaning-log — historial de limpiezas del dataset. */
export async function apiGetCleaningLogs(id: string): Promise<CleaningLog[]> {
  const res = await apiRequest<{ logs: CleaningLog[] }>(`/datasets/${encodeURIComponent(id)}/cleaning-log`)
  return res?.logs ?? []
}

/* ------------------------------------------------------------------ */
/*  Gráficos (charts)                                                  */
/* ------------------------------------------------------------------ */

export interface ChartColumn {
  name: string
  type: string
}

/** GET /api/datasets/:id/charts/columns — columnas disponibles para graficar. */
export async function apiGetChartColumns(id: string): Promise<ChartColumn[]> {
  const res = await apiRequest<{ columns: ChartColumn[] }>(`/datasets/${encodeURIComponent(id)}/charts/columns`)
  return res?.columns ?? []
}

export interface ChartData {
  timeline: { label: string; value: number }[]
  timelineTitle: string | null
  histogram: { bin: string; count: number }[]
  histogramColumn: string | null
  topCategories: { name: string; value: number }[]
  topCategoriesTitle: string | null
  typeDistribution: { name: string; value: number }[]
}

/** GET /api/datasets/:id/charts/data — insights listos para graficar. */
export async function apiGetChartData(id: string): Promise<ChartData | null> {
  const res = await apiRequest<{ charts: ChartData }>(`/datasets/${encodeURIComponent(id)}/charts/data`)
  return res?.charts ?? null
}

/** GET /api/datasets/:id/charts/raw — columnas y primeros registros crudos. */
export async function apiGetChartRaw(id: string): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const res = await apiRequest<{ headers: string[]; rows: Record<string, unknown>[] }>(
    `/datasets/${encodeURIComponent(id)}/charts/raw`,
  )
  return { headers: res?.headers ?? [], rows: res?.rows ?? [] }
}

/* ------------------------------------------------------------------ */
/*  Ventas (sales)                                                     */
/* ------------------------------------------------------------------ */

export interface SalesSummary {
  totalRevenue: number
  periods: number
  rowCount: number
  revenueColumn: string | null
  dateColumn: string | null
  categoryColumn: string | null
  lastPeriod: { label: string; value: number } | null
  previousPeriod: { label: string; value: number } | null
  variationPercent: number | null
  topCategories: { name: string; value: number }[]
}

/** GET /api/datasets/:id/sales/summary — resumen comercial. */
export async function apiGetSalesSummary(id: string): Promise<SalesSummary | null> {
  const res = await apiRequest<{ summary: SalesSummary }>(`/datasets/${encodeURIComponent(id)}/sales/summary`)
  return res?.summary ?? null
}

/** GET /api/datasets/:id/sales/trend — serie de ventas + histograma. */
export async function apiGetSalesTrend(id: string): Promise<{ trend: { label: string; value: number }[]; histogram: { bin: string; count: number }[] }> {
  const res = await apiRequest<{ trend: { label: string; value: number }[]; histogram: { bin: string; count: number }[] }>(
    `/datasets/${encodeURIComponent(id)}/sales/trend`,
  )
  return { trend: res?.trend ?? [], histogram: res?.histogram ?? [] }
}

/* ------------------------------------------------------------------ */
/*  Comparar                                                           */
/* ------------------------------------------------------------------ */

export interface CompareResult {
  base: { id: string; rowCount: number; fileName: string }
  other: { id: string; rowCount: number; fileName: string }
  overlappingRows: number
  overlapPercent: number
}

/** POST /api/datasets/:id/compare — compara dos datasets del usuario. */
export async function apiCompareDatasets(id: string, otherDatasetId: string): Promise<CompareResult> {
  const res = await apiRequest<{ compare: CompareResult }>(`/datasets/${encodeURIComponent(id)}/compare`, {
    method: 'POST',
    body: { otherDatasetId },
  })
  return res.compare
}

/* ------------------------------------------------------------------ */
/*  Enriquecer                                                         */
/* ------------------------------------------------------------------ */

export interface EnrichSuggestion {
  column: string
  missing: number
  action: string
}

export interface EnrichResult {
  applied: boolean
  suggestions: EnrichSuggestion[]
  message: string
}

/** POST /api/datasets/:id/enrich — sugiere acciones de enriquecimiento. */
export async function apiEnrichDataset(id: string): Promise<EnrichResult> {
  const res = await apiRequest<{ enrich: EnrichResult }>(`/datasets/${encodeURIComponent(id)}/enrich`, {
    method: 'POST',
  })
  return res.enrich
}

/* ------------------------------------------------------------------ */
/*  Ofertas                                                            */
/* ------------------------------------------------------------------ */

export interface OfertaSugerencia {
  producto: string
  unidades: number
  tickets: number
  precioPromedio: number
  revenue: number
  tipo: string
  etiqueta: string
  descuentoSugerido: number
  fundamento: string
  precioOferta: number
}

export interface OfertasResult {
  productoColumn: string | null
  precioColumn: string | null
  totalRevenue: number
  items: OfertaSugerencia[]
}

/** GET /api/datasets/:id/ofertas — sugerencias de ofertas desde el dataset. */
export async function apiGetOfertas(id: string): Promise<OfertasResult | null> {
  const res = await apiRequest<{ ofertas: OfertasResult }>(`/datasets/${encodeURIComponent(id)}/ofertas`)
  return res?.ofertas ?? null
}

export interface ImpactoOferta {
  producto: string
  tipo: string
  descuento: number
  precioAnterior: number
  precioOferta: number
  ingresoUnitarioPerdido: number
  unidadesVendidas: number
  revenueHistorico: number
  unidadesEstimadasExtra: number
  revenueEstimadoOferta: number
  vigencia: string | null
  fundamento: string
}

/** POST /api/datasets/:id/ofertas/impacto — calcula impacto de un descuento. */
export async function apiGetImpactoOferta(
  id: string,
  body: { producto: string; descuento: number; tipo?: string; vigencia?: string },
): Promise<ImpactoOferta> {
  const res = await apiRequest<{ impacto: ImpactoOferta }>(`/datasets/${encodeURIComponent(id)}/ofertas/impacto`, {
    method: 'POST',
    body,
  })
  return res.impacto
}

export interface CrearOfertaResult {
  oferta: ImpactoOferta
  persisted: string | null
}

/** POST /api/datasets/:id/ofertas — crea oferta y, si `persist`, la guarda en user_tables. */
export async function apiCrearOferta(
  id: string,
  body: {
    producto: string
    descuento: number
    tipo?: string
    vigencia?: string
    vigenciaInicio?: string
    vigenciaFin?: string
    persist?: boolean
  },
): Promise<CrearOfertaResult> {
  const res = await apiRequest<{ oferta: ImpactoOferta; persisted: string | null }>(
    `/datasets/${encodeURIComponent(id)}/ofertas`,
    { method: 'POST', body },
  )
  return { oferta: res.oferta, persisted: res.persisted ?? null }
}
