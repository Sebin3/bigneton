import apiRequest from './client'
import type { UserTable } from '../lib/datasetStore'

/** Registro tal como lo devuelve la API (camelCase). */
export interface BackendTable {
  id: string
  name: string
  description?: string
  icon?: string
  group?: UserTable['group']
  fields: UserTable['fields']
  rows?: UserTable['rows']
  createdAt?: string
  updatedAt?: string
}

/** Convierte un registro devuelto por la API al tipo UserTable del frontend. */
export function toUserTable(record: BackendTable): UserTable {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    icon: record.icon ?? 'table',
    group: record.group ?? 'libre',
    fields: record.fields ?? [],
    rows: record.rows ?? [],
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  }
}

/** GET /api/tables — lista las tablas del usuario (sin filas). */
export async function apiListTables(): Promise<UserTable[]> {
  const res = await apiRequest<{ tables: BackendTable[] }>('/tables')
  return (res?.tables ?? []).map(toUserTable)
}

/** GET /api/tables/:id — devuelve una tabla completa (con filas). */
export async function apiGetTable(id: string): Promise<UserTable | null> {
  const res = await apiRequest<{ table: BackendTable | null } | null>(`/tables/${encodeURIComponent(id)}`)
  const data = res?.table ?? null
  return data ? toUserTable(data) : null
}

/** POST /api/tables — crea/actualiza una tabla. */
export async function apiSaveTable(table: UserTable): Promise<UserTable> {
  const res = await apiRequest<{ table: BackendTable }>('/tables', {
    method: 'POST',
    body: table,
  })
  return toUserTable(res.table)
}

/** PUT /api/tables/:id — actualiza una tabla existente. */
export async function apiUpdateTable(table: UserTable): Promise<UserTable> {
  const res = await apiRequest<{ table: BackendTable }>(`/tables/${encodeURIComponent(table.id)}`, {
    method: 'PUT',
    body: table,
  })
  return toUserTable(res.table)
}

/** DELETE /api/tables/:id — elimina una tabla. */
export async function apiDeleteTable(id: string): Promise<boolean> {
  await apiRequest<{ deleted: boolean }>(`/tables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return true
}