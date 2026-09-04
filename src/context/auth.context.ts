import { createContext } from 'react'

export type Permissions = Record<string, Record<string, boolean>>

export interface SessionUser {
  name: string
  email: string
  role?: string
  permissions?: Permissions
}

export interface PendingUser {
  name: string
  email: string
  /** Código de invitación usado para registrarse (lo exige el backend). */
  inviteCode?: string
}

export interface AuthContextValue {
  user: SessionUser | null
  /** Usuario esperando verificar su OTP (se usa en la vista Verify). */
  pending: PendingUser | null
  startLogin: (email: string, password: string) => Promise<void>
  startRegister: (name: string, email: string, password: string, inviteCode?: string) => Promise<void>
  googleLogin: (idToken: string) => Promise<void>
  verifyOtp: (code: string) => Promise<void>
  resendOtp: () => Promise<void>
  cancelVerification: () => void
  logout: () => void
  /** Recarga el perfil del usuario actual desde el backend (rol/permisos). */
  refreshUser: () => Promise<void>
  /** Actualiza los datos de la sesión local tras editar el perfil. */
  updateSession: (patch: Partial<SessionUser>) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)