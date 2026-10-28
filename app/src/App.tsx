import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { RutaProtegida } from './lib/RutaProtegida'
import { rolInicial } from './lib/rolInicial'
import { LoginPage } from './pages/login/LoginPage'
import { SeleccionRolPage } from './pages/login/SeleccionRolPage'
import { RecuperarPasswordPage } from './pages/login/RecuperarPasswordPage'
import { PacientePage } from './pages/paciente/PacientePage'
import { MedicoPage } from './pages/medico/MedicoPage'
import { AdminPage } from './pages/admin/AdminPage'

// Mismo enrutado que Buses Metro: solo cambian los nombres de los roles.
function RedireccionInicio() {
  const { session, rol, cargando } = useAuth()

  if (cargando) return null
  if (!session || !rol) return <Navigate to={rolInicial ? `/login/${rolInicial}` : '/login'} replace />
  return <Navigate to={`/${rol}`} replace />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<SeleccionRolPage />} />
          <Route path="/login/:rol" element={<LoginPage />} />
          <Route path="/recuperar" element={<RecuperarPasswordPage />} />
          <Route
            path="/paciente"
            element={
              <RutaProtegida rolPermitido="paciente">
                <PacientePage />
              </RutaProtegida>
            }
          />
          <Route
            path="/medico"
            element={
              <RutaProtegida rolPermitido="medico">
                <MedicoPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin"
            element={
              <RutaProtegida rolPermitido="admin">
                <AdminPage />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<RedireccionInicio />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
