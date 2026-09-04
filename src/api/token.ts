/** Almacén del token JWT de sesión (persistido en localStorage). */

const TOKEN_KEY = 'crm_token'

let cached: string | null | undefined

export function setToken(token: string | null): void {
  cached = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* almacenamiento no disponible: el token vive solo en memoria */
  }
}

export function getToken(): string | null {
  if (cached !== undefined) return cached
  try {
    cached = localStorage.getItem(TOKEN_KEY)
  } catch {
    cached = null
  }
  return cached
}