interface UserAvatarProps {
  name?: string | null
  src?: string | null
  className?: string
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'
}

export default function UserAvatar({ name, src, className = '' }: UserAvatarProps) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-primary text-xs font-bold text-primary-foreground ${className}`}>
      {src ? <img src={src} alt={`Foto de ${name || 'usuario'}`} className="absolute inset-0 h-full w-full object-cover" /> : initials(name || 'Usuario')}
    </span>
  )
}
