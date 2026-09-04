import apiRequest from './client'

export type Permissions = Record<string, Record<string, boolean>>

export interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
  company?: string | null
  role?: string
  permissions?: Permissions
  createdAt?: string
}

interface BackendUser {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  company?: string | null
  role?: string
  permissions?: Permissions
  created_at?: string
}

function toProfile(user: BackendUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    company: user.company ?? null,
    role: user.role,
    permissions: user.permissions ?? {},
    createdAt: user.created_at,
  }
}

/** GET /api/users/me — perfil editable del usuario. */
export async function apiGetProfile(): Promise<UserProfile> {
  const data = await apiRequest<{ user: BackendUser }>('/users/me')
  return toProfile(data.user)
}

/** PUT /api/users/me — actualiza campos editables del perfil. */
export async function apiUpdateProfile(
  patches: Partial<Pick<UserProfile, 'name' | 'avatarUrl' | 'company' | 'role'>>,
): Promise<UserProfile> {
  const data = await apiRequest<{ user: BackendUser }>('/users/me', {
    method: 'PUT',
    body: {
      name: patches.name,
      avatarUrl: patches.avatarUrl,
      company: patches.company,
      role: patches.role,
    },
  })
  return toProfile(data.user)
}

/** PUT /api/users/me/password — cambia la contraseña. */
export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ changed: boolean }> {
  return apiRequest<{ changed: boolean }>('/users/me/password', {
    method: 'PUT',
    body: { currentPassword, newPassword },
  })
}