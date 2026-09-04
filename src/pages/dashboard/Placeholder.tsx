import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import './Placeholder.css'

interface PlaceholderProps {
  title: string
  description: string
  icon: LucideIcon
}

export default function Placeholder({ title, description, icon: Icon }: PlaceholderProps) {
  return (
    <div className="placeholder">
      <div className="placeholder__card">
        <span className="placeholder__icon">
          <Icon size={30} strokeWidth={1.8} />
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link to="/dashboard" className="btn btn--primary">
          <ArrowLeft size={17} /> Volver al panel
        </Link>
      </div>
    </div>
  )
}
