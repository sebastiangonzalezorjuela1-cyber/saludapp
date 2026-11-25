import { useState } from 'react'
import { UserX, WifiOff } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useAuth } from './useAuth'
import { Marca } from './Marca'

// Hay sesión pero no se pudo saber el rol. Antes esto mandaba al login (o dejaba
// el botón en "Un momento…" para siempre); ahora se explica y se ofrece salida.
export function ProblemaPerfil() {
  const { problemaPerfil, reintentarPerfil, cargando, session } = useAuth()
  const [saliendo, setSaliendo] = useState(false)
  const sinConexion = problemaPerfil === 'sin_conexion'
  const Icono = sinConexion ? WifiOff : UserX

  async function cerrarSesion() {
    setSaliendo(true)
    await supabase.auth.signOut()
    setSaliendo(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-[#f4f9fa] to-[#d8e9eb] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Marca oscura />
        </div>
        <div role="alert" className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <Icono className="mx-auto mb-3 h-10 w-10 text-[#2c6672]" aria-hidden="true" />
          <h1 className="text-base font-semibold text-slate-900">
            {sinConexion ? 'No pudimos conectar con el servidor' : 'Tu cuenta no tiene un perfil'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {sinConexion
              ? 'Revisa tu conexión a internet y vuelve a intentarlo.'
              : `La cuenta ${session?.user.email ?? ''} existe, pero no tiene un rol asignado. Contacta al administrador.`}
          </p>
          <div className="mt-6 space-y-2">
            {sinConexion && (
              <button
                type="button"
                onClick={reintentarPerfil}
                disabled={cargando}
                className="w-full rounded-xl bg-[#013b4d] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d60] disabled:opacity-50"
              >
                {cargando ? 'Reintentando…' : 'Reintentar'}
              </button>
            )}
            <button
              type="button"
              onClick={cerrarSesion}
              disabled={saliendo}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#013b4d] ring-1 ring-[#013b4d]/30 hover:bg-slate-50 disabled:opacity-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
