import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Database,
  LayoutDashboard,
  Search,
  CornerDownLeft,
} from 'lucide-react'
import { useData } from '../context/useData'
import './GlobalSearch.css'

interface PageEntry {
  to: string
  label: string
  keywords: string
}

const PAGES: PageEntry[] = [
  { to: '/dashboard', label: 'Principal', keywords: 'inicio panel dashboard resumen' },
  { to: '/dashboard/procesar', label: 'Procesar Datos', keywords: 'subir cargar csv importar archivo' },
  { to: '/dashboard/estructura', label: 'Estructura', keywords: 'columnas esquema esquema tabla' },
  { to: '/dashboard/graficos', label: 'Gráficos', keywords: 'charts visualizaciones graficas' },
  { to: '/dashboard/limpieza', label: 'Limpieza de Datos', keywords: 'limpiar calidad duplicados valores faltantes' },
  { to: '/dashboard/historial', label: 'Historial de Datos', keywords: 'datasets archivos previos' },
  { to: '/dashboard/pipeline', label: 'Pipeline de Ventas', keywords: 'ventas embudo funnel crm' },
  { to: '/dashboard/ofertas', label: 'Ofertas y Promos', keywords: 'promociones descuentos impacto' },
  { to: '/dashboard/configuracion', label: 'Configuración', keywords: 'ajustes perfil cuenta' },
  { to: '/dashboard/ayuda', label: 'Ayuda y soporte', keywords: 'guia ayuda contacto soporte' },
  { to: '/dashboard/reportes', label: 'Reportes', keywords: 'resumen exportar imprimir pdf csv' },
  { to: '/dashboard/usuarios', label: 'Usuarios y Permisos', keywords: 'miembros roles equipo permisos' },
  { to: '/dashboard/invitaciones', label: 'Invitaciones', keywords: 'codigos acceso invitar equipo' },
]

export default function GlobalSearch() {
  const navigate = useNavigate()
  const { history, restoreFromHistory } = useData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const openSearch = useCallback(() => {
    setQuery('')
    setHighlight(0)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { pages: [], datasets: [] }

    const pages = PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    )

    const datasets = history
      .filter((h) => h.fileName.toLowerCase().includes(q))
      .slice(0, 6)

    return { pages, datasets }
  }, [query, history])

  const flat = useMemo(
    () => [...results.pages, ...results.datasets],
    [results],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) setOpen(false)
        else openSearch()
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openSearch])

  const navigateTo = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  const openDataset = async (id: string) => {
    setOpen(false)
    await restoreFromHistory(id)
    navigate('/dashboard/estructura')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[highlight]
      if (item) {
        if ('to' in item) navigateTo(item.to)
        else void openDataset(item.id)
      }
    }
  }

  const hasResults = results.pages.length > 0 || results.datasets.length > 0

  return (
    <>
      <button
        className="topbar__search"
        type="button"
        aria-label="Buscar en el panel"
        onClick={openSearch}
      >
        <Search size={18} className="topbar__search-icon" />
        <span className="topbar__search-ph">Buscar en el panel…</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="search-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="search-box" ref={boxRef}>
            <div className="search-box__input-row">
              <Search size={18} className="search-box__icon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
                onKeyDown={onKeyDown}
                placeholder="Busca páginas o datasets…"
              />
              <button
                className="search-box__close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar búsqueda"
              >
                Esc
              </button>
            </div>

            {!query && (
              <div className="search-box__hint">
                Escribe para buscar entre las secciones y tus datasets.
              </div>
            )}

            {query && !hasResults && (
              <div className="search-box__empty">Sin resultados para “{query}”.</div>
            )}

            {query && hasResults && (
              <div className="search-box__results">
                {results.pages.length > 0 && (
                  <div className="search-box__group">
                    <p className="search-box__group-label">Secciones</p>
                    {results.pages.map((p, i) => (
                      <button
                        key={p.to}
                        className={`search-box__item ${i === highlight ? 'is-highlight' : ''}`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => navigateTo(p.to)}
                      >
                        <span className="search-box__item-icon search-box__item-icon--page">
                          <LayoutDashboard size={16} />
                        </span>
                        <span className="search-box__item-label">{p.label}</span>
                        <ArrowRight size={15} className="search-box__item-go" />
                      </button>
                    ))}
                  </div>
                )}

                {results.datasets.length > 0 && (
                  <div className="search-box__group">
                    <p className="search-box__group-label">Datasets</p>
                    {results.datasets.map((d, i) => {
                      const idx = results.pages.length + i
                      return (
                        <button
                          key={d.id}
                          className={`search-box__item ${idx === highlight ? 'is-highlight' : ''}`}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => void openDataset(d.id)}
                        >
                          <span className="search-box__item-icon">
                            <FilesIcon />
                          </span>
                          <span className="search-box__item-file">
                            {d.fileName}
                            <small>
                              {d.rowCount.toLocaleString()} filas · {d.columnCount} columnas
                            </small>
                          </span>
                          <span className="search-box__item-enter">
                            <CornerDownLeft size={13} />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function FilesIcon() {
  return <Database size={16} />
}
