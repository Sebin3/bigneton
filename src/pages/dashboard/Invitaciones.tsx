import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, Check, ChevronDown, Copy, KeyRound, Loader2, Mail, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import {
  apiCreateInvitation,
  apiListInvitations,
  apiRevokeInvitation,
  type Invitation,
  type InvitationRole,
} from '../../api/invitations'
import { copyText } from '../../lib/clipboard'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

const ROLES: { value: InvitationRole; label: string; hint: string }[] = [
  { value: 'analyst', label: 'Analista', hint: 'Procesa datos y gestiona su contenido' },
  { value: 'auditor', label: 'Auditor', hint: 'Acceso de solo lectura' },
  { value: 'admin', label: 'Administrador', hint: 'Gestiona usuarios e invitaciones' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function invitationStatus(inv: Invitation): 'active' | 'used' | 'expired' {
  if (!inv.active) return 'expired'
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) return 'used'
  if (daysUntil(inv.expiresAt) < 0) return 'expired'
  return 'active'
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  used: 'bg-muted text-muted-foreground',
  expired: 'bg-destructive/10 text-destructive',
}

const HIDDEN_INVITATIONS_KEY = 'crm_hidden_invitations'

export default function Invitaciones() {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitationRole>('analyst')
  const [maxUses, setMaxUses] = useState(1)
  const [expiresIn, setExpiresIn] = useState(4)
  const [sendEmail, setSendEmail] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_INVITATIONS_KEY) ?? '[]') as string[] }
    catch { return [] }
  })

  const visibleInvitations = useMemo(() => (invitations ?? []).filter((inv) => {
    if (hiddenIds.includes(inv.id)) return false
    return filter === 'all' || invitationStatus(inv) === 'active'
  }), [filter, hiddenIds, invitations])

  const completedCount = useMemo(() => (invitations ?? []).filter((inv) => invitationStatus(inv) !== 'active' && !hiddenIds.includes(inv.id)).length, [hiddenIds, invitations])

  const load = useCallback(async () => {
    try { setInvitations(await apiListInvitations()) } catch { setInvitations([]) }
  }, [])

  useEffect(() => {
    let active = true
    void apiListInvitations()
      .then((items) => { if (active) setInvitations(items) })
      .catch(() => { if (active) setInvitations([]) })
    return () => { active = false }
  }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (sendEmail && !/^\S+@\S+\.\S+$/.test(email)) { setError('Escribe un correo válido para enviar la invitación.'); return }
    setCreating(true)
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 86_400_000).toISOString()
      const { invitation } = await apiCreateInvitation({ email: sendEmail ? email : undefined, role, maxUses, expiresAt })
      setInvitations((prev) => [invitation, ...(prev ?? [])])
      setEmail(''); setRole('analyst'); setMaxUses(1); setSendEmail(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la invitación.') }
    finally { setCreating(false) }
  }

  const handleRevoke = async (id: string) => {
    setRevoking(id)
    try {
      await apiRevokeInvitation(id)
      setInvitations((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, active: false } : i)))
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo revocar.') }
    finally { setRevoking(null) }
  }

  const handleCopy = async (code: string) => {
    await copyText(code); setCopied(code); setTimeout(() => setCopied(null), 1500)
  }

  const clearCompleted = () => {
    const ids = (invitations ?? []).filter((inv) => invitationStatus(inv) !== 'active').map((inv) => inv.id)
    const next = Array.from(new Set([...hiddenIds, ...ids]))
    setHiddenIds(next)
    localStorage.setItem(HIDDEN_INVITATIONS_KEY, JSON.stringify(next))
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Invitaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">Genera códigos de acceso para invitar a tu equipo y controla quién entra a tu espacio de análisis.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><UserPlus size={18} /> Nueva invitación</CardTitle>
            <p className="text-xs text-muted-foreground">Cada código es único y expira automáticamente</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4" noValidate>
              {/* Roles */}
              <div className="space-y-2">
                <Label className="text-xs">Rol de acceso</Label>
                <div className="grid gap-2">
                  {ROLES.map((r) => (
                    <button key={r.value} type="button"
                      className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${role === r.value ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-foreground/30'}`}
                      onClick={() => setRole(r.value)}>
                      <div className="flex items-center justify-between">
                        <strong className="text-sm block">{r.label}</strong>
                        {role === r.value && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                            <Check size={12} className="text-primary-foreground" />
                          </span>
                        )}
                      </div>
                      <small className="text-xs text-muted-foreground">{r.hint}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer group">
                <span className="relative flex items-center justify-center">
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="peer sr-only" />
                  <span className="h-5 w-5 rounded border-2 border-border bg-background transition-colors peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                    {sendEmail && (
                      <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>
                    )}
                  </span>
                </span>
                Enviar invitación por correo
              </label>

              {sendEmail && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Correo del invitado</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Usos permitidos</Label>
                  <div className="relative"><select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 1 ? '1 uso' : `${n} usos`}</option>)}
                  </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Válido por</Label>
                  <div className="relative"><select value={expiresIn} onChange={(e) => setExpiresIn(Number(e.target.value))} className="flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {[1, 2, 4, 7, 14].map((n) => <option key={n} value={n}>{n === 1 ? '1 día' : `${n} días`}</option>)}
                  </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
                </div>
              </div>

              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Generar código de invitación
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><KeyRound size={18} /> Invitaciones generadas</CardTitle>
              <p className="text-xs text-muted-foreground">Todas las invitaciones con su estado actual</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative"><select value={filter} onChange={(e) => setFilter(e.target.value as 'active' | 'all')} className="h-9 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-xs font-medium"><option value="active">Solo activas</option><option value="all">Todas</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
              {completedCount > 0 && <Button variant="outline" size="sm" onClick={clearCompleted}><Trash2 size={14} /> Limpiar finalizadas</Button>}
              <Button variant="ghost" size="sm" onClick={() => void load()}><RotateCcw size={14} /> Refrescar</Button>
            </div>
          </CardHeader>
          <CardContent>
            {invitations === null ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin mr-2" /> Cargando invitaciones…</div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <KeyRound size={30} className="text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Aún no has creado invitaciones</p>
                <p className="text-xs text-muted-foreground mt-1">Usa el formulario para generar el primer código de acceso.</p>
              </div>
            ) : visibleInvitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center"><Check size={30} className="mb-3 text-green-500" /><p className="text-sm font-medium">No hay invitaciones en esta vista</p><p className="mt-1 text-xs text-muted-foreground">Las invitaciones finalizadas pueden consultarse seleccionando “Todas”.</p></div>
            ) : (
              <div className="max-h-[590px] space-y-3 overflow-y-auto pr-2">
                {visibleInvitations.map((inv) => {
                  const status = invitationStatus(inv)
                  return (
                    <div key={inv.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <button className="flex items-center gap-2 text-sm font-mono hover:text-primary transition-colors" title="Copiar código" onClick={() => void handleCopy(inv.code)}>
                          <span>{inv.code}</span>
                          {copied === inv.code ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-muted-foreground" />}
                        </button>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
                          {status === 'active' ? 'Activa' : status === 'used' ? 'Agotada' : 'Expirada'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {inv.email ? <span className="flex items-center gap-1"><Mail size={13} /> {inv.email}</span> : <span>Sin correo asociado</span>}
                        <span>Rol: {inv.role}</span>
                        <span>Usos: {inv.usedCount}/{inv.maxUses}</span>
                        <span className="flex items-center gap-1"><CalendarClock size={13} /> Expira: {formatDate(inv.expiresAt)}</span>
                      </div>

                      {status === 'active' && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleRevoke(inv.id)} disabled={revoking === inv.id}>
                          {revoking === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Revocar
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
