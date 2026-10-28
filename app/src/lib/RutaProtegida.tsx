import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Rol } from '../types/domain'
import { useAuth } from './AuthContext'

export function RutaProtegida({ rolPermitido, children }: { rolPermitido: Rol; children: ReactNode }) {
  const { session, rol, cargando } = useAuth()

  if (cargando) return null
  if (!session) return <Navigate to={`/login/${rolPermitido}`} replace />
  if (rol !== rolPermitido) return <Navigate to={`/login/${rolPermitido}`} replace />

  return <>{children}</>
}
