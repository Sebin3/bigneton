import { useState } from 'react'
import { User, Bell, Shield, Database, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Separator } from '../../components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useAuth } from '../../context/useAuth'

export default function Configuracion() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administra tu perfil, notificaciones y preferencias del sistema
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfil" className="gap-1.5"><User className="h-3.5 w-3.5" /> Perfil</TabsTrigger>
          <TabsTrigger value="notificaciones" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notificaciones</TabsTrigger>
          <TabsTrigger value="seguridad" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Seguridad</TabsTrigger>
          <TabsTrigger value="sistema" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información personal</CardTitle>
              <CardDescription>Actualiza tu nombre y correo electrónico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Input value={user?.role ?? 'user'} disabled />
                <p className="text-xs text-muted-foreground">El rol lo asigna un administrador</p>
              </div>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4" /> {saved ? 'Guardado' : 'Guardar cambios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificaciones">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferencias de notificación</CardTitle>
              <CardDescription>Controla qué alertas recibes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {[
                { label: 'Nuevos datasets procesados', desc: 'Recibe aviso cuando se carguen datos' },
                { label: 'Cambios en el pipeline', desc: 'Alerta cuando una oportunidad cambie de etapa' },
                { label: 'Reportes semanales', desc: 'Resumen automático cada lunes' },
                { label: 'Invitaciones pendientes', desc: 'Aviso cuando alguien sea invitado' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguridad">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguridad de la cuenta</CardTitle>
              <CardDescription>Gestiona tu contraseña y sesiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Cambiar contraseña</Label>
                <Input type="password" placeholder="Nueva contraseña" />
                <Input type="password" placeholder="Confirmar contraseña" />
              </div>
              <Button variant="outline">Actualizar contraseña</Button>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Sesiones activas</p>
                <p className="text-xs text-muted-foreground">Tu sesión actual es la única activa</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferencias del sistema</CardTitle>
              <CardDescription>Configuración general del CRM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Modo oscuro</p>
                  <p className="text-xs text-muted-foreground">Cambia el tema de la interfaz</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Idioma</p>
                  <p className="text-xs text-muted-foreground">Idioma de la interfaz</p>
                </div>
                <span className="text-sm text-muted-foreground">Español</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Zona horaria</p>
                  <p className="text-xs text-muted-foreground">Para fechas y horas</p>
                </div>
                <span className="text-sm text-muted-foreground">Ciudad de México (GMT-6)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
