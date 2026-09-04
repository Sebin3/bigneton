import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  KeyRound,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Database,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import './Login.css'

type Mode = 'login' | 'register'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const HIGHLIGHTS = [
  { icon: Database, text: 'Perfilado de millones de registros al instante' },
  { icon: ShieldCheck, text: 'Acceso protegido con verificación OTP' },
  { icon: BarChart3, text: 'Panel ejecutivo con analítica clara' },
]

export default function Login() {
  const { startLogin, startRegister, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlCode = searchParams.get('code') ?? ''
  const [mode, setMode] = useState<Mode>(() => (urlCode ? 'register' : 'login'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(urlCode)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const googleInitRef = useRef(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const w = window as unknown as {
      google?: { accounts?: { id?: { initialize: (opts: Record<string, unknown>) => void; prompt: () => void } } }
    }
    const google = w.google
    if (!google?.accounts?.id) return
    if (googleInitRef.current) return
    googleInitRef.current = true

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) return
        setGoogleBusy(true)
        setError('')
        try {
          await googleLogin(response.credential)
          navigate('/dashboard', { replace: true })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.')
        } finally {
          setGoogleBusy(false)
        }
      },
    })
  }, [googleLogin, navigate])

  const handleGoogle = () => {
    setError('')
    const w = window as unknown as {
      google?: { accounts?: { id?: { prompt: () => void } } }
    }
    if (!w.google?.accounts?.id) {
      setError('Google no está disponible. Recarga la página.')
      return
    }
    w.google.accounts.id.prompt()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await startLogin(email, password)
      } else {
        if (!name.trim()) throw new Error('Escribe tu nombre para continuar.')
        if (password.length < 6)
          throw new Error('La contraseña debe tener al menos 6 caracteres.')
        if (!inviteCode.trim())
          throw new Error('Necesitas un código de invitación para registrarte.')
        await startRegister(name, email, password, inviteCode.trim())
      }
      navigate('/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <Logo variant="light" />
        <div className="auth__aside-body">
          <h2>
            Vuelve al centro de <span>control de tus datos</span>
          </h2>
          <p>
            Conecta con tu espacio de análisis y sigue explorando el Big Data
            que impulsa las decisiones de tu empresa.
          </p>
          <ul className="auth__highlights">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="auth__highlight-icon">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth__aside-glow" aria-hidden="true" />
      </aside>

      <main className="auth__main">
        <div className="auth__theme">
          <ThemeToggle />
        </div>

        <div className="auth__card">
          <div className="auth__head">
            <h1>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
            <p>
              {mode === 'login'
                ? 'Ingresa tus credenciales para acceder al dashboard.'
                : 'Usa tu código de invitación para crear tu cuenta y analizar tus datos.'}
            </p>
          </div>

          <div className="auth__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => {
                setMode('login')
                setError('')
              }}
            >
              Iniciar sesión
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => {
                setMode('register')
                setError('')
              }}
            >
              Registrarme
            </button>
          </div>

          {GOOGLE_CLIENT_ID && (
            <>
              <button
                type="button"
                className="auth__google"
                onClick={handleGoogle}
                disabled={googleBusy}
              >
                {googleBusy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="auth__divider">
                <span>o continúa con tu correo</span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <label className="field">
                <span>Nombre completo</span>
                <div className="field__control">
                  <UserIcon size={18} className="field__icon" />
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            {mode === 'register' && (
              <label className="field">
                <span>Código de invitación</span>
                <div className="field__control">
                  <KeyRound size={18} className="field__icon" />
                  <input
                    type="text"
                    placeholder="INV-XXXX-XXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <small className="field__hint">
                  Lo enviamos por correo al invitarte.
                </small>
              </label>
            )}

            <label className="field">
              <span>Correo electrónico</span>
              <div className="field__control">
                <Mail size={18} className="field__icon" />
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="field">
              <span>Contraseña</span>
              <div className="field__control">
                <Lock size={18} className="field__icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                />
                <button
                  type="button"
                  className="field__toggle"
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <p className="auth__error">{error}</p>}

            <button
              type="submit"
              className="btn btn--primary btn--lg auth__submit"
              disabled={busy}
            >
              {busy && <Loader2 size={18} className="spin" />}
              {mode === 'login' ? 'Entrar al dashboard' : 'Crear cuenta'}
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="auth__foot">
            <Link to="/">← Volver al inicio</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
