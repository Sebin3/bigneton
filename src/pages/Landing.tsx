import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  Database,
  Gauge,
  Headphones,
  Layers,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  Globe,
  AtSign,
  Send,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { apiCreateContactRequest } from '../api/contactRequests'
import './Landing.css'

const FEATURES = [
  {
    icon: Database,
    title: 'Ingesta masiva',
    text: 'Procesa hasta 200 mil registros por archivo y consolida históricos de toda la empresa en un solo almacén.',
  },
  {
    icon: Gauge,
    title: 'Perfilado automático',
    text: 'El motor infiere tipos, distribuciones y estadísticos de cada columna sin escribir una sola línea de SQL.',
  },
  {
    icon: ShieldCheck,
    title: 'Calidad de datos',
    text: 'Detecta duplicados, celdas vacías y anomalías antes de que contaminen tus indicadores de negocio.',
  },
  {
    icon: BarChart3,
    title: 'Analítica en tiempo real',
    text: 'Series temporales, histogramas y rankings que se regeneran al instante con cada nuevo dataset.',
  },
  {
    icon: Layers,
    title: 'Escala empresarial',
    text: 'Arquitectura pensada para volúmenes de Big Data: almacenamiento local persistente e historial trazable.',
  },
  {
    icon: Headphones,
    title: 'Soporte experto',
    text: 'Un equipo especializado en datos acompaña tu adopción desde la primera carga hasta el tablero final.',
  },
]

const METRICS = [
  { value: '+2.4 PB', label: 'Datos procesados en entornos corporativos' },
  { value: '98.9%', label: 'Precisión del perfilado automático' },
  { value: '-68%', label: 'Tiempo dedicado a limpiar datasets' },
  { value: '24/7', label: 'Monitoreo y disponibilidad continua' },
]

