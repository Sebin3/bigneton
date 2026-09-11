import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import ProtectedRoute, { GuestRoute, PendingRoute } from './components/ProtectedRoute'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Verify = lazy(() => import('./pages/Verify'))
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'))
const Principal = lazy(() => import('./pages/dashboard/Principal'))
const ProcesarDatos = lazy(() => import('./pages/dashboard/ProcesarDatos'))
const EstructuraDatos = lazy(() => import('./pages/dashboard/EstructuraDatos'))
const Graficos = lazy(() => import('./pages/dashboard/Graficos'))
const Pipeline = lazy(() => import('./pages/dashboard/Pipeline'))
const Ofertas = lazy(() => import('./pages/dashboard/Ofertas'))
const LimpiezaDatos = lazy(() => import('./pages/dashboard/LimpiezaDatos'))
const HistorialDatos = lazy(() => import('./pages/dashboard/HistorialDatos'))
const Configuracion = lazy(() => import('./pages/dashboard/Configuracion'))
const Ayuda = lazy(() => import('./pages/dashboard/Ayuda'))
const Invitaciones = lazy(() => import('./pages/dashboard/Invitaciones'))
const Usuarios = lazy(() => import('./pages/dashboard/Usuarios'))
const Reportes = lazy(() => import('./pages/dashboard/Reportes'))
const Solicitudes = lazy(() => import('./pages/dashboard/Solicitudes'))

function RouteFallback() {
  return (
    <div className="route-loader" role="status" aria-label="Cargando">
      <Loader2 size={32} className="route-loader__spinner" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DataProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/verify"
                element={
                  <PendingRoute>
                    <Verify />
                  </PendingRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Principal />} />
                <Route path="procesar" element={<ProcesarDatos />} />
                <Route path="estructura" element={<EstructuraDatos />} />
                <Route path="graficos" element={<Graficos />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="ofertas" element={<Ofertas />} />
                <Route path="limpieza" element={<LimpiezaDatos />} />
                <Route path="historial" element={<HistorialDatos />} />
                <Route path="configuracion" element={<Configuracion />} />
                <Route path="ayuda" element={<Ayuda />} />
                <Route path="reportes" element={<Reportes />} />
                <Route path="invitaciones" element={<Invitaciones />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="solicitudes" element={<Solicitudes />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </DataProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
