import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BarChart3, Building2, Clock, Stethoscope, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { mensajeDeError } from '../../lib/mensajesError'
import { AvisoError } from '../../lib/AvisoError'
import { desdePeriodo, formatearDuracion, porcentaje, textoPorcentaje, type Periodo } from '../../lib/estadisticas'
import { BarrasOcupacion, Cifra, ColumnasPorHora, type DatoOcupacion } from './graficos'

// Pestaña de estadísticas del admin. Todo sale de UNA llamada a
// estadisticas_citas (patrón estadisticas_reportes de la guía de Buses Metro).

interface Estadisticas {
  totales: {
    solicitudes: number
    pendientes: number
    confirmadas: number
    rechazadas: number
    canceladas: number
    atendidas: number
    no_asistio: number
    cancelada_paciente: number
    cancelada_medico: number
    cancelada_sistema: number
    respuesta_promedio_seg: number | null
    respuesta_muestras: number
  }
  ocupacion_especialidad: DatoOcupacion[]
  ocupacion_sede: DatoOcupacion[]
  demanda_hora: { hora: number; total: number }[]
  novedades: {
    total: number
    pendientes: number
    aprobadas: number
    rechazadas: number
    retrasos: number
    ausencias: number
    otras: number
    revision_promedio_seg: number | null
  }
}

const PERIODOS: [Periodo, string][] = [
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['todo', 'Todo'],
]

function Bloque({ titulo, subtitulo, Icono, children }: { titulo: string; subtitulo?: string; Icono: typeof Clock; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-[#0f3a48]">
        <span className="h-5 w-1 rounded-full bg-[#2c6672]" aria-hidden="true" />
        <Icono className="h-4 w-4 text-[#2c6672]" aria-hidden="true" />
        {titulo}
      </h3>
      {subtitulo && <p className="mt-0.5 mb-4 pl-3.5 text-xs text-slate-500">{subtitulo}</p>}
      {!subtitulo && <div className="mb-4" />}
      {children}
    </section>
  )
}

export function PanelEstadisticas() {
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [datos, setDatos] = useState<Estadisticas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const desde = desdePeriodo(periodo)
    const { data, error: errorRpc } = await supabase.rpc('estadisticas_citas', desde ? { p_desde: desde } : {})
    if (errorRpc) setError(mensajeDeError(errorRpc))
    else {
      setError(null)
      setDatos(data as Estadisticas)
    }
    setCargando(false)
  }, [periodo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const t = datos?.totales
  // Respondidas = las que el médico aceptó (y quedaron confirmadas o cerradas) o rechazó.
  const aceptadas = t ? t.confirmadas + t.atendidas + t.no_asistio : 0
  const respondidas = t ? aceptadas + t.rechazadas : 0
  const cerradas = t ? t.atendidas + t.no_asistio : 0

  return (
    <div className="space-y-5">
      {/* Filtro: una fila, arriba de todo lo que afecta. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">
        {PERIODOS.map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPeriodo(clave)}
            aria-pressed={periodo === clave}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              periodo === clave ? 'bg-[#013b4d] text-white ring-[#013b4d]' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {texto}
          </button>
        ))}
        <span className="text-xs text-slate-400">Según la fecha de la cita, en hora de Colombia.</span>
      </div>

      {error && (
        <AvisoError
          titulo={datos ? 'No se pudieron actualizar las estadísticas' : 'No se pudieron cargar las estadísticas'}
          detalle={error}
          onReintentar={() => void cargar()}
          reintentando={cargando}
        />
      )}

      {!datos ? (
        !error && <p className="text-sm text-slate-500">Cargando estadísticas…</p>
      ) : (
        // Al recargar se conserva lo anterior atenuado: sin saltos ni parpadeos.
        <div className={`space-y-5 transition-opacity ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta="Tasa de confirmación"
              valor={textoPorcentaje(porcentaje(aceptadas, respondidas))}
              nota={`${aceptadas} aceptadas de ${respondidas} respondidas · ${t!.solicitudes} solicitudes`}
              destacada
            />
            <Cifra
              etiqueta="Respuesta media del médico"
              valor={formatearDuracion(t!.respuesta_promedio_seg)}
              nota={t!.respuesta_muestras ? `Sobre ${t!.respuesta_muestras} respuestas` : 'Se mide desde el 24-nov-2026'}
            />
            <Cifra
              etiqueta="Inasistencia"
              valor={textoPorcentaje(porcentaje(t!.no_asistio, cerradas))}
              nota={cerradas ? `${t!.no_asistio} de ${cerradas} citas cerradas` : 'Aún no hay citas cerradas'}
            />
            <Cifra
              etiqueta="Cancelaciones"
              valor={t!.canceladas}
              nota={`Paciente ${t!.cancelada_paciente} · Médico ${t!.cancelada_medico} · Sistema ${t!.cancelada_sistema}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloque titulo="Ocupación por especialidad" subtitulo="Horarios tomados de los abiertos · próximos 14 días" Icono={Stethoscope}>
              <BarrasOcupacion datos={datos.ocupacion_especialidad} columnaEtiqueta="Especialidad" />
            </Bloque>
            <Bloque titulo="Ocupación por sede" subtitulo="Horarios tomados de los abiertos · próximos 14 días" Icono={Building2}>
              <BarrasOcupacion datos={datos.ocupacion_sede} columnaEtiqueta="Sede" />
            </Bloque>
          </div>

          <Bloque titulo="Demanda por hora del día" subtitulo="Citas solicitadas según su hora de inicio" Icono={BarChart3}>
            <ColumnasPorHora datos={datos.demanda_hora} />
          </Bloque>

          <Bloque titulo="Novedades de los médicos" Icono={TriangleAlert}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Cifra etiqueta="Reportadas" valor={datos.novedades.total} nota={`${datos.novedades.pendientes} sin revisar`} />
              <Cifra
                etiqueta="Por tipo"
                valor={datos.novedades.retrasos}
                nota={`retrasos · ${datos.novedades.ausencias} ausencias · ${datos.novedades.otras} otras`}
              />
              <Cifra
                etiqueta="Aprobadas"
                valor={textoPorcentaje(porcentaje(datos.novedades.aprobadas, datos.novedades.aprobadas + datos.novedades.rechazadas))}
                nota={`${datos.novedades.aprobadas} aprobadas · ${datos.novedades.rechazadas} rechazadas`}
              />
              <Cifra
                etiqueta="Revisión media del admin"
                valor={formatearDuracion(datos.novedades.revision_promedio_seg)}
                nota="Desde que se reporta hasta que se decide"
              />
            </div>
          </Bloque>
        </div>
      )}
    </div>
  )
}
