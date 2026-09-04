import apiRequest from './client'

export type UserRole = 'superadmin' | 'admin' | 'analyst' | 'auditor' | 'user'

export type Permissions = Record<string, Record<string, boolean>>

export interface ManageUser {
  id: string
  name: string
  email: string
  company: string | null
  avatarUrl: string | null
  role: UserRole
  permissions: Permissions
  createdAt: string
}

/** GET /api/users — lista usuarios (requiere admin). */
export async function apiListUsers(): Promise<ManageUser[]> {
  const res = await apiRequest<{ users: ManageUser[] }>('/users')
  return res?.users ?? []
}

/** POST /api/users — crea un miembro con rol (requiere admin). */
export async function apiCreateUser(input: {
  name: string
  email: string
  password: string
  role?: Exclude<UserRole, 'superadmin'>
}): Promise<ManageUser> {
  const res = await apiRequest<{ user: ManageUser }>('/users', {
    method: 'POST',
    body: input,
  })
  return res.user
}

/** PUT /api/users/:id/role — cambia el rol de un usuario (requiere admin). */
export async function apiUpdateUserRole(
  id: string,
  role: Exclude<UserRole, 'superadmin'>,
): Promise<ManageUser> {
  const res = await apiRequest<{ user: ManageUser }>(
    `/users/${encodeURIComponent(id)}/role`,
    { method: 'PUT', body: { role } },
  )
  return res.user
}

/** PUT /api/users/:id/permissions — actualiza los permisos finos de un usuario. */
export async function apiUpdateUserPermissions(
  id: string,
  permissions: Permissions,
): Promise<ManageUser> {
  const res = await apiRequest<{ user: ManageUser }>(
    `/users/${encodeURIComponent(id)}/permissions`,
    { method: 'PUT', body: { permissions } },
  )
  return res.user
}

/** DELETE /api/users/:id — elimina un usuario (requiere admin). */
export async function apiDeleteUser(id: string): Promise<void> {
  await apiRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
