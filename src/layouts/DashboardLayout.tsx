import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BadgePercent,
  Bell,
  ChartColumn,
  ChevronDown,
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
import UserAvatar from '../components/UserAvatar'
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
        <Logo to="/dashboard" compact={collapsed} />
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

      <div className={cn('border-t border-border bg-muted/25 p-3 space-y-2', collapsed && 'px-2')}>
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

        <div className={cn('flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm', collapsed && 'justify-center border-transparent bg-transparent px-0 shadow-none')}>
          <UserAvatar name={user?.name} src={user?.avatarUrl} className="h-9 w-9 rounded-full shadow-sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleLogout} title="Cerrar sesión">
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
        {SidebarContent()}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
          <button className="lg:hidden p-1.5 rounded-md hover:bg-muted" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-lg">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-2">
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
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-2 py-1.5 transition-colors',
                  userMenuOpen ? 'border-border bg-muted' : 'border-transparent hover:border-border hover:bg-muted'
                )}
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <UserAvatar name={user?.name} src={user?.avatarUrl} className="h-8 w-8 rounded-full" />
                <span className="hidden md:flex max-w-[170px] flex-col items-start leading-tight">
                  <strong className="w-full truncate text-sm font-semibold">{user?.name}</strong>
                  <small className="text-[10px] uppercase tracking-wide text-muted-foreground">{user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Administrador' : user?.role ?? 'Usuario'}</small>
                </span>
                <ChevronDown size={15} className={cn('hidden text-muted-foreground transition-transform md:block', userMenuOpen && 'rotate-180')} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_18px_50px_rgba(15,23,42,0.16)]" role="menu">
                  <div className="bg-primary/[0.06] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user?.name} src={user?.avatarUrl} className="h-11 w-11 rounded-xl shadow-sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard/configuracion') }}
                      role="menuitem"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Settings size={16} /></span>
                      <span><span className="block font-medium">Configuración</span><span className="block text-xs text-muted-foreground">Perfil, seguridad y preferencias</span></span>
                    </button>
                    <div className="my-2 h-px bg-border" />
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10"><LogOut size={16} /></span>
                      <span className="font-medium">Cerrar sesión</span>
                    </button>
                  </div>
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
