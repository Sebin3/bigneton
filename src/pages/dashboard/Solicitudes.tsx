/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Circle, Inbox, Loader2, Mail, MessageSquare, RefreshCw, Search, Send, StickyNote, UserRound } from 'lucide-react'
import {
  apiGetContactRequest,
  apiListContactRequests,
  apiReplyContactRequest,
  apiUpdateContactRequest,
  apiSyncGmailReplies,
  type ContactMessage,
  type ContactRequest,
  type RequestStatus,
} from '../../api/contactRequests'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import './Solicitudes.css'
import { apiRequest } from '../../api/client'

interface StaffUser { id: string; name: string; email: string; role: string }

const STATUS: { value: RequestStatus; label: string }[] = [
  { value: 'new', label: 'Nueva' },
  { value: 'in_progress', label: 'En revisión' },
  { value: 'answered', label: 'Respondida' },
  { value: 'waiting_customer', label: 'Esperando cliente' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'spam', label: 'Spam' },
]

const statusLabel = (value: string) => STATUS.find((item) => item.value === value)?.label ?? value
const dateTime = (value: string) => new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Solicitudes() {
  const [requests, setRequests] = useState<ContactRequest[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [draft, setDraft] = useState('')
  const [internal, setInternal] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiListContactRequests()
      setRequests(data)
      setSelectedId((current) => current ?? data[0]?.id ?? null)
    } catch (err) {
      setRequests([])
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes.')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void apiRequest<{ users: StaffUser[] }>('/users').then((result) => setStaff(result.users ?? [])).catch(() => setStaff([]))
  }, [])

  const syncGmail = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true)
    try {
      const result = await apiSyncGmailReplies()
      if (result.imported > 0) {
        await load()
        if (selectedId) {
          const thread = await apiGetContactRequest(selectedId)
          setMessages(thread.messages)
        }
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'No se pudo sincronizar Gmail.')
    } finally { if (!silent) setSyncing(false) }
  }, [load, selectedId])

  useEffect(() => {
    void syncGmail(true)
    const timer = window.setInterval(() => { void syncGmail(true) }, 60_000)
    return () => window.clearInterval(timer)
  }, [syncGmail])
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    setLoadingThread(true)
    void apiGetContactRequest(selectedId)
      .then(({ messages: next }) => setMessages(next))
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la conversación.'))
      .finally(() => setLoadingThread(false))
  }, [selectedId])

  const selected = requests?.find((item) => item.id === selectedId) ?? null
  const filtered = useMemo(() => (requests ?? []).filter((item) => {
    const haystack = `${item.name} ${item.email} ${item.company ?? ''} ${item.ticketNumber}`.toLowerCase()
    const matchesQuery = haystack.includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'open'
      ? !['closed', 'spam'].includes(item.status)
      : item.status === statusFilter)
    return matchesQuery && matchesStatus
  }), [requests, query, statusFilter])

  const updateSelected = async (patch: Partial<Pick<ContactRequest, 'status' | 'priority' | 'assignedTo'>>) => {
    if (!selected) return
    try {
      const updated = await apiUpdateContactRequest(selected.id, patch)
      setRequests((prev) => (prev ?? []).map((item) => item.id === updated.id ? updated : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar.') }
  }

  const submitReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !draft.trim() || sending) return
    setSending(true); setError('')
    try {
      const message = await apiReplyContactRequest(selected.id, draft, internal)
      setMessages((prev) => [...prev, message])
      setDraft('')
      if (!internal) setRequests((prev) => (prev ?? []).map((item) => item.id === selected.id ? { ...item, status: 'waiting_customer' } : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo enviar la respuesta.') }
    finally { setSending(false) }
  }

  return (
    <div className="requests-page">
      <header className="requests-header">
        <div><h1>Solicitudes</h1><p>Contactos comerciales y conversaciones recibidas desde el sitio web.</p></div>
        <div className="requests-header__actions"><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw size={15} /> Actualizar</Button><Button size="sm" onClick={() => void syncGmail(false)} disabled={syncing}>{syncing ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Sincronizar Gmail</Button></div>
      </header>
      {error && <div className="requests-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}

      <div className="requests-shell">
        <aside className="requests-inbox">
          <div className="requests-tools">
            <div className="requests-search"><Search size={16} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar solicitud..." /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="open">Abiertas</option><option value="all">Todas</option>{STATUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </div>
          <div className="requests-list">
            {requests === null ? <div className="requests-empty"><Loader2 className="animate-spin" size={20} /> Cargando...</div>
              : filtered.length === 0 ? <div className="requests-empty"><Inbox size={26} /><span>No hay solicitudes</span></div>
              : filtered.map((item) => (
                <button key={item.id} className={`request-item ${selectedId === item.id ? 'is-active' : ''}`} onClick={() => setSelectedId(item.id)}>
                  <span className={`request-dot is-${item.status}`}><Circle size={9} fill="currentColor" /></span>
                  <span className="request-item__body"><strong>{item.company || item.name}</strong><small>{item.name} · {item.category}</small><em>{item.ticketNumber}</em></span>
                  <time>{dateTime(item.lastMessageAt)}</time>
                </button>
              ))}
          </div>
        </aside>

        <section className="request-thread">
          {!selected ? <div className="thread-placeholder"><MessageSquare size={38} /><h2>Selecciona una solicitud</h2><p>Aquí verás la conversación completa.</p></div> : <>
            <div className="thread-head">
              <div className="thread-avatar">{selected.name.slice(0, 1).toUpperCase()}</div>
              <div className="thread-identity"><strong>{selected.name}</strong><span>{selected.company || 'Sin empresa'} · {selected.email}</span></div>
              <div className="thread-controls">
                <select aria-label="Responsable" value={selected.assignedTo ?? ''} onChange={(e) => void updateSelected({ assignedTo: e.target.value || null })}><option value="">Sin asignar</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
                <select value={selected.priority} onChange={(e) => void updateSelected({ priority: e.target.value as ContactRequest['priority'] })}><option value="low">Prioridad baja</option><option value="normal">Prioridad normal</option><option value="high">Prioridad alta</option></select>
                <select value={selected.status} onChange={(e) => void updateSelected({ status: e.target.value as RequestStatus })}>{STATUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              </div>
            </div>
            <div className="thread-meta"><span><Mail size={14} /> {selected.email}</span>{selected.phone && <span><UserRound size={14} /> {selected.phone}</span>}<span><Building2 size={14} /> {selected.company || 'Sin empresa'}</span><span>Estado: {statusLabel(selected.status)}</span></div>
            <div className="thread-messages">
              {loadingThread ? <div className="requests-empty"><Loader2 className="animate-spin" size={20} /> Cargando conversación...</div> : messages.map((message) => (
                <article key={message.id} className={`message-bubble ${message.direction === 'outbound' ? 'is-outbound' : 'is-inbound'} ${message.isInternal ? 'is-note' : ''}`}>
                  <div className="message-bubble__label">{message.isInternal ? 'Nota interna' : message.direction === 'inbound' ? selected.name : 'Equipo'} {message.emailStatus === 'failed' && <span>· envío fallido</span>}</div>
                  <p>{message.body}</p><time>{dateTime(message.createdAt)}</time>
                </article>
              ))}
            </div>
            <form className={`thread-compose ${internal ? 'is-internal' : ''}`} onSubmit={submitReply}>
              <div className="compose-mode"><button type="button" className={!internal ? 'is-active' : ''} onClick={() => setInternal(false)}><Send size={14} /> Responder por correo</button><button type="button" className={internal ? 'is-active' : ''} onClick={() => setInternal(true)}><StickyNote size={14} /> Nota interna</button></div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} rows={3} placeholder={internal ? 'Escribe una nota solo para el equipo...' : `Responder a ${selected.email}...`} />
              <div className="compose-actions"><small>{draft.length}/5000</small><Button type="submit" disabled={sending || !draft.trim()}>{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {internal ? 'Guardar nota' : 'Enviar respuesta'}</Button></div>
            </form>
          </>}
        </section>
      </div>
    </div>
  )
}
