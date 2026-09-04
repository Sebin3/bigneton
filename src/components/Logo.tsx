import { Database } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Logo.css'

interface LogoProps {
  to?: string
  variant?: 'dark' | 'light'
}

export default function Logo({ to = '/', variant = 'dark' }: LogoProps) {
  return (
    <Link to={to} className={`logo logo--${variant}`}>
      <span className="logo__icon">
        <Database size={20} strokeWidth={2.2} />
      </span>
      <span className="logo__text">
        Big<b>Data</b>
      </span>
    </Link>
  )
}
