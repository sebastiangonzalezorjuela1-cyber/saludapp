import { Link, Navigate } from 'react-router-dom'
import { rolInicial } from '../../lib/rolInicial'
import { Marca } from '../../lib/Marca'

// Reciclada de Buses Metro: Pasajero / Conductor / Agente pasan a ser
// Paciente / Médico / Administrador.
const ROLES = [
  { rol: 'paciente', etiqueta: 'Paciente', color: 'bg-[#0d6b6e]' },
  { rol: 'medico', etiqueta: 'Médico', color: 'bg-[#2c6672]' },
  { rol: 'admin', etiqueta: 'Administrador', color: 'bg-[#013b4d]' },
] as const

export function SeleccionRolPage() {
  if (rolInicial) return <Navigate to={`/login/${rolInicial}`} replace />

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-[#f4f9fa] to-[#d8e9eb] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Marca oscura />
          <p className="mt-2 text-sm text-slate-500">¿Con qué rol quieres ingresar?</p>
        </div>

        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          {ROLES.map(({ rol, etiqueta, color }) => (
            <Link
              key={rol}
              to={`/login/${rol}`}
              className={`block w-full rounded-xl px-3 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 ${color}`}
            >
              {etiqueta}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
