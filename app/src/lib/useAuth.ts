import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Rol } from '../types/domain'

// El contexto y su hook viven aquí y el Provider en AuthContext.tsx: Vite solo
// hace hot reload de archivos que exportan únicamente componentes.

// Hay sesión pero no se pudo saber el rol: no es lo mismo que "no hay sesión".
//   sin_perfil:   la cuenta existe en Auth pero no tiene fila en `usuarios`.
//   sin_conexion: falló la consulta (red caída, servidor no responde).
export type ProblemaPerfil = 'sin_perfil' | 'sin_conexion'

export interface AuthState {
  session: Session | null
  rol: Rol | null
  nombre: string | null
  cargando: boolean
  problemaPerfil: ProblemaPerfil | null
  /** Vuelve a consultar el perfil (botón Reintentar). */
  reintentarPerfil: () => void
  /** Tras guardar el nombre en Ajustes, sin volver a consultar. */
  actualizarNombre: (nombre: string) => void
}

export const AuthContext = createContext<AuthState>({
  session: null,
  rol: null,
  nombre: null,
  cargando: true,
  problemaPerfil: null,
  reintentarPerfil: () => {},
  actualizarNombre: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// Nombre del perfil, o la parte del correo antes de la @, o el valor por defecto.
export function nombreVisible(auth: Pick<AuthState, 'nombre' | 'session'>, porDefecto = 'Usuario'): string {
  return auth.nombre ?? auth.session?.user.email?.split('@')[0] ?? porDefecto
}
