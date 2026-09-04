import type { Dataset } from './csvAnalyzer'
import {
  apiAllDatasets,
  apiDeleteDataset,
  apiGetDataset,
  apiSaveDataset,
} from '../api/datasets'
import {
  apiDeleteTable,
  apiListTables,
  apiSaveTable,
} from '../api/tables'

/**
 * Capa de persistencia. En lugar de IndexedDB, todo se guarda en el backend
 * (Supabase) a través de la API. Se mantienen los mismos nombres de función
 * para no cambiar las vistas que ya consumen este módulo.
 */

export type FieldKind = 'text' | 'number' | 'date' | 'select' | 'money' | 'percent'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
  /** Los campos base no se pueden borrar desde la UI. */
  locked?: boolean
}

export type TableRow = Record<string, string>

/** Sección del panel donde nació la tabla; decide qué analítica se le aplica. */
export type TableGroup = 'ofertas' | 'campanas' | 'pipeline' | 'libre'

export interface UserTable {
  id: string
  name: string
  description: string
  icon: string
  /** Ausente en tablas creadas antes de los grupos: se tratan como 'libre'. */
  group?: TableGroup
  fields: FieldDef[]
  rows: TableRow[]
  createdAt: string
  updatedAt: string
}

/* ------------------------------- datasets ------------------------------- */

export async function saveDatasetToStore(dataset: Dataset): Promise<void> {
  await apiSaveDataset(dataset)
}

export async function getDatasetFromStore(id: string): Promise<Dataset | null> {
  return apiGetDataset(id)
}

export async function deleteDatasetFromStore(id: string): Promise<void> {
  await apiDeleteDataset(id)
}

export async function getAllDatasets(): Promise<Dataset[]> {
  return apiAllDatasets()
}

/** Al no usar almacenamiento local, no hay cuota que estimar. */
export async function estimateStorage(): Promise<null> {
  return null
}

/* -------------------- tablas creadas desde el frontend ------------------- */

export async function saveUserTable(table: UserTable): Promise<void> {
  await apiSaveTable(table)
}

export async function getUserTables(): Promise<UserTable[]> {
  return apiListTables()
}

export async function deleteUserTable(id: string): Promise<void> {
  await apiDeleteTable(id)
}