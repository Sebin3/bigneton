import apiRequest from './client'
import type { PipelineMap } from '../lib/pipeline'

/** Registro tal como lo devuelve la API (camelCase). */
interface BackendPipelineMap {
  datasetId: string
  stage?: string
  amount?: string
  owner?: string
  closeDate?: string
  probabilities?: Record<string, number>
}

function toMap(data: BackendPipelineMap): PipelineMap {
  return {
    datasetId: data.datasetId,
    stage: data.stage ?? '',
    amount: data.amount ?? '',
    owner: data.owner ?? '',
    closeDate: data.closeDate ?? '',
    probabilities: data.probabilities ?? {},
  }
}

/** GET /api/pipelines/:datasetId — mapeo de un dataset (o null). */
export async function apiGetPipeline(datasetId: string): Promise<PipelineMap | null> {
  const res = await apiRequest<{ pipeline: BackendPipelineMap | null } | null>(`/pipelines/${encodeURIComponent(datasetId)}`)
  const data = res?.pipeline ?? null
  return data ? toMap(data) : null
}

/** PUT /api/pipelines/:datasetId — crea/actualiza el mapeo de un dataset. */
export async function apiSavePipeline(map: PipelineMap): Promise<PipelineMap> {
  const res = await apiRequest<{ pipeline: BackendPipelineMap }>(
    `/pipelines/${encodeURIComponent(map.datasetId)}`,
    {
      method: 'PUT',
      body: map,
    },
  )
  return toMap(res.pipeline)
}