import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { claveDia } from '../lib/citas'
import { useAhora } from './useAhora'
import type { Cita, Reporte } from '../types/domain'

// Alerta de novedad para UNA cita del paciente. Reemplaza a useAlertaNovedades:
//   antes: cualquier novedad aprobada del médico en las últimas 6 h, aunque la
//          cita fuera otro día; una sola alerta a la vez.
//   ahora: solo novedades del día de la cita; varias a la vez; con hora
//          estimada en los retrasos; caduca sola cuando pasa la cita.
export interface AlertaCita {
  /** Cambia si llega otra novedad para la misma cita: así se vuelve a mostrar aunque se haya cerrado. */
  clave: string
  cita: Cita
  tipo: 'retraso' | 'ausencia' | 'otro'
  /** Retraso mayor aprobado para ese día (si hay varios, el peor caso). */
  minutos: number | null
  /** ISO de la hora estimada de atención (solo retrasos). */
  horaEstimada: string | null
  motivos: string[]
}

type NovedadVisible = Pick<Reporte, 'id' | 'medico_id' | 'motivo' | 'tipo' | 'minutos_retraso' | 'fecha_afectada'>

// Si el realtime falla o una novedad deja de ser visible (archivada), no llega
// evento: se recarga también cada minuto (patrón useNovedadesAprobadas).
const RECARGA_MS = 60_000

export function useAlertasNovedades(citas: Cita[]) {
  const ahora = useAhora(RECARGA_MS)
  const [novedades, setNovedades] = useState<NovedadVisible[]>([])
  const [cerradas, setCerradas] = useState<Set<string>>(() => new Set())

  // Solo citas que todavía pueden verse afectadas.
  const activas = useMemo(
    () => citas.filter((c) => (c.estado === 'pendiente' || c.estado === 'confirmada') && Date.parse(c.inicio) > ahora - 60 * 60 * 1000),
    [citas, ahora],
  )
  // Clave estable para el efecto: médicos y días de las citas activas.
  const filtro = useMemo(() => {
    const medicos = [...new Set(activas.map((c) => c.medico_id))].sort()
    const dias = [...new Set(activas.map((c) => claveDia(c.inicio)))].sort()
    return JSON.stringify({ medicos, dias })
  }, [activas])

  const cargar = useCallback(async () => {
    const { medicos, dias } = JSON.parse(filtro) as { medicos: string[]; dias: string[] }
    if (medicos.length === 0) {
      setNovedades([])
      return
    }
    // RLS ya limita a lo que afecta a este paciente; el filtro evita traer de más.
    const { data, error } = await supabase
      .from('reportes')
      .select('id, medico_id, motivo, tipo, minutos_retraso, fecha_afectada')
      .eq('estado', 'aprobado')
      .eq('archivado', false)
      .in('medico_id', medicos)
      .in('fecha_afectada', dias)
    // Si falla, se conservan las alertas que ya había.
    if (!error) setNovedades((data as NovedadVisible[]) ?? [])
  }, [filtro])

  useEffect(() => {
    void cargar()
    const canal = supabase
      .channel('novedades-paciente')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => void cargar())
      .subscribe((estado) => {
        // Al (re)conectar se recarga: lo que pasó sin red no llega por Realtime.
        if (estado === 'SUBSCRIBED') void cargar()
      })
    const intervalo = setInterval(() => void cargar(), RECARGA_MS)
    return () => {
      clearInterval(intervalo)
      void supabase.removeChannel(canal)
    }
  }, [cargar])

  // Por cita: sirve para marcar la hora estimada en las tarjetas (aunque se
  // haya cerrado el aviso) y es la base de los avisos.
  const porCita = useMemo(() => {
    const mapa = new Map<string, AlertaCita>()
    for (const cita of activas) {
      const dia = claveDia(cita.inicio)
      const propias = novedades.filter((n) => n.medico_id === cita.medico_id && n.fecha_afectada === dia)
      if (propias.length === 0) continue
      // Si hay varios retrasos aprobados ese día, se toma el mayor (peor caso).
      const minutos = Math.max(0, ...propias.map((n) => (n.tipo === 'retraso' ? (n.minutos_retraso ?? 0) : 0))) || null
      const tipo = propias.some((n) => n.tipo === 'ausencia') ? 'ausencia' : minutos ? 'retraso' : 'otro'
      mapa.set(cita.id, {
        clave: `${cita.id}:${propias
          .map((n) => n.id)
          .sort()
          .join(',')}`,
        cita,
        tipo,
        minutos,
        horaEstimada: minutos ? new Date(Date.parse(cita.inicio) + minutos * 60_000).toISOString() : null,
        motivos: propias.map((n) => n.motivo),
      })
    }
    return mapa
  }, [activas, novedades])

  // Avisos visibles: vigentes (no ha pasado la hora estimada) y no cerrados.
  const alertas = useMemo(
    () =>
      [...porCita.values()]
        .filter((a) => Date.parse(a.horaEstimada ?? a.cita.inicio) >= ahora && !cerradas.has(a.clave))
        .sort((a, b) => Date.parse(a.cita.inicio) - Date.parse(b.cita.inicio)),
    [porCita, cerradas, ahora],
  )

  const cerrar = useCallback((clave: string) => setCerradas((prev) => new Set(prev).add(clave)), [])

  return { alertas, porCita, cerrar }
}
