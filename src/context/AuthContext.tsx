import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AuthContext,
  type PendingUser,
  type SessionUser,
} from './auth.context'
import {
  apiLogin,
  apiMe,
  apiRegister,
  apiResendOtp,
  apiVerify,
  apiGoogleLogin,
} from '../api/auth'
import { apiGetProfile } from '../api/profile'
import { getToken, setToken } from '../api/token'
import { ApiClientError } from '../api/client'

const SESSION_KEY = 'crm_session'
const PENDING_KEY = 'crm_pending_verification'

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

function readPending(): PendingUser | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingUser) : null
  } catch {
    return null
  }
}

function sessionFromIdentity(identity: { name: string; email: string }): SessionUser {
  return { name: identity.name, email: identity.email }
}

async function enrichWithProfile(user: SessionUser): Promise<SessionUser> {
  try {
    const profile = await apiGetProfile()
    return {
      ...user,
      role: profile.role,
      permissions: profile.permissions,
    }
  } catch {
    return user
  }
}

function persist(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() =>
    getToken() ? readSession() : null,
  )
  const [pending, setPending] = useState<PendingUser | null>(() => readPending())

  const startLogin = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password)
    const pendingUser: PendingUser = { name: '', email: response.email }
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendingUser))
    setPending(pendingUser)
  }, [])

  const startRegister = useCallback(
    async (name: string, email: string, password: string, inviteCode?: string) => {
      const response = await apiRegister(name, email, password, inviteCode)
      const pendingUser: PendingUser = {
        name: name.trim(),
        email: response.email,
        inviteCode,
      }
      localStorage.setItem(PENDING_KEY, JSON.stringify(pendingUser))
      setPending(pendingUser)
    },
    [],
  )

  const googleLogin = useCallback(async (idToken: string) => {
    const session = await apiGoogleLogin(idToken)
    setToken(session.token)
    const sessionUser = await enrichWithProfile(
      sessionFromIdentity({ name: session.user.name, email: session.user.email }),
    )
    persist(sessionUser)
    setUser(sessionUser)
  }, [])

  const verifyOtp = useCallback(async (code: string) => {
    if (!pending) {
      throw new Error('No hay una verificación activa. Inicia sesión de nuevo.')
    }
    const session = await apiVerify(pending.email, code)
    setToken(session.token)
    const sessionUser = await enrichWithProfile(
      sessionFromIdentity({ name: session.user.name, email: session.user.email }),
    )
    persist(sessionUser)
    localStorage.removeItem(PENDING_KEY)
    setPending(null)
    setUser(sessionUser)
  }, [pending])

  const resendOtp = useCallback(async () => {
    if (!pending) {
      throw new Error('No hay una verificación activa. Inicia sesión de nuevo.')
    }
    await apiResendOtp(pending.email)
  }, [pending])

  const cancelVerification = useCallback(() => {
    localStorage.removeItem(PENDING_KEY)
    setPending(null)
  }, [])

  const updateSession = useCallback((patch: Partial<SessionUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const refreshUser = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev
      void enrichWithProfile(prev).then((next) => {
        persist(next)
        setUser(next)
      })
      return prev
    })
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  // Revalida el token guardado contra el backend al arrancar.
  // Si el servidor rechaza la sesión, la limpia; si es un fallo de red, se
  // conserva la sesión local para no expulsar al usuario injustamente.
  useEffect(() => {
    void restoreSession().then((restored) => {
      if (restored) setUser(restored)
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      pending,
      startLogin,
      startRegister,
      googleLogin,
      verifyOtp,
      resendOtp,
      cancelVerification,
      logout,
      updateSession,
      refreshUser,
    }),
    [user, pending, startLogin, startRegister, googleLogin, verifyOtp, resendOtp, cancelVerification, logout, updateSession, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Revalida un token guardado al arrancar la app; devuelve el usuario si sigue válido. */
async function restoreSession(): Promise<SessionUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const me = await apiMe()
    const base = sessionFromIdentity({ name: me.name, email: me.email })
    const enriched = await enrichWithProfile(base)
    persist(enriched)
    return enriched
  } catch (err) {
    // Solo cerramos sesión cuando el servidor rechaza explícitamente el token.
    if (err instanceof ApiClientError && err.status === 401) {
      setToken(null)
      localStorage.removeItem(SESSION_KEY)
    }
    return null
  }
}