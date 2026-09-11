import { useEffect, useMemo, useState } from 'react'
import { Users, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { apiRequest } from '../../api/client'
import { useAuth } from '../../context/useAuth'
import { Separator } from '../../components/ui/separator'

interface User {
  id: string
  name: string
  email: string
  role: string
  permissions: Record<string, Record<string, boolean>>
}

/** Módulos y acciones de permiso, en el formato anidado que espera el backend. */
const PERMISSION_MODULES: { module: string; label: string; actions: { action: string; label: string }[] }[] = [
  { module: 'pipeline', label: 'Ventas / Pipeline', actions: [
    { action: 'view', label: 'Ver ventas' },
    { action: 'edit', label: 'Editar oportunidades' },
  ]},
  { module: 'ofertas', label: 'Ofertas', actions: [
    { action: 'view', label: 'Ver ofertas' },
    { action: 'edit', label: 'Crear y editar ofertas' },
  ]},
  { module: 'reportes', label: 'Reportes', actions: [
    { action: 'view', label: 'Ver reportes' },
  ]},
  { module: 'usuarios', label: 'Usuarios', actions: [
    { action: 'view', label: 'Ver usuarios' },
    { action: 'edit', label: 'Administrar usuarios' },
  ]},
  { module: 'datasets', label: 'Datos', actions: [
    { action: 'view', label: 'Ver estructura' },
    { action: 'edit', label: 'Procesar y limpiar datos' },
  ]},
  { module: 'solicitudes', label: 'Solicitudes comerciales', actions: [
    { action: 'view', label: 'Ver solicitudes' },
    { action: 'reply', label: 'Responder y agregar notas' },
    { action: 'manage', label: 'Cambiar estado y prioridad' },
  ]},
]

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  analyst: 'Analista',
  auditor: 'Auditor',
  user: 'Usuario',
}

type ModulePermissions = Record<string, Record<string, boolean>>

function fullPermissions(): ModulePermissions {
  const out: ModulePermissions = {}
  for (const mod of PERMISSION_MODULES) {
    out[mod.module] = {}
    for (const a of mod.actions) out[mod.module][a.action] = true
  }
  return out
}

/** Permisos que un rol trae por defecto (base para todo usuario nuevo). */
const ROLE_DEFAULT_PERMISSIONS: Record<string, ModulePermissions> = {
  superadmin: fullPermissions(),
  admin: fullPermissions(),
  analyst: {
    pipeline: { view: true, edit: true },
    ofertas: { view: true, edit: true },
    reportes: { view: true },
    datasets: { view: true, edit: true },
  },
  auditor: {
    pipeline: { view: true },
    ofertas: { view: true },
    reportes: { view: true },
    datasets: { view: true },
  },
  user: {
    pipeline: { view: true },
    reportes: { view: true },
  },
}

/**
 * Permisos efectivos de un usuario: los del rol por defecto + los overrides
 * guardados. Un `false` guardado sobreescribe el default activo y viceversa.
 */
function effectivePermissions(user: User): ModulePermissions {
  const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] ?? {}
  const stored = user.permissions ?? {}
  const modules = new Set([...Object.keys(defaults), ...Object.keys(stored)])
  const out: ModulePermissions = {}
  for (const module of modules) {
    out[module] = { ...(defaults[module] ?? {}), ...(stored[module] ?? {}) }
  }
  return out
}

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  superadmin: 'destructive',
  admin: 'default',
  analyst: 'secondary',
  auditor: 'outline',
  user: 'outline',
}

export default function Usuarios() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isSuperAdmin = me?.role === 'superadmin'
  const isAdmin = me?.role === 'superadmin' || me?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    apiRequest('/users')
      .then((data: unknown) => {
        const list = (data as { users?: User[] })?.users ?? (Array.isArray(data) ? (data as User[]) : [])
        setUsers(list)
      })
      .catch(() => setError('No se pudieron cargar los usuarios.'))
  }, [isAdmin])

  const editingUser = useMemo(() => users.find((u) => u.id === editingId) ?? null, [users, editingId])

  const editingPerms = useMemo(
    () => (editingUser ? effectivePermissions(editingUser) : {}),
    [editingUser],
  )

  const permissionCounts = useMemo(() => {
    let total = 0
    let active = 0
    for (const mod of PERMISSION_MODULES) {
      for (const a of mod.actions) {
        total += 1
        if (editingPerms[mod.module]?.[a.action] === true) active += 1
      }
    }
    return { total, active }
  }, [editingPerms])

  const canEdit = (u: User) => {
    if (isSuperAdmin) return u.email !== me?.email
    if (u.role === 'superadmin' || u.role === 'admin') return false
    return u.email !== me?.email
  }

  const hasPermission = (u: User, module: string, action: string) =>
    effectivePermissions(u)[module]?.[action] === true

  const togglePermission = async (userId: string, module: string, action: string, current: boolean) => {
    const target = users.find((u) => u.id === userId)
    if (!target) return
    const perms = effectivePermissions(target)
    const nextPerms = {
      ...perms,
      [module]: {
        ...(perms[module] ?? {}),
        [action]: !current,
      },
    }
    try {
      await apiRequest(`/users/${userId}/permissions`, { method: 'PUT', body: { permissions: nextPerms } })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, permissions: nextPerms } : u))
    } catch {
      setError('No se pudo actualizar el permiso.')
    }
  }

  const updateRole = async (userId: string, role: string) => {
    try {
      await apiRequest(`/users/${userId}/role`, { method: 'PUT', body: { role } })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u))
    } catch {
      setError('No se pudo actualizar el rol.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios y Permisos</h1>
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios y Permisos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona quién accede a cada módulo del CRM
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Usuarios registrados ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_COLORS[u.role] ?? 'outline'}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.email === me?.email ? 'default' : 'secondary'} className="text-[10px]">
                          {u.email === me?.email ? 'Tú' : 'Activo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && canEdit(u) && (
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(u.id === editingId ? null : u.id)}>
                            <Shield className="h-3.5 w-3.5" /> Permisos
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Permissions editor */}
        <Card className="h-fit sticky top-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {editingUser ? `Permisos de ${editingUser.name}` : 'Selecciona un usuario'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!editingUser ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Selecciona un usuario de la tabla y haz clic en "Permisos" para editar sus permisos.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={ROLE_COLORS[editingUser.role] ?? 'outline'}>
                    {ROLE_LABELS[editingUser.role] ?? editingUser.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {permissionCounts.active}/{permissionCounts.total} permisos activos
                  </span>
                </div>
                <Separator />
                <div className="space-y-4">
                  {PERMISSION_MODULES.map((mod) => (
                    <div key={mod.module} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold mb-2">{mod.label}</p>
                      <div className="space-y-2">
                        {mod.actions.map((a) => {
                          const current = hasPermission(editingUser, mod.module, a.action)
                          return (
                            <div key={a.action} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-muted-foreground">{a.label}</span>
                              <Switch
                                checked={current}
                                onCheckedChange={() => void togglePermission(editingUser.id, mod.module, a.action, current)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {isSuperAdmin && editingUser.role !== 'superadmin' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Cambiar rol</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1"
                        value={editingUser.role}
                        onChange={(e) => void updateRole(editingUser.id, e.target.value)}
                      >
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
