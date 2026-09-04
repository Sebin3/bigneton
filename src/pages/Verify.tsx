import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  MailCheck,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import Logo from '../components/Logo'
import './Verify.css'

const CODE_LENGTH = 6
const RESEND_SECONDS = 30

export default function Verify() {
  const { pending, verifyOtp, resendOtp, cancelVerification } = useAuth()
  const navigate = useNavigate()

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const [resent, setResent] = useState(false)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (seconds === 0) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  if (!pending) {
    return (
      <div className="verify">
        <div className="verify__card">
          <Logo />
          <h1>Verificación no encontrada</h1>
          <p>Parece que esta sesión de verificación ya expiró.</p>
          <Link to="/login" className="btn btn--primary">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  const attemptVerify = async (code: string) => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await verifyOtp(code)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código.')
      setBusy(false)
    }
  }

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '')
    setDigits((prev) => {
      const next = [...prev]
      if (!clean) {
        next[index] = ''
        return next
      }
      const chars = clean.split('')
      for (let k = 0; k < chars.length && index + k < CODE_LENGTH; k++) {
        next[index + k] = chars[k]
      }
      return next
    })
    const target = Math.min(index + Math.max(clean.length, 1), CODE_LENGTH - 1)
    inputsRef.current[target]?.focus()
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      setDigits((prev) => {
        const next = [...prev]
        if (next[index]) {
          next[index] = ''
        } else if (index > 0) {
          next[index - 1] = ''
          inputsRef.current[index - 1]?.focus()
        }
        return next
      })
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ''))
    inputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < CODE_LENGTH) {
      setError('Escribe los 6 dígitos del código para continuar.')
      return
    }
    void attemptVerify(code)
  }

  const handleResend = async () => {
    setError('')
    try {
      await resendOtp()
      setDigits(Array(CODE_LENGTH).fill(''))
      setSeconds(RESEND_SECONDS)
      setResent(true)
      setTimeout(() => setResent(false), 3500)
      inputsRef.current[0]?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el código.')
    }
  }

  const handleCancel = () => {
    cancelVerification()
    navigate('/login', { replace: true })
  }

  return (
    <div className="verify">
      <header className="verify__top">
        <Logo to="/" />
        <button className="verify__back" onClick={handleCancel}>
          <ArrowLeft size={16} /> Cancelar
        </button>
      </header>

      <main className="verify__main">
        <div className="verify__card">
          <span className="verify__icon">
            <MailCheck size={26} strokeWidth={2} />
          </span>
          <h1>Verifica tu identidad</h1>
          <p>
            Enviamos un código de <strong>6 dígitos</strong> a{' '}
            <strong>{pending.email}</strong>. Escríbelo abajo para continuar.
          </p>

          <div className="verify__demo">
            <ShieldCheck size={15} />
            <span>Revisa tu bandeja de entrada para obtener el código</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`otp ${error ? 'otp--error' : ''}`}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  aria-label={`Dígito ${i + 1}`}
                />
              ))}
            </div>

            {error && <p className="verify__error">{error}</p>}

            <button
              type="submit"
              className="btn btn--primary btn--lg verify__submit"
              disabled={digits.join('').length < CODE_LENGTH || busy}
            >
              {busy && <Loader2 size={18} className="spin" />}
              <ShieldCheck size={18} /> Verificar código
            </button>
          </form>

          <div className="verify__resend">
            {seconds > 0 ? (
              <span>
                Puedes solicitar un nuevo código en{' '}
                <b>
                  00:{seconds.toString().padStart(2, '0')}
                </b>
              </span>
            ) : (
              <button className="verify__resend-btn" onClick={handleResend}>
                <RotateCw size={15} /> Reenviar código
              </button>
            )}
            {resent && <p className="verify__resent-note">Nuevo código enviado ✓</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
