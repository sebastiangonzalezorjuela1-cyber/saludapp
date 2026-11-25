import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Building2,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  RefreshCw,
  Shuffle,
  BarChart3,
  Stethoscope,
  XCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'
import { useAhora } from '../../hooks/useAhora'
import { mensajeDeError } from '../../lib/mensajesError'
import { AvisoError } from '../../lib/AvisoError'
import { Encabezado, Pie, Plantas, Portada } from '../../lib/Plantilla'
import { PanelEstadisticas } from './PanelEstadisticas'
import { ESTADOS_ACTIVOS, ESTADOS_CITA, claveDia, fechaLarga, hora, textoDia } from '../../lib/citas'
import type { Cita, EstadoReporte, Especialidad, Medico, Reporte, Sede, TipoReporte, Usuario } from '../../types/domain'

const TIPOS_REPORTE: Record<TipoReporte, string> = {
  retraso: 'Retraso',
  ausencia: 'Ausencia',
  otro: 'Otra novedad',
}

// Reciclado del panel del agente de Buses Metro.
//   Bandeja de reportes + aprobar/rechazar + archivar  -> igual (novedades de médicos)
//   Asignaciones conductor -> bus                       -> médico -> sede
//   Mapa en vivo de buses                               -> resumen de citas
const ESTADOS: Record<EstadoReporte, { etiqueta: string; color: string; chip: string; Icono: typeof Clock }> = {
  pendiente: { etiqueta: 'Pendientes', color: '#fab219', chip: 'bg-amber-50 text-amber-900 ring-amber-200', Icono: Clock },
  aprobado: { etiqueta: 'Aprobados', color: '#0ca30c', chip: 'bg-emerald-50 text-emerald-900 ring-emerald-200', Icono: CheckCircle2 },
  rechazado: { etiqueta: 'Rechazados', color: '#d03b3b', chip: 'bg-red-50 text-red-900 ring-red-200', Icono: XCircle },
}

const ORDEN_ESTADOS: EstadoReporte[] = ['pendiente', 'aprobado', 'rechazado']
const LIMITE_REPORTES = 50
const DIAS_PARA_ARCHIVAR = 1
const TEXTO_PLAZO = DIAS_PARA_ARCHIVAR === 1 ? '1 día' : `${DIAS_PARA_ARCHIVAR} días`
// Horario que se abre con "Generar horarios": lunes a sábado, hora de Colombia.
const HORAS_AGENDA = [8, 9, 10, 11, 14, 15, 16]
const DIAS_AGENDA = 14

interface ReporteEnriquecido extends Reporte {
  medico: string | null
  especialidad: string | null
}

function tiempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

