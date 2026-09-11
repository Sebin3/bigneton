import { getToken } from './token'

/**
 * URL base de la API. Se configura con VITE_API_URL (ver .env). En desarrollo
 * apunta al backend Express (`http://localhost:4000/api`).
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:4000/api'

/** Error lanzado por la capa API, con el código de negocio del backend. */
export class ApiClientError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function handleResponse(
  response: Response,
): Promise<unknown> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    /* cuerpo vacío */
  }

  if (response.ok && isRecord(payload) && payload.success === true) {
    return payload.data
  }

  if (isRecord(payload)) {
    const err = isRecord(payload.error) ? payload.error : null
    const message =
      (typeof err?.message === 'string' && err.message) ||
      `Error del servidor (${response.status}).`
    const code =
      (typeof err?.code === 'string' && err.code) || 'UNKNOWN_ERROR'
    throw new ApiClientError(message, response.status, code)
  }

  throw new ApiClientError(
    `Error del servidor (${response.status}).`,
    response.status,
    'UNKNOWN_ERROR',
  )
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Envía el header Authorization con el token actual. */
  auth?: boolean
}

/**
 * Llamada genérica a la API. Normaliza la respuesta `{ success, data }` del
 * backend y traduce los errores a `ApiClientError`.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  return (await handleResponse(response)) as T
}

export default apiRequest