const STEPS = [
  {
    number: '01',
    title: 'Conecta tus fuentes',
    text: 'Carga los extractos de ventas, operaciones o clientes que hoy viven dispersos en CSV.',
  },
  {
    number: '02',
    title: 'Perfila y depura',
    text: 'La plataforma detecta tipos, duplicados y faltantes; corrige con un clic y conserva cada versión.',
  },
  {
    number: '03',
    title: 'Decide con datos',
    text: 'Explora tendencias mensuales y rankings que revelan qué está pasando realmente en el negocio.',
  },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contact, setContact] = useState({ name: '', email: '', phone: '', company: '', category: 'demo', preferredChannel: 'email', message: '', website: '' })
  const [contactState, setContactState] = useState<{ loading: boolean; error: string; ticket: string }>({ loading: false, error: '', ticket: '' })

  const closeMenu = () => setMenuOpen(false)

  const submitContact = async (event: FormEvent) => {
    event.preventDefault()
    setContactState({ loading: true, error: '', ticket: '' })
    try {
      const result = await apiCreateContactRequest(contact)
      setContactState({ loading: false, error: '', ticket: result.request?.ticketNumber ?? 'recibida' })
      setContact((prev) => ({ ...prev, name: '', email: '', phone: '', company: '', message: '', website: '' }))
    } catch (error) {
      setContactState({ loading: false, error: error instanceof Error ? error.message : 'No pudimos enviar tu solicitud.', ticket: '' })
    }
  }

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="container landing__nav-inner">
          <Logo />
          <nav className={`landing__links ${menuOpen ? 'is-open' : ''}`}>
            <a href="#features" onClick={closeMenu}>
              Plataforma
            </a>
            <a href="#beneficios" onClick={closeMenu}>
              Beneficios
            </a>
            <a href="#proceso" onClick={closeMenu}>
              Cómo funciona
            </a>
            <a href="#contacto" onClick={closeMenu}>Contacto</a>
          </nav>
          <div className="landing__nav-actions">
            <ThemeToggle />
            <Link to="/login" className="btn btn--ghost">
              Iniciar sesión
            </Link>
            <Link to="/login" className="btn btn--primary">
              Probar gratis
            </Link>
          </div>
          <button
            className="landing__hamburger"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="landing__mobile-menu">
            <a href="#features" onClick={closeMenu}>
              Plataforma
            </a>
            <a href="#beneficios" onClick={closeMenu}>
              Beneficios
            </a>
            <a href="#proceso" onClick={closeMenu}>
              Cómo funciona
            </a>
            <a href="#contacto" onClick={closeMenu}>Contacto</a>
            <hr />
            <Link to="/login" className="btn btn--primary" onClick={closeMenu}>
              Probar gratis
            </Link>
          </div>
        )}
      </header>

      <main>
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__content">
              <span className="badge hero__badge">
                <Sparkles size={15} /> Big Data · Edición para una Empresa
              </span>
              <h1>
                De millones de registros a <span>decisiones</span> que mueven
                tu empresa
              </h1>
              <p>
                La plataforma aplica las técnicas de Big Data que usan las grandes
                corporaciones: perfila, limpia y visualiza tus datos masivos
                para convertirlos en ventaja competitiva. Sin servidores, sin
                fricción.
              </p>
              <div className="hero__actions">
                <Link to="/login" className="btn btn--primary btn--lg">
                  Explorar el panel <ArrowRight size={18} />
                </Link>
                <a href="#features" className="btn btn--ghost btn--lg">
                  Ver plataforma
                </a>
              </div>
              <ul className="hero__checks">
                <li>
                  <Check size={16} /> Listo en minutos
                </li>
                <li>
                  <Check size={16} /> Tus datos nunca salen del equipo
                </li>
                <li>
                  <Check size={16} /> Gratis para empezar
                </li>
              </ul>
            </div>

            <div className="hero__visual" aria-hidden="true">
              <div className="mock-window">
                <div className="mock-window__bar">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="mock-window__body">
                  <div className="mock-window__side">
                    <span className="is-active" />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="mock-window__main">
                    <div className="mock-kpis">
                      <div>
                        <small>Registros</small>
                        <strong>1.28 M</strong>
                      </div>
                      <div>
                        <small>Completitud</small>
                        <strong>98.9%</strong>
                      </div>
                    </div>
                    <div className="mock-chart">
                      {[42, 68, 50, 82, 60, 95, 74].map((h, i) => (
                        <span key={i} style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="float-card float-card--top">
                <span className="float-card__icon float-card__icon--green">
                  <TrendingUp size={18} />
                </span>
                <div>
                  <strong>+2.4 TB</strong>
                  <small>Procesados hoy</small>
                </div>
              </div>
              <div className="float-card float-card--bottom">
                <span className="float-card__icon float-card__icon--soft">
                  <UserPlus size={18} />
                </span>
                <div>
                  <strong>99.2%</strong>
                  <small>Precisión de perfilado</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="trustbar">
          <div className="container trustbar__inner">
            <p>Datos que ya mueven a las grandes empresas</p>
            <div className="trustbar__logos">
              <span>NovaTech</span>
              <span>EcoMarket</span>
              <span>Lumina</span>
              <span>Andes Corp</span>
              <span>Vértice</span>
            </div>
          </div>
        </section>

        <section id="features" className="features section">
          <div className="container">
            <div className="section-head">
              <span className="badge badge--soft">Plataforma</span>
              <h2>Ingeniería de Big Data, experiencia simple</h2>
              <p>
                Todo el pipeline que un equipo de datos construiría en meses,
                funcionando desde el primer momento.
              </p>
            </div>
            <div className="features__grid">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="feature-card">
                  <span className="feature-card__icon">
                    <Icon size={22} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="beneficios" className="showcase section">
          <div className="container showcase__inner">
            <div className="showcase__content">
              <span className="badge badge--soft">Beneficios</span>
              <h2>Tus datos valen más cuando puedes confiar en ellos</h2>
              <p>
                Las decisiones corporativas fallan por datos sucios, no por falta
                de información. El panel mide la completitud de cada dataset,
                elimina duplicados y rellena faltantes con estadística sólida.
              </p>
              <ul className="showcase__list">
                <li>
                  <span className="check-bubble">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  Perfil completo de columnas en segundos
                </li>
                <li>
                  <span className="check-bubble">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  Limpiezas trazables con historial de versiones
                </li>
                <li>
                  <span className="check-bubble">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  Tus datasets quedan guardados y disponibles al instante
                </li>
                <li>
                  <span className="check-bubble">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  Interfaz adaptable y modo claro/oscuro
                </li>
              </ul>
              <Link to="/login" className="btn btn--primary btn--lg">
                Explorar el dashboard <ArrowRight size={18} />
              </Link>
            </div>
            <div className="showcase__visual" aria-hidden="true">
              <div className="rings">
                <div className="ring ring--1">
                  <strong>98.9%</strong>
                  <small>Completitud</small>
                </div>
                <div className="ring ring--2">
                  <strong>x10</strong>
                  <small>Más rápido</small>
                </div>
                <div className="ring ring--3">
                  <strong>0</strong>
                  <small>Fugas de datos</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="proceso" className="process section">
          <div className="container">
            <div className="section-head">
              <span className="badge badge--soft">Cómo funciona</span>
              <h2>Tres pasos hacia datos confiables</h2>
              <p>Del archivo crudo a la decisión informada, sin complejidad.</p>
            </div>
            <div className="process__grid">
              {STEPS.map((step) => (
                <article key={step.number} className="process-step">
                  <span className="process-step__number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="metricas" className="metrics">
          <div className="container metrics__grid">
            {METRICS.map((m) => (
              <div key={m.label} className="metrics__item">
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="contacto" className="contact section">
          <div className="container contact__grid">
            <div className="contact__copy">
              <span className="badge badge--soft">Hablemos</span>
              <h2>Descubre cómo Big Data puede ayudar a tu empresa</h2>
              <p>Cuéntanos qué necesitas. Un especialista revisará tu solicitud y responderá directamente a tu correo.</p>
              <ul>
                <li><Check size={17} /> Demostración personalizada</li>
                <li><Check size={17} /> Orientación para tus datos</li>
                <li><Check size={17} /> Respuesta con seguimiento</li>
              </ul>
            </div>
            <form className="contact__form" onSubmit={submitContact} noValidate>
              <div className="contact__row">
                <label>Nombre completo<input required maxLength={120} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Tu nombre" /></label>
                <label>Correo<input required type="email" maxLength={254} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="nombre@empresa.com" /></label>
              </div>
              <div className="contact__row">
                <label>Empresa<input maxLength={120} value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} placeholder="Nombre de la empresa" /></label>
                <label>Teléfono o WhatsApp<input maxLength={40} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+51 999 999 999" /></label>
              </div>
              <div className="contact__row">
                <label>¿En qué podemos ayudarte?<select value={contact.category} onChange={(e) => setContact({ ...contact, category: e.target.value })}><option value="demo">Solicitar demostración</option><option value="cotizacion">Solicitar cotización</option><option value="informacion">Información comercial</option><option value="soporte">Consulta o soporte</option><option value="otro">Otro</option></select></label>
                <label>Prefiero que me contacten por<select value={contact.preferredChannel} onChange={(e) => setContact({ ...contact, preferredChannel: e.target.value })}><option value="email">Correo</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option></select></label>
              </div>
              <label>Mensaje<textarea required maxLength={5000} rows={5} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} placeholder="Cuéntanos sobre tu empresa y qué deseas resolver..." /></label>
              <label className="contact__honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} /></label>
              {contactState.error && <p className="contact__error" role="alert">{contactState.error}</p>}
              {contactState.ticket && <p className="contact__success" role="status">Solicitud enviada correctamente. Código: <strong>{contactState.ticket}</strong></p>}
              <button className="btn btn--primary btn--lg" type="submit" disabled={contactState.loading}>{contactState.loading ? 'Enviando…' : <>Enviar solicitud <Send size={17} /></>}</button>
              <small>Al enviar aceptas que usemos estos datos únicamente para responder tu solicitud.</small>
            </form>
          </div>
        </section>

        <section className="cta section">
          <div className="container">
            <div className="cta__card">
              <Zap size={30} className="cta__bolt" aria-hidden="true" />
              <h2>¿Listo para ver lo que esconden tus datos?</h2>
              <p>
                Crea tu cuenta gratis y experimenta el análisis de Big Data que
                usan las grandes empresas, en un panel hecho para ti.
              </p>
              <Link to="/login" className="btn btn--light btn--lg">
                Crear cuenta gratis <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Logo variant="light" />
            <p>
              Analítica de Big Data para equipos que crecen. Hecho con rigor
              estadístico y cariño por los datos limpios.
            </p>
            <div className="footer__socials">
              <a href="#" aria-label="Sitio web">
                <Globe size={18} />
              </a>
              <a href="#" aria-label="Correo">
                <AtSign size={18} />
              </a>
              <a href="#contacto" aria-label="Contacto">
                <Send size={18} />
              </a>
            </div>
          </div>
          <div className="footer__col">
            <h4>Plataforma</h4>
            <a href="#features">Características</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#metricas">Métricas</a>
            <a href="#contacto">Contacto</a>
          </div>
          <div className="footer__col">
            <h4>Cuenta</h4>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/login">Registrarse</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div className="footer__col">
            <h4>Legal</h4>
            <a href="#">Privacidad</a>
            <a href="#">Términos</a>
            <a href="#">Cookies</a>
          </div>
        </div>
        <div className="container footer__bottom">
          <p>© 2026 Big Data Analytics. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
