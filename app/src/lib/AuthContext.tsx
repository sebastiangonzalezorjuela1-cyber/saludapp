import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'
import { AuthContext, type ProblemaPerfil } from './useAuth'
import type { Rol } from '../types/domain'

// Reciclado de Buses Metro (versión de la guía): además del rol trae el nombre
// y distingue "sin perfil" de "sin conexión" en vez de mandar al login.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Hasta que se lee la sesión guardada no se sabe si hay alguien conectado:
  // decidir antes mandaría al login a quien recarga la página con sesión abierta.
  const [sesionLeida, setSesionLeida] = useState(false)
  const [rol, setRol] = useState<Rol | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  const [problemaPerfil, setProblemaPerfil] = useState<ProblemaPerfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)

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
      setProblemaPerfil(null)
      setCargando(false)
      return
    }
    let vigente = true
    setCargando(true)
    // maybeSingle y no single: "no hay fila" es un caso válido y así no se
    // confunde con un fallo de red.
    supabase
      .from('usuarios')
      .select('rol, nombre')
      .eq('id', usuarioId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) {
          setRol(null)
          setProblemaPerfil('sin_conexion')
        } else if (!data) {
          setRol(null)
          setProblemaPerfil('sin_perfil')
        } else {
          setRol(data.rol as Rol)
          setNombre(data.nombre as string)
          setProblemaPerfil(null)
        }
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [usuarioId, sesionLeida, intento])

  const reintentarPerfil = useCallback(() => setIntento((n) => n + 1), [])

  const valor = useMemo(
    () => ({ session, rol, nombre, cargando, problemaPerfil, reintentarPerfil, actualizarNombre: setNombre }),
    [session, rol, nombre, cargando, problemaPerfil, reintentarPerfil],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
