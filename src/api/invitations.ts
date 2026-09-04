import apiRequest from './client'

export type InvitationRole = 'analyst' | 'admin' | 'auditor'

export interface Invitation {
  id: string
  code: string
  email: string | null
  role: InvitationRole
  maxUses: number
  usedCount: number
  expiresAt: string
  active: boolean
  createdAt: string
}

export interface CreateInvitationInput {
  email?: string
  role?: InvitationRole
  maxUses?: number
  expiresAt?: string | null
}

/** GET /api/invitations — lista las invitaciones del usuario. */
export async function apiListInvitations(): Promise<Invitation[]> {
  const res = await apiRequest<{ invitations: Invitation[] }>('/invitations')
  return res?.invitations ?? []
}

/** POST /api/invitations — crea una invitación (opcionalmente envía el correo). */
export async function apiCreateInvitation(
  input: CreateInvitationInput,
): Promise<{ invitation: Invitation; emailSent: boolean | null }> {
  const body: Record<string, unknown> = {}
  if (input.email) body.email = input.email
  if (input.role) body.role = input.role
  if (input.maxUses) body.maxUses = input.maxUses
  if (input.expiresAt) body.expiresAt = input.expiresAt

  return apiRequest<{ invitation: Invitation; emailSent: boolean | null }>(
    '/invitations',
    { method: 'POST', body },
  )
}

/** DELETE /api/invitations/:id — revoca una invitación. */
export async function apiRevokeInvitation(id: string): Promise<void> {
  await apiRequest(`/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
