import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Bell, Building2, Camera, Check, Database, KeyRound, LockKeyhole, Mail, Save, ShieldCheck, Trash2, User, UserCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useAuth } from '../../context/useAuth'
import { apiChangePassword, apiGetProfile, apiUpdateProfile } from '../../api/profile'
import './Configuracion.css'
import './AvatarUpload.css'
import UserAvatar from '../../components/UserAvatar'

const PREFS_KEY = 'crm_user_preferences'
const DEFAULT_PREFS = { requests: true, datasets: true, pipeline: true, weekly: false }

async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.')
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen no puede pesar más de 8 MB.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.82)
}

export default function Configuracion() {
  const { user, updateSession } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [company, setCompany] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } }
    catch { return DEFAULT_PREFS }
  })

  useEffect(() => {
    void apiGetProfile().then((profile) => {
      setName(profile.name)
      setCompany(profile.company ?? '')
      setAvatarUrl(profile.avatarUrl ?? '')
    }).catch(() => setMessage({ tone: 'error', text: 'No se pudo cargar el perfil.' })).finally(() => setProfileLoading(false))
  }, [])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) { setMessage({ tone: 'error', text: 'El nombre no puede estar vacío.' }); return }
    setSaving(true); setMessage(null)
    try {
      const profile = await apiUpdateProfile({ name: name.trim(), company: company.trim(), avatarUrl: avatarUrl.trim() || null })
      updateSession({ name: profile.name, avatarUrl: profile.avatarUrl })
      setMessage({ tone: 'ok', text: 'Perfil actualizado correctamente.' })
    } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el perfil.' }) }
    finally { setSaving(false) }
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setMessage(null)
    if (passwords.next.length < 6) { setMessage({ tone: 'error', text: 'La contraseña nueva debe tener al menos 6 caracteres.' }); return }
    if (passwords.next !== passwords.confirm) { setMessage({ tone: 'error', text: 'Las contraseñas nuevas no coinciden.' }); return }
    setChangingPassword(true)
    try {
      await apiChangePassword(passwords.current, passwords.next)
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage({ tone: 'ok', text: 'Contraseña actualizada correctamente.' })
    } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.' }) }
    finally { setChangingPassword(false) }
  }

  const updatePreference = (key: keyof typeof DEFAULT_PREFS, checked: boolean) => {
    const next = { ...prefs, [key]: checked }
    setPrefs(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setMessage(null)
    try { setAvatarUrl(await prepareAvatar(file)) }
    catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo procesar la imagen.' }) }
    finally { event.target.value = '' }
  }

  return (
    <div className="settings-page">
      <header className="settings-heading">
        <div><span className="settings-eyebrow">Cuenta y preferencias</span><h1>Configuración</h1><p>Personaliza tu perfil, seguridad y experiencia en BigData.</p></div>
        <div className="settings-status"><ShieldCheck size={18} /><div><strong>Cuenta protegida</strong><small>Sesión verificada con OTP</small></div></div>
      </header>

      <section className="settings-profile-card">
        <div className="settings-avatar-wrap"><UserAvatar name={name || user?.name} src={avatarUrl} className="settings-avatar" /><label className="settings-avatar-action" title="Subir foto"><Camera size={15} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectAvatar(event)} /></label></div>
        <div className="settings-profile-copy"><h2>{name || user?.name}</h2><p>{user?.email}</p><div><span>{user?.role === 'superadmin' ? 'Super administrador' : user?.role === 'admin' ? 'Administrador' : user?.role ?? 'Usuario'}</span>{company && <span>{company}</span>}</div></div>
        <div className="settings-profile-meta"><small>ESTADO DE LA CUENTA</small><strong><i /> Activa</strong></div>
      </section>

      {message && <div className={`settings-message is-${message.tone}`} role="status">{message.tone === 'ok' ? <Check size={17} /> : <ShieldCheck size={17} />}{message.text}</div>}

      <Tabs defaultValue="perfil" className="settings-tabs">
        <TabsList className="settings-tabs__list">
          <TabsTrigger value="perfil"><User size={16} /> Perfil</TabsTrigger>
          <TabsTrigger value="notificaciones"><Bell size={16} /> Notificaciones</TabsTrigger>
          <TabsTrigger value="seguridad"><LockKeyhole size={16} /> Seguridad</TabsTrigger>
          <TabsTrigger value="sistema"><Database size={16} /> Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="settings-panel">
          <div className="settings-panel__intro"><UserCircle2 size={22} /><div><h3>Información personal</h3><p>Estos datos se muestran en tu sesión y al resto del equipo.</p></div></div>
          <form onSubmit={saveProfile} className="settings-form">
            <div className="settings-field"><Label htmlFor="settings-name">Nombre completo</Label><div className="settings-input"><User size={16} /><Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} disabled={profileLoading} /></div></div>
            <div className="settings-field"><Label>Correo de acceso</Label><div className="settings-input"><Mail size={16} /><Input value={user?.email ?? ''} disabled /></div><small>El correo de acceso no puede modificarse desde esta sección.</small></div>
            <div className="settings-field"><Label htmlFor="settings-company">Empresa</Label><div className="settings-input"><Building2 size={16} /><Input id="settings-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de tu empresa" disabled={profileLoading} /></div></div>
            <div className="settings-field"><Label>Foto de perfil</Label><div className="settings-avatar-controls"><label className="settings-upload-button"><Camera size={16} /> Elegir imagen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectAvatar(event)} disabled={profileLoading} /></label>{avatarUrl && <Button type="button" variant="outline" onClick={() => setAvatarUrl('')}><Trash2 size={15} /> Quitar</Button>}</div><small>Formatos JPG, PNG o WebP, máximo 8 MB. Se ajustará automáticamente.</small></div>
            <div className="settings-form__footer"><p>Los cambios se reflejarán inmediatamente en el panel.</p><Button type="submit" disabled={saving || profileLoading}><Save size={16} />{saving ? 'Guardando…' : 'Guardar perfil'}</Button></div>
          </form>
        </TabsContent>

        <TabsContent value="notificaciones" className="settings-panel">
          <div className="settings-panel__intro"><Bell size={22} /><div><h3>Centro de notificaciones</h3><p>Elige qué actividad quieres priorizar dentro del panel.</p></div></div>
          <div className="settings-options">
            {[
              ['requests', 'Nuevas solicitudes', 'Avisos cuando un prospecto complete el formulario del landing.'],
              ['datasets', 'Actividad de datasets', 'Confirmaciones de cargas, análisis y procesos de limpieza.'],
              ['pipeline', 'Cambios en ventas', 'Movimientos importantes dentro del pipeline comercial.'],
              ['weekly', 'Resumen semanal', 'Un resumen compacto de la actividad cada semana.'],
            ].map(([key, title, description]) => <div className="settings-option" key={key}><div><strong>{title}</strong><p>{description}</p></div><Switch checked={Boolean(prefs[key as keyof typeof prefs])} onCheckedChange={(checked) => updatePreference(key as keyof typeof DEFAULT_PREFS, checked)} /></div>)}
          </div>
        </TabsContent>

        <TabsContent value="seguridad" className="settings-grid">
          <form className="settings-panel" onSubmit={changePassword}>
            <div className="settings-panel__intro"><KeyRound size={22} /><div><h3>Cambiar contraseña</h3><p>Usa una contraseña única de al menos seis caracteres.</p></div></div>
            <div className="settings-form settings-form--single">
              <div className="settings-field"><Label>Contraseña actual</Label><Input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></div>
              <div className="settings-field"><Label>Nueva contraseña</Label><Input type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></div>
              <div className="settings-field"><Label>Confirmar contraseña</Label><Input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></div>
              <Button type="submit" disabled={changingPassword}>{changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}</Button>
            </div>
          </form>
          <aside className="settings-security-note"><ShieldCheck size={26} /><h3>Seguridad de la cuenta</h3><p>Tu inicio de sesión utiliza contraseña, validación OTP y una sesión firmada por el servidor.</p><ul><li><Check size={14} /> Código temporal por correo</li><li><Check size={14} /> Sesión protegida con JWT</li><li><Check size={14} /> Contraseña almacenada con hash</li></ul></aside>
        </TabsContent>

        <TabsContent value="sistema" className="settings-panel">
          <div className="settings-panel__intro"><Database size={22} /><div><h3>Información del sistema</h3><p>Preferencias regionales y detalles de la aplicación.</p></div></div>
          <div className="settings-system-grid"><div><small>IDIOMA</small><strong>Español</strong><p>Idioma principal de la interfaz.</p></div><div><small>ZONA HORARIA</small><strong>America/Lima</strong><p>UTC-5 para fechas y registros.</p></div><div><small>APLICACIÓN</small><strong>BigData CRM</strong><p>Panel de análisis comercial.</p></div><div><small>SESIÓN</small><strong>Verificada</strong><p>Conexión activa con el backend.</p></div></div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
