import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Rol } from '../types/domain'
import { useAuth } from './useAuth'
import { ProblemaPerfil } from './ProblemaPerfil'

export function RutaProtegida({ rolPermitido, children }: { rolPermitido: Rol; children: ReactNode }) {
  const { session, rol, cargando, problemaPerfil } = useAuth()

  if (cargando) return null
  if (!session) return <Navigate to={`/login/${rolPermitido}`} replace />
  // Hay sesión pero no se sabe el rol: se explica en vez de mandar al login.
  if (problemaPerfil) return <ProblemaPerfil />
  if (rol !== rolPermitido) return <Navigate to={`/login/${rolPermitido}`} replace />

  return <>{children}</>
}
