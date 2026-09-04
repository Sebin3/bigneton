import { useState } from 'react'
import { ChevronDown, BookOpen, Command, ContactRound, Keyboard, Mail, MessageCircleQuestion, ShieldCheck, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

interface Faq { q: string; a: string }

const FAQS: Faq[] = [
  { q: '¿Cómo cargo un archivo CSV?', a: 'Ve a "Procesar Datos", arrastra o selecciona tu archivo CSV. El sistema detectará el delimitador y columnas automáticamente, te mostrará una vista previa y podrás confirmar antes de guardarlo.' },
  { q: '¿Qué significa "completitud" de los datos?', a: 'La completitud mide el porcentaje de celdas con información válida frente al total de celdas del dataset. Un valor cercano a 100% indica datos más completos y confiables.' },
  { q: '¿Cómo funciona la limpieza de datos?', a: 'La limpieza elimina filas duplicadas y normaliza valores inconsistentes. Puedes ejecutarla desde "Limpieza de Datos", y siempre se guarda una copia de seguridad para que no pierdas la versión original.' },
  { q: '¿Qué son las ofertas y el pipeline de ventas?', a: 'El módulo de Ofertas te permite cargar y medir campañas con inversión, ingresos y traslape. El Pipeline de Ventas organiza tus oportunidades por etapa (visitante, lead, oportunidad, cierre) para proyectar montos.' },
  { q: '¿Cómo invito a compañeros de equipo?', a: 'Navega a "Invitaciones" en el menú de Administración. Genera un código de invitación único, llénalo con el rol y correo del invitado, y compártelo. Cada código solo puede usarse la cantidad de veces que configures.' },
  { q: '¿Por qué se borran mis invitaciones si expiran?', a: 'Las invitaciones tienen una fecha de expiración (por defecto 4 días). Pasada esa fecha ya no pueden usarse y se marcan como inactivas para proteger el acceso a tu espacio.' },
]

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Abrir búsqueda global' },
  { keys: ['Esc'], label: 'Cerrar menús y búsqueda' },
  { keys: ['←', '→'], label: 'Navegar resultados de búsqueda' },
  { keys: ['Enter'], label: 'Seleccionar resultado' },
]

export default function Ayuda() {
  const [open, setOpen] = useState<number | null>(0)
  const toggle = (i: number) => setOpen((v) => (v === i ? null : i))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ayuda y soporte</h1>
        <p className="text-sm text-muted-foreground mt-1">Encuentra respuestas rápidas, atajos del panel y formas de contactarnos.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MessageCircleQuestion size={18} /> Preguntas frecuentes</CardTitle>
            <p className="text-xs text-muted-foreground">Las dudas más comunes sobre el análisis de datos</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-lg border overflow-hidden">
                <button className="flex w-full items-center justify-between px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors" onClick={() => toggle(i)}>
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Keyboard size={17} /> Atajos del teclado</CardTitle>
              <p className="text-xs text-muted-foreground">Navega más rápido por tu panel</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {SHORTCUTS.map((s) => (
                  <li key={s.label} className="flex items-center justify-between text-sm">
                    <span className="flex gap-1">
                      {s.keys.map((k) => <kbd key={k} className="px-2 py-0.5 rounded bg-muted border text-xs font-mono">{k}</kbd>)}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Getting started */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><BookOpen size={17} /> Empezar aquí</CardTitle>
              <p className="text-xs text-muted-foreground">Ruta sugerida para nuevos usuarios</p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[
                  { icon: Sparkles, title: '1. Procesa tu primer CSV', desc: 'Sube un archivo desde "Procesar Datos".' },
                  { icon: ShieldCheck, title: '2. Revisa estructura y limpieza', desc: 'Inspecciona columnas y elimina duplicados.' },
                  { icon: Command, title: '3. Visualiza con gráficos', desc: 'Explora tendencias en "Gráficos".' },
                ].map((s) => (
                  <li key={s.title} className="flex items-start gap-2.5">
                    <s.icon size={15} className="mt-0.5 text-primary shrink-0" />
                    <div>
                      <strong className="block text-xs">{s.title}</strong>
                      <span className="text-xs text-muted-foreground">{s.desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><ContactRound size={17} /> ¿Necesitas más ayuda?</CardTitle>
              <p className="text-xs text-muted-foreground">Nuestro equipo está disponible</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Escríbenos a nuestro correo de soporte y te responderemos a la brevedad.</p>
              <a href="mailto:soporte@sendaqulm.com"><Button className="w-full"><Mail size={16} /> Contactar soporte</Button></a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
