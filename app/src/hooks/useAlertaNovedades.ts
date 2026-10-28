import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface AlertaNovedad {
  id: string
  medicoId: string
  motivo: string
}

// Reciclado casi línea por línea de la alerta del pasajero en Buses Metro:
//   antes: "novedad en tu ruta" -> reportes aprobados de los buses de la ruta.
//   ahora: "novedad con tu médico" -> reportes aprobados de los médicos con los
//          que el paciente tiene una cita activa.
// Se escucha UPDATE (no INSERT): el paciente solo ve lo que el admin aprobó, y si
// el admin lo rechaza o archiva después, la alerta se quita sola.
export function useAlertaNovedades(medicoIds: string[]) {
  const [alerta, setAlerta] = useState<AlertaNovedad | null>(null)
  const clave = [...medicoIds].sort().join(',')

  useEffect(() => {
    const medicos = new Set(clave ? clave.split(',') : [])
    if (medicos.size === 0) return

    const mostrados = new Set<string>()
    let cancelado = false

    const mostrar = (id: string, medicoId: string, motivo: string) => {
      if (mostrados.has(id)) return
      mostrados.add(id)
      setAlerta({ id, medicoId, motivo })
    }

    const canal = supabase
      .channel('reportes-paciente')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reportes' }, (payload) => {
        const id = payload.new.id as string
        const visible = payload.new.estado === 'aprobado' && payload.new.archivado === false
        if (!visible) {
          mostrados.delete(id)
          setAlerta((actual) => (actual?.id === id ? null : actual))
          return
        }
        const medicoId = payload.new.medico_id as string | undefined
        const motivo = payload.new.motivo as string | undefined
        if (motivo && medicoId && medicos.has(medicoId)) mostrar(id, medicoId, motivo)
      })
      .subscribe((estado) => {
        // La carga inicial va cuando el canal ya está conectado: así no se
        // pierde una aprobación que caiga justo en medio.
        if (estado !== 'SUBSCRIBED' || cancelado) return
        const desde = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        void supabase
          .from('reportes')
          .select('id, medico_id, motivo')
          .eq('estado', 'aprobado')
          .eq('archivado', false)
          .in('medico_id', [...medicos])
          .gte('revisado_en', desde)
          .order('revisado_en', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            const reciente = data?.[0]
            if (!cancelado && reciente) mostrar(reciente.id, reciente.medico_id, reciente.motivo)
          })
      })

    return () => {
      cancelado = true
      void supabase.removeChannel(canal)
    }
  }, [clave])

  return { alerta, cerrar: () => setAlerta(null) }
}
