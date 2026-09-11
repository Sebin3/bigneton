import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BadgePercent,
  Bell,
  ChartColumn,
  ChevronLeft,
  Clock,
  Columns3,
  Eraser,
  FileBarChart,
  FileUp,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Target,
  MessagesSquare,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import GlobalSearch from '../components/GlobalSearch'
import { cn } from '../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Panel General',
    items: [
      { to: '/dashboard', label: 'Principal', icon: LayoutDashboard, end: true },
      { to: '/dashboard/reportes', label: 'Reportes', icon: FileBarChart },
    ],
  },
  {
    title: 'Gestión de Datos',
    items: [
      { to: '/dashboard/procesar', label: 'Procesar Datos', icon: FileUp },
      { to: '/dashboard/estructura', label: 'Estructura', icon: Columns3 },
      { to: '/dashboard/graficos', label: 'Gráficos', icon: ChartColumn },
      { to: '/dashboard/limpieza', label: 'Limpieza de Datos', icon: Eraser },
      { to: '/dashboard/historial', label: 'Historial', icon: History },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { to: '/dashboard/pipeline', label: 'Pipeline de Ventas', icon: Target },
      { to: '/dashboard/ofertas', label: 'Ofertas y Promos', icon: BadgePercent },
    ],
  },
]

const ADMIN_GROUP = {
  title: 'Administración',
  items: [
    { to: '/dashboard/usuarios', label: 'Usuarios y Permisos', icon: Users },
    { to: '/dashboard/invitaciones', label: 'Invitaciones', icon: KeyRound },
    { to: '/dashboard/solicitudes', label: 'Solicitudes', icon: MessagesSquare },
  ] as NavItem[],
}

const BOTTOM_ITEMS: NavItem[] = [
  { to: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
]
const HELP_ITEM: NavItem = { to: '/dashboard/ayuda', label: 'Ayuda y soporte', icon: LifeBuoy }
const COLLAPSE_KEY = 'crm_sidebar_collapsed'

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return {
    time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    date: now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { time, date } = useClock()
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const canViewRequests = isAdmin || user?.permissions?.solicitudes?.view === true

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') }, [collapsed])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  const renderLink = ({ to, label, icon: Icon, end }: NavItem) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed && 'justify-center px-0 py-2'
      )}
    >
      <Icon size={20} strokeWidth={1.8} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 z-50 hidden group-hover:block whitespace-nowrap rounded-md bg-popover border px-3 py-1.5 text-sm font-medium shadow-md">
          {label}
        </span>
      )}
    </NavLink>
  )

  const SidebarContent = () => (
    <>
      <div className={cn('flex items-center gap-2 p-4', collapsed && 'justify-center p-3')}>
        <Logo to="/dashboard" />
        <button className="lg:hidden ml-auto p-1 rounded-md hover:bg-muted" onClick={() => setMobileOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!collapsed && <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>}
            <div className="space-y-0.5">{group.items.map(renderLink)}</div>
          </div>
        ))}
        {(isAdmin || canViewRequests) && (
          <div>
            {!collapsed && <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ADMIN_GROUP.title}</p>}
            <div className="space-y-0.5">{ADMIN_GROUP.items.filter((item) => item.to !== '/dashboard/solicitudes' || canViewRequests).map(renderLink)}</div>
          </div>
        )}
        <div className="border-t border-border pt-4 space-y-0.5">
          {!collapsed && <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Soporte</p>}
          {renderLink(HELP_ITEM)}
          {BOTTOM_ITEMS.map(renderLink)}
        </div>
      </nav>

      <div className={cn('border-t border-border p-3 space-y-2', collapsed && 'px-2')}>
        <button
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors',
            collapsed && 'justify-center px-0'
          )}
          onClick={() => setCollapsed((v) => !v)}
        >
          <ChevronLeft size={18} className={cn('transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Colapsar</span>}
        </button>

        <div className={cn('flex items-center gap-2.5 rounded-lg p-2', collapsed && 'justify-center')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials(user?.name ?? 'U')}
          </span>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 lg:static lg:z-auto',
        collapsed ? 'w-[72px]' : 'w-[264px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
          <button className="lg:hidden p-1.5 rounded-md hover:bg-muted" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-lg">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground font-medium tabular-nums">
              <Clock size={14} />
              <span>{time}</span>
              <span className="text-border">·</span>
              <span>{date}</span>
            </div>

            <ThemeToggle />

            <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted transition-colors"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {initials(user?.name ?? 'U')}
                </span>
                <span className="hidden md:block text-sm font-medium">{user?.name}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1.5 shadow-lg z-50">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
