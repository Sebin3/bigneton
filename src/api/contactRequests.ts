import apiRequest from './client'

export type RequestStatus = 'new' | 'in_progress' | 'answered' | 'waiting_customer' | 'closed' | 'spam'
export type RequestPriority = 'low' | 'normal' | 'high'

export interface ContactRequest {
  id: string
  ticketNumber: string
  name: string
  email: string
  phone: string | null
  company: string | null
  category: string
  preferredChannel: string
  status: RequestStatus
  priority: RequestPriority
  assignedTo: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface ContactMessage {
  id: string
  requestId: string
  direction: 'inbound' | 'outbound'
  channel: 'web' | 'email' | 'internal'
  body: string
  senderEmail: string | null
  senderUserId: string | null
  isInternal: boolean
  emailStatus: string | null
  providerMessageId?: string | null
  createdAt: string
}

export async function apiCreateContactRequest(input: {
  name: string; email: string; phone?: string; company?: string; category: string
  preferredChannel: string; message: string; website?: string
}): Promise<{ request?: ContactRequest; received?: boolean; notificationSent?: boolean }> {
  return apiRequest('/contact-requests', { method: 'POST', body: input, auth: false })
}

export async function apiListContactRequests(): Promise<ContactRequest[]> {
  const res = await apiRequest<{ requests: ContactRequest[] }>('/contact-requests')
  return res.requests ?? []
}

export async function apiGetContactRequest(id: string): Promise<{ request: ContactRequest; messages: ContactMessage[] }> {
  return apiRequest(`/contact-requests/${encodeURIComponent(id)}`)
}

export async function apiReplyContactRequest(id: string, body: string, isInternal = false): Promise<ContactMessage> {
  const res = await apiRequest<{ message: ContactMessage }>(`/contact-requests/${encodeURIComponent(id)}/messages`, {
    method: 'POST', body: { body, isInternal },
  })
  return res.message
}

export async function apiUpdateContactRequest(id: string, patch: Partial<Pick<ContactRequest, 'status' | 'priority' | 'assignedTo'>>): Promise<ContactRequest> {
  const res = await apiRequest<{ request: ContactRequest }>(`/contact-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: patch,
  })
  return res.request
}

export async function apiSyncGmailReplies(): Promise<{ imported: number; skipped: number; requestIds: string[] }> {
  return apiRequest('/contact-requests/sync-gmail', { method: 'POST' })
}
