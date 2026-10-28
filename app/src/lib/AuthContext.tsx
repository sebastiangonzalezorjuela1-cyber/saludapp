import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'
import type { Rol } from '../types/domain'

// Reciclado de Buses Metro. Único cambio: además del rol se trae el nombre,
// que SaludApp muestra en el saludo ("Bienvenido, Dani").
interface AuthState {
  session: Session | null
  rol: Rol | null
  nombre: string | null
  cargando: boolean
}

const AuthContext = createContext<AuthState>({ session: null, rol: null, nombre: null, cargando: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Hasta que se lee la sesión guardada no se sabe si hay alguien conectado:
  // decidir antes mandaría al login a quien recarga la página con sesión abierta.
  const [sesionLeida, setSesionLeida] = useState(false)
  const [rol, setRol] = useState<Rol | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSesionLeida(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion)
      setSesionLeida(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Depende del usuario, no de la sesión: Supabase entrega una sesión nueva en
  // cada renovación del token y eso no debe desmontar la página actual.
  const usuarioId = session?.user.id ?? null

  useEffect(() => {
    if (!sesionLeida) return
    if (!usuarioId) {
      setRol(null)
      setNombre(null)
      setCargando(false)
      return
    }
    let vigente = true
    setCargando(true)
    supabase
      .from('usuarios')
      .select('rol, nombre')
      .eq('id', usuarioId)
      .single()
      .then(({ data }) => {
        if (!vigente) return
        setRol((data?.rol as Rol) ?? null)
        setNombre((data?.nombre as string) ?? null)
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [usuarioId, sesionLeida])

  return <AuthContext.Provider value={{ session, rol, nombre, cargando }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
