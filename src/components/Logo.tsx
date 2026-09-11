import { Database } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Logo.css'

interface LogoProps {
  to?: string
  variant?: 'dark' | 'light'
  compact?: boolean
}

export default function Logo({ to = '/', variant = 'dark', compact = false }: LogoProps) {
  return (
    <Link
      to={to}
      className={`logo logo--${variant}${compact ? ' logo--compact' : ''}`}
      aria-label={compact ? 'Ir al panel principal' : undefined}
      title={compact ? 'BigData' : undefined}
    >
      <span className="logo__icon">
        <Database size={20} strokeWidth={2.2} />
      </span>
      <span className="logo__text" aria-hidden={compact || undefined}>
        Big<b>Data</b>
      </span>
    </Link>
  )
}
