import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export function PendingRoute({ children }: { children: ReactNode }) {
  const { pending, user } = useAuth()

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  if (!pending) {
    return <Navigate to="/login" replace />
  }

  return children
}
