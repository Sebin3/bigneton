import apiRequest from './client'

export interface ApiUser {
  id: string
  name: string
  email: string
  avatar?: string | null
}

export interface SessionResponse {
  token: string
  user: ApiUser
}

/** POST /api/auth/register — crea la cuenta (exige código de invitación) y envía el OTP. */
export async function apiRegister(
  name: string,
  email: string,
  password: string,
  inviteCode?: string,
) {
  return apiRequest<{ email: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    body: { name, email, password, code: inviteCode || undefined },
  })
}

/** POST /api/auth/login — valida credenciales y envía el OTP al correo. */
export async function apiLogin(email: string, password: string) {
  return apiRequest<{ email: string }>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
}

/** POST /api/auth/verify — confirma el OTP y devuelve el token JWT. */
export async function apiVerify(email: string, code: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/verify', {
    method: 'POST',
    auth: false,
    body: { email, code },
  })
}

/** POST /api/auth/resend — reenvía un nuevo código OTP. */
export async function apiResendOtp(email: string) {
  return apiRequest<{ email: string }>('/auth/resend', {
    method: 'POST',
    auth: false,
    body: { email },
  })
}

/** GET /api/auth/me — recupera el usuario de un token guardado. */
export async function apiMe(): Promise<ApiUser> {
  return apiRequest<ApiUser>('/auth/me')
}

/** POST /api/auth/google — login/registro con Google ID token. */
export async function apiGoogleLogin(idToken: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/google', {
    method: 'POST',
    auth: false,
    body: { idToken },
  })
}