function Tarjeta({
  etiqueta,
  valor,
  Icono,
  destacada = false,
  nota,
}: {
  etiqueta: string
  valor: number
  Icono: typeof Clock
  destacada?: boolean
  nota?: string
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-lg shadow-[#013b4d]/10 ring-1 ${
        destacada ? 'ring-2 ring-[#2c6672]' : 'ring-slate-200/80'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{etiqueta}</p>
        <Icono className={`h-4 w-4 ${destacada ? 'text-[#2c6672]' : 'text-slate-400'}`} />
      </div>
      <p className={`mt-1 font-semibold text-slate-900 ${destacada ? 'text-5xl' : 'text-3xl'}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-slate-400">{nota}</p>}
    </div>
  )
}

function BarraDistribucion({ conteos, total }: { conteos: Record<EstadoReporte, number>; total: number }) {
  if (total === 0) return null
  const visibles = ORDEN_ESTADOS.filter((estado) => conteos[estado] > 0)
  return (
    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded">
      {visibles.map((estado) => (
        <div
          key={estado}
          className="h-full first:rounded-l last:rounded-r"
          style={{ width: `${(conteos[estado] / total) * 100}%`, backgroundColor: ESTADOS[estado].color }}
        />
      ))}
    </div>
  )
}

function Panel({ titulo, Icono, children }: { titulo: string; Icono: typeof Clock; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <h2 className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-[#0f3a48]">
        <span className="h-5 w-1 rounded-full bg-[#2c6672]" />
        <Icono className="h-4 w-4 text-[#2c6672]" />
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export function AdminPage() {
  const { session } = useAuth()
  const [reportes, setReportes] = useState<ReporteEnriquecido[]>([])
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [filtro, setFiltro] = useState<EstadoReporte | 'todos'>('todos')
  const [vista, setVista] = useState<'reportes' | 'citas' | 'asignaciones' | 'estadisticas'>('reportes')
  const [verArchivados, setVerArchivados] = useState(false)
  const [archivando, setArchivando] = useState(false)
  const [avisoArchivado, setAvisoArchivado] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [avisoAsignacion, setAvisoAsignacion] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [avisoBandeja, setAvisoBandeja] = useState<string | null>(null)
  // Id del reporte que se está decidiendo: evita el doble toque.
  const [decidiendo, setDecidiendo] = useState<string | null>(null)
  // Rechazo con motivo: qué reporte se está rechazando y el texto escrito.
  const [rechazandoId, setRechazandoId] = useState<string | null>(null)
  const [comentarioRechazo, setComentarioRechazo] = useState('')
  // Contados en la base, no en la lista recortada a LIMITE_REPORTES.
  const [totales, setTotales] = useState({ bandeja: 0, pendientes: 0 })

  const ahora = useAhora()

  const nombreDe = useCallback((id: string | null) => usuarios.find((u) => u.id === id)?.nombre ?? '—', [usuarios])

  const cargar = useCallback(async () => {
    const [resReportes, resMedicos, resSedes, resEsp, resUsuarios, resCitas, resTotal, resPendientes] = await Promise.all([
      supabase
        .from('reportes')
        .select('*', { count: 'exact' })
        .eq('archivado', verArchivados)
        .order('creado_en', { ascending: false })
        .limit(LIMITE_REPORTES),
      supabase.from('medicos').select('*'),
      supabase.from('sedes').select('*').order('nombre'),
      supabase.from('especialidades').select('*'),
      supabase.from('usuarios').select('*'),
      // Solo las citas tomadas: los horarios libres son cientos y no aportan aquí.
      supabase.from('citas').select('*').neq('estado', 'disponible').order('inicio'),
      // head: true → solo cuenta, sin traer filas.
      supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('archivado', verArchivados),
      supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('archivado', false).eq('estado', 'pendiente'),
    ])

    const fallo =
      resReportes.error ??
      resMedicos.error ??
      resSedes.error ??
      resEsp.error ??
      resUsuarios.error ??
      resCitas.error ??
      resTotal.error ??
      resPendientes.error
    if (fallo) {
      // Se conservan los datos anteriores y se avisa.
      setErrorCarga(mensajeDeError(fallo))
      setCargando(false)
      return
    }
    setErrorCarga(null)

    const listaMedicos = (resMedicos.data as Medico[]) ?? []
    const listaUsuarios = (resUsuarios.data as Usuario[]) ?? []
    const listaEsp = (resEsp.data as Especialidad[]) ?? []
    const nombrePor = new Map(listaUsuarios.map((u) => [u.id, u.nombre]))

    setReportes(
      ((resReportes.data as Reporte[]) ?? []).map((r) => {
        const m = listaMedicos.find((x) => x.id === r.medico_id)
        return {
          ...r,
          medico: nombrePor.get(r.medico_id) ?? null,
          especialidad: listaEsp.find((e) => e.id === m?.especialidad_id)?.nombre ?? null,
        }
      }),
    )
    setMedicos(listaMedicos)
    setSedes((resSedes.data as Sede[]) ?? [])
    setEspecialidades(listaEsp)
    setUsuarios(listaUsuarios)
    setCitas((resCitas.data as Cita[]) ?? [])
    setTotales({ bandeja: resTotal.count ?? 0, pendientes: resPendientes.count ?? 0 })
    setCargando(false)
  }, [verArchivados])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Igual que el agente: un reporte o una cita nueva entran sin recargar.
  useEffect(() => {
    const canal = supabase
      .channel('admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes' }, () => void cargar())
      // UPDATE: así dos administradores ven las decisiones del otro.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reportes' }, () => void cargar())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'citas' }, () => void cargar())
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [cargar])

  async function actualizarEstado(id: string, estado: 'aprobado' | 'rechazado', comentario?: string) {
    const revisadoEn = new Date().toISOString()
    // Motivo opcional: si está vacío se guarda null (la base no acepta '').
    const comentarioAdmin = estado === 'rechazado' ? comentario?.trim() || null : null
    if (comentarioAdmin && comentarioAdmin.length > 300) {
      setAvisoBandeja('El motivo del rechazo puede tener como máximo 300 caracteres.')
      return
    }
    setDecidiendo(id)
    setAvisoBandeja(null)
    // .select('id'): si RLS rechaza el update no da error, devuelve 0 filas.
    const { data, error } = await supabase
      .from('reportes')
      .update({ estado, revisado_por: session?.user.id ?? null, revisado_en: revisadoEn, comentario_admin: comentarioAdmin })
      .eq('id', id)
      .select('id')
    setDecidiendo(null)
    if (error || !data?.length) {
      setAvisoBandeja(error ? mensajeDeError(error) : 'No se pudo guardar la decisión. ¿Tu usuario es administrador?')
      return
    }
    setRechazandoId(null)
    setComentarioRechazo('')
    setReportes((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, estado, revisado_por: session?.user.id ?? null, revisado_en: revisadoEn, comentario_admin: comentarioAdmin }
          : r,
      ),
    )
    setTotales((t) => ({ ...t, pendientes: Math.max(0, t.pendientes - 1) }))
  }

  // Citas de pacientes que se cancelarían por una ausencia (para avisar antes).
  function citasAfectadas(reporte: ReporteEnriquecido): number {
    // ahora: reloj compartido (useAhora), no Date.now() durante el render.
    return citas.filter(
      (c) =>
        c.medico_id === reporte.medico_id &&
        (c.estado === 'pendiente' || c.estado === 'confirmada') &&
        Date.parse(c.inicio) > ahora &&
        claveDia(c.inicio) === reporte.fecha_afectada,
    ).length
  }

  async function cancelarPorAusencia(reporte: ReporteEnriquecido) {
    const n = citasAfectadas(reporte)
    const seguro = window.confirm(
      `${reporte.medico ?? 'El médico'} no atenderá ${textoDia(reporte.fecha_afectada)}.\n\n` +
        `Se cancelarán ${n} ${n === 1 ? 'cita' : 'citas'} de pacientes (lo verán al instante y podrán reprogramar) ` +
        `y se cerrará su agenda de ese día. ¿Continuar?`,
    )
    if (!seguro) return
    setDecidiendo(reporte.id)
    setAvisoBandeja(null)
    const { data, error } = await supabase.rpc('cancelar_citas_por_ausencia', { p_reporte: reporte.id })
    setDecidiendo(null)
    if (error) {
      setAvisoBandeja(mensajeDeError(error))
      return
    }
    const canceladas = (data as number) ?? 0
    setAvisoArchivado(
      canceladas === 0
        ? 'No quedaban citas de pacientes ese día. La agenda de ese día quedó cerrada.'
        : `${canceladas} ${canceladas === 1 ? 'cita cancelada' : 'citas canceladas'} y agenda de ese día cerrada.`,
    )
    await cargar()
  }

  async function archivarResueltos() {
    setArchivando(true)
    setAvisoArchivado(null)
    const { data, error } = await supabase.rpc('archivar_reportes_resueltos', { p_dias: DIAS_PARA_ARCHIVAR })
    if (error) {
      setAvisoArchivado(mensajeDeError(error))
    } else {
      const n = (data as number) ?? 0
      setAvisoArchivado(
        n === 0 ? `No hay reportes resueltos con más de ${TEXTO_PLAZO}.` : `${n} ${n === 1 ? 'reporte archivado' : 'reportes archivados'}.`,
      )
      await cargar()
    }
    setArchivando(false)
  }

  async function refrescar() {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  // Antes: asignar bus a conductor. Ahora: asignar sede a médico.
  async function asignarSede(medicoId: string, sedeId: string | null) {
    setGuardando(medicoId)
    setAvisoAsignacion(null)
    const { data, error } = await supabase.from('medicos').update({ sede_id: sedeId }).eq('id', medicoId).select()
    if (error || !data?.length) setAvisoAsignacion(error ? mensajeDeError(error) : 'No se pudo guardar. ¿Tu usuario es administrador?')
    await cargar()
    setGuardando(null)
  }

  // Abre los horarios de los próximos 14 días que todavía no existan.
  async function generarHorarios(medicoId: string) {
    setGuardando(medicoId)
    setAvisoAsignacion(null)
    const desde = new Date().toISOString()
    // Solo cuentan los horarios activos: una cita cancelada o rechazada ya no
    // ocupa su hora (la base reabre esa hora por su cuenta).
    const { data: existentes, error: errorExistentes } = await supabase
      .from('citas')
      .select('inicio')
      .eq('medico_id', medicoId)
      .in('estado', [...ESTADOS_ACTIVOS])
      .gte('inicio', desde)
    if (errorExistentes) {
      setAvisoAsignacion(mensajeDeError(errorExistentes))
      setGuardando(null)
      return
    }
    const ocupados = new Set(((existentes as { inicio: string }[]) ?? []).map((c) => Date.parse(c.inicio)))
    const nuevos: { medico_id: string; inicio: string }[] = []
    for (let i = 0; i <= DIAS_AGENDA; i++) {
      const dia = claveDia(new Date(Date.now() + i * 86_400_000))
      // Mediodía UTC para saber el día de la semana sin que se corra por zona.
      if (new Date(`${dia}T12:00:00Z`).getUTCDay() === 0) continue
      for (const h of HORAS_AGENDA) {
        const inicio = new Date(`${dia}T${String(h).padStart(2, '0')}:00:00-05:00`)
        if (inicio.getTime() > Date.now() && !ocupados.has(inicio.getTime())) {
          nuevos.push({ medico_id: medicoId, inicio: inicio.toISOString() })
        }
      }
    }
    if (nuevos.length === 0) {
      setAvisoAsignacion('Ese médico ya tiene abiertos todos sus horarios de los próximos 14 días.')
    } else {
      const { error } = await supabase.from('citas').insert(nuevos)
      // 23505: otro administrador abrió los mismos horarios a la vez (índice único).
      setAvisoAsignacion(
        error
          ? error.code === '23505'
            ? 'Algunos de esos horarios ya existían. Pulsa de nuevo "Generar horarios" para abrir solo los que faltan.'
            : mensajeDeError(error)
          : `${nuevos.length} horarios nuevos abiertos para ${nombreDe(medicoId)}.`,
      )
    }
    setGuardando(null)
  }

  const conteos = useMemo(
    () => ({
      pendiente: reportes.filter((r) => r.estado === 'pendiente').length,
      aprobado: reportes.filter((r) => r.estado === 'aprobado').length,
      rechazado: reportes.filter((r) => r.estado === 'rechazado').length,
    }),
    [reportes],
  )
  const visibles = useMemo(() => (filtro === 'todos' ? reportes : reportes.filter((r) => r.estado === filtro)), [reportes, filtro])
  const hoy = claveDia(new Date())
  const citasHoy = citas.filter((c) => claveDia(c.inicio) === hoy && c.estado !== 'rechazada').length
  const citasPendientes = citas.filter((c) => c.estado === 'pendiente').length

  return (
    <div className="relative flex min-h-svh flex-col bg-gradient-to-b from-[#f4f9fa] to-[#dfeced]">
      <Encabezado
        derecha={
          <button
            type="button"
            onClick={refrescar}
            disabled={refrescando}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refrescando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        }
      />
      <main className="relative z-10 flex-1 pb-32">
        <Portada alto="bajo" titulo="Panel de administración" subtitulo="Revisa novedades de los médicos, asigna sedes y supervisa las citas." />

        <div className="relative z-10 mx-auto -mt-16 max-w-6xl space-y-5 p-4 sm:-mt-20 sm:p-6">
          {errorCarga && (
            <AvisoError
              titulo={usuarios.length ? 'No se pudo actualizar el panel' : 'No se pudo cargar el panel'}
              detalle={usuarios.length ? `${errorCarga} Lo que ves puede estar desactualizado.` : errorCarga}
              onReintentar={refrescar}
              reintentando={refrescando}
            />
          )}
          {cargando ? (
            <p className="text-sm text-slate-500">Cargando panel…</p>
          ) : errorCarga && !usuarios.length ? null : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <Tarjeta
                  etiqueta="Novedades por revisar"
                  valor={totales.pendientes}
                  Icono={Clock}
                  destacada
                  nota={totales.pendientes === 0 ? 'Todo al día' : 'Requieren tu decisión'}
                />
                <Tarjeta etiqueta="Citas hoy" valor={citasHoy} Icono={CalendarDays} />
                <Tarjeta etiqueta="Citas por confirmar" valor={citasPendientes} Icono={ClipboardList} nota="Esperando al médico" />
                <Tarjeta etiqueta="Médicos" valor={medicos.length} Icono={Stethoscope} nota={`${sedes.length} sedes`} />
              </div>

              <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/80">
                {(
                  [
                    ['reportes', 'Novedades', Inbox],
                    ['citas', 'Citas', CalendarDays],
                    ['asignaciones', 'Médicos y sedes', Shuffle],
                    ['estadisticas', 'Estadísticas', BarChart3],
                  ] as const
                ).map(([clave, texto, Icono]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setVista(clave)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      vista === clave
                        ? 'bg-[#013b4d] text-white shadow-md shadow-[#013b4d]/20'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                    {texto}
                    {clave === 'reportes' && totales.pendientes > 0 && (
                      <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-amber-950">{totales.pendientes}</span>
                    )}
                  </button>
                ))}
              </div>

              {vista === 'estadisticas' ? (
                <PanelEstadisticas />
              ) : vista === 'citas' ? (
                <Panel titulo="Citas tomadas por pacientes" Icono={CalendarDays}>
                  {citas.length === 0 ? (
                    <p className="text-sm text-slate-500">Todavía no hay citas tomadas.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500">
                          <tr>
                            <th className="py-2 pr-3 font-medium">Fecha</th>
                            <th className="py-2 pr-3 font-medium">Paciente</th>
                            <th className="py-2 pr-3 font-medium">Médico</th>
                            <th className="py-2 pr-3 font-medium">Sede</th>
                            <th className="py-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {citas.map((c) => {
                            const m = medicos.find((x) => x.id === c.medico_id)
                            const { etiqueta, chip, Icono } = ESTADOS_CITA[c.estado]
                            return (
                              <tr key={c.id}>
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  {fechaLarga(c.inicio)} · {hora(c.inicio)}
                                </td>
                                <td className="py-2 pr-3">{nombreDe(c.paciente_id)}</td>
                                <td className="py-2 pr-3">{nombreDe(c.medico_id)}</td>
                                <td className="py-2 pr-3">{sedes.find((s) => s.id === m?.sede_id)?.nombre ?? '—'}</td>
                                <td className="py-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${chip}`}>
                                    <Icono className="h-3 w-3" /> {etiqueta}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              ) : vista === 'asignaciones' ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <Panel titulo="Médico y sede asignada" Icono={Shuffle}>
                      {avisoAsignacion && (
                        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">{avisoAsignacion}</p>
                      )}
                      <ul className="space-y-3">
                        {medicos.map((m) => {
                          const ocupado = guardando === m.id
                          return (
                            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg p-3 ring-1 ring-slate-200">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 uppercase">
                                {nombreDe(m.id).replace(/^Dra?\.\s*/, '').slice(0, 2)}
                              </span>
                              <span className="mr-auto min-w-0">
                                <span className="block truncate text-sm font-medium text-slate-900">{nombreDe(m.id)}</span>
                                <span className="block truncate text-xs text-slate-500">
                                  {especialidades.find((e) => e.id === m.especialidad_id)?.nombre} · {m.consultorio}
                                </span>
                              </span>
                              <select
                                value={m.sede_id ?? ''}
                                disabled={ocupado}
                                onChange={(e) => asignarSede(m.id, e.target.value || null)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-50 sm:w-52"
                              >
                                <option value="">Sin sede</option>
                                {sedes.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.nombre} · {s.ciudad}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => generarHorarios(m.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" /> Generar horarios
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </Panel>
                  </div>
                  <Panel titulo="Sedes" Icono={Building2}>
                    <ul className="space-y-3">
                      {sedes.map((s) => {
                        const n = medicos.filter((m) => m.sede_id === s.id).length
                        return (
                          <li key={s.id}>
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="truncate text-sm font-medium text-slate-800">{s.nombre}</p>
                              <span className="shrink-0 text-xs text-slate-500">
                                {n} {n === 1 ? 'médico' : 'médicos'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {s.ciudad} · {s.direccion}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  </Panel>
                </div>
              ) : (
                <Panel titulo={verArchivados ? 'Histórico archivado' : 'Bandeja de novedades'} Icono={Inbox}>
                  <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVerArchivados((v) => !v)
                        setAvisoArchivado(null)
                        setFiltro('todos')
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#2c6672] hover:underline"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {verArchivados ? 'Volver a la bandeja' : 'Ver histórico archivado'}
                    </button>
                    {!verArchivados && (
                      <button
                        type="button"
                        onClick={archivarResueltos}
                        disabled={archivando}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {archivando ? 'Archivando…' : `Archivar resueltos (+${TEXTO_PLAZO})`}
                      </button>
                    )}
                  </div>

                  {avisoArchivado && (
                    <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 ring-1 ring-slate-200">{avisoArchivado}</p>
                  )}
                  {avisoBandeja && (
                    <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 ring-1 ring-red-200">
                      {avisoBandeja}
                    </p>
                  )}

                  <BarraDistribucion conteos={conteos} total={reportes.length} />

                  <div className="mt-3 mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltro('todos')}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                        filtro === 'todos' ? 'bg-[#013b4d] text-white ring-[#013b4d]' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Todos {reportes.length}
                    </button>
                    {ORDEN_ESTADOS.map((estado) => {
                      const { etiqueta, color } = ESTADOS[estado]
                      const activo = filtro === estado
                      return (
                        <button
                          key={estado}
                          type="button"
                          onClick={() => setFiltro(estado)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                            activo ? 'bg-[#013b4d] text-white ring-[#013b4d]' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          {etiqueta} {conteos[estado]}
                        </button>
                      )
                    })}
                  </div>

                  {totales.bandeja > reportes.length && (
                    <p className="mb-3 text-xs text-slate-500">
                      Mostrando las {reportes.length} más recientes de {totales.bandeja}. Archiva las resueltas para ver el resto.
                    </p>
                  )}

                  {visibles.length === 0 ? (
                    <div className="py-10 text-center">
                      <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        {reportes.length === 0 ? 'No hay novedades todavía.' : 'Sin novedades en este filtro.'}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {visibles.map((reporte) => {
                        const { chip, Icono, etiqueta } = ESTADOS[reporte.estado]
                        return (
                          <li key={reporte.id} className="rounded-lg p-3 ring-1 ring-slate-200 transition-colors hover:bg-slate-50">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                                  {reporte.motivo}
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                    {TIPOS_REPORTE[reporte.tipo]} · para {textoDia(reporte.fecha_afectada)}
                                  </span>
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {reporte.medico ?? 'Médico desconocido'}
                                  {reporte.especialidad && ` · ${reporte.especialidad}`} · {tiempoRelativo(reporte.creado_en)}
                                </p>
                                {reporte.estado === 'rechazado' && reporte.comentario_admin && (
                                  <p className="mt-1 text-xs text-red-700">Motivo del rechazo: {reporte.comentario_admin}</p>
                                )}
                                {/* Ausencia aprobada de hoy o un día futuro: se puede cerrar la agenda de ese día. */}
                                {reporte.estado === 'aprobado' &&
                                  reporte.tipo === 'ausencia' &&
                                  !verArchivados &&
                                  reporte.fecha_afectada >= claveDia(new Date()) && (
                                    <button
                                      type="button"
                                      disabled={decidiendo === reporte.id}
                                      onClick={() => cancelarPorAusencia(reporte)}
                                      className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      Cancelar citas de ese día ({citasAfectadas(reporte)})
                                    </button>
                                  )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${chip}`}>
                                  <Icono className="h-3 w-3" />
                                  {etiqueta.slice(0, -1)}
                                </span>
                                {reporte.estado === 'pendiente' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={decidiendo === reporte.id}
                                      onClick={() => actualizarEstado(reporte.id, 'aprobado')}
                                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                      Aprobar y avisar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={decidiendo === reporte.id}
                                      onClick={() => {
                                        setRechazandoId(reporte.id)
                                        setComentarioRechazo('')
                                      }}
                                      aria-expanded={rechazandoId === reporte.id}
                                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {rechazandoId === reporte.id && reporte.estado === 'pendiente' && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  void actualizarEstado(reporte.id, 'rechazado', comentarioRechazo)
                                }}
                                className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-red-50/60 p-3 ring-1 ring-red-100"
                              >
                                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                                  Motivo del rechazo (opcional, lo verá el médico)
                                  <input
                                    type="text"
                                    value={comentarioRechazo}
                                    maxLength={300}
                                    autoFocus
                                    onChange={(e) => setComentarioRechazo(e.target.value)}
                                    placeholder="Ej.: ya se avisó por teléfono"
                                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-red-400"
                                  />
                                </label>
                                <button
                                  type="submit"
                                  disabled={decidiendo === reporte.id}
                                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  Confirmar rechazo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRechazandoId(null)}
                                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-white"
                                >
                                  Cancelar
                                </button>
                              </form>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
      </main>
      <Pie texto="Panel de administración" />
      <Plantas />
    </div>
  )
}
