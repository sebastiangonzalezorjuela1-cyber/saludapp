import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock,
  Check,
  MapPin,
  MessageSquareText,
  Send,
  TriangleAlert,
  UserRound,
  X,
  CalendarX,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { Encabezado, Pie, Plantas, Portada, TarjetaMetrica } from '../../lib/Plantilla'
import { ESTADOS_CITA, claveDia, fechaLarga, hora } from '../../lib/citas'
import type { Cita, Especialidad, Medico, Reporte, Sede, Usuario } from '../../types/domain'

// Reciclada de la pantalla del conductor. Lo que cambia es qué se gestiona:
//   antes: elegir unidad, iniciar recorrido, reportar novedad.
//   ahora: aceptar/rechazar citas y reportar novedad (retraso, no disponible).
// El panel "¿Qué novedad tienes?" y su envío a `reportes` son los mismos.

// `motivo` es lo que se guarda en el reporte y lee el administrador.
const OPCIONES_RAPIDAS: { motivo: string; titulo: string; detalle: string; Icono: LucideIcon }[] = [
  { motivo: 'Retraso de 10 min', titulo: '10 min', detalle: 'de retraso', Icono: Clock },
  { motivo: 'Retraso de 15 min', titulo: '15 min', detalle: 'de retraso', Icono: Clock },
  { motivo: 'No disponible hoy', titulo: 'No disponible', detalle: 'hoy', Icono: CalendarX },
]

function claseOpcion(seleccionada: boolean) {
  return `flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
    seleccionada
      ? 'border-[#2c6672] bg-[#2c6672]/10 shadow-sm'
      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
  }`
}

function claseIconoOpcion(seleccionada: boolean) {
  return `grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
    seleccionada ? 'bg-[#2c6672] text-white' : 'bg-slate-100 text-slate-500'
  }`
}

const ESTADO_REPORTE: Record<Reporte['estado'], string> = {
  pendiente: 'En revisión',
  aprobado: 'Avisado a pacientes',
  rechazado: 'Rechazado',
}

export function MedicoPage() {
  const { session } = useAuth()
  const medicoId = session?.user.id
  const [perfil, setPerfil] = useState<{ medico: Medico | null; sede: Sede | null; especialidad: Especialidad | null }>({
    medico: null,
    sede: null,
    especialidad: null,
  })
  const [citas, setCitas] = useState<Cita[]>([])
  const [pacientes, setPacientes] = useState<Map<string, string>>(new Map())
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorCita, setErrorCita] = useState<string | null>(null)

  // Estado del panel de novedades: igual al del conductor.
  const [mostrarReporte, setMostrarReporte] = useState(false)
  const [tipoNovedad, setTipoNovedad] = useState('')
  const [mostrarInputTexto, setMostrarInputTexto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!medicoId) return
    // Desde el inicio del día: las de hoy ya pasadas también cuentan en "Citas hoy".
    const inicioHoy = new Date(`${claveDia(new Date())}T00:00:00-05:00`).toISOString()
    const [resMedico, resCitas, resPacientes, resReportes] = await Promise.all([
      supabase.from('medicos').select('*').eq('id', medicoId).single(),
      supabase.from('citas').select('*').eq('medico_id', medicoId).gte('inicio', inicioHoy).order('inicio'),
      supabase.from('usuarios').select('id, nombre, rol').eq('rol', 'paciente'),
      supabase
        .from('reportes')
        .select('*')
        .eq('medico_id', medicoId)
        .order('creado_en', { ascending: false })
        .limit(5),
    ])
    const medico = (resMedico.data as Medico) ?? null
    const [resSede, resEsp] = await Promise.all([
      medico?.sede_id ? supabase.from('sedes').select('*').eq('id', medico.sede_id).single() : Promise.resolve({ data: null }),
      medico ? supabase.from('especialidades').select('*').eq('id', medico.especialidad_id).single() : Promise.resolve({ data: null }),
    ])
    setPerfil({ medico, sede: (resSede.data as Sede) ?? null, especialidad: (resEsp.data as Especialidad) ?? null })
    setCitas((resCitas.data as Cita[]) ?? [])
    setPacientes(new Map(((resPacientes.data as Usuario[]) ?? []).map((u) => [u.id, u.nombre])))
    setReportes((resReportes.data as Reporte[]) ?? [])
    setCargando(false)
  }, [medicoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Un paciente toma una cita mientras el médico mira el panel: entra sola.
  useEffect(() => {
    if (!medicoId) return
    const canal = supabase
      .channel('citas-medico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas', filter: `medico_id=eq.${medicoId}` }, () => {
        void cargar()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reportes', filter: `medico_id=eq.${medicoId}` }, () => {
        void cargar()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [medicoId, cargar])

  const asignadas = useMemo(() => citas.filter((c) => c.estado !== 'disponible' && c.estado !== 'cancelada'), [citas])
  const hoy = claveDia(new Date())
  const conteos = {
    hoy: asignadas.filter((c) => claveDia(c.inicio) === hoy).length,
    pendientes: asignadas.filter((c) => c.estado === 'pendiente').length,
    confirmadas: asignadas.filter((c) => c.estado === 'confirmada').length,
    libres: citas.filter((c) => c.estado === 'disponible').length,
  }
  // Pendientes arriba: son las que piden una decisión.
  const lista = useMemo(
    () =>
      asignadas
        .filter((c) => Date.parse(c.inicio) > Date.now() - 60 * 60 * 1000)
        .sort((a, b) =>
          a.estado === b.estado
            ? Date.parse(a.inicio) - Date.parse(b.inicio)
            : a.estado === 'pendiente'
              ? -1
              : b.estado === 'pendiente'
                ? 1
                : Date.parse(a.inicio) - Date.parse(b.inicio),
        ),
    [asignadas],
  )
  const seleccionada = lista.find((c) => c.id === seleccionadaId) ?? lista[0] ?? null

  async function responder(cita: Cita, estado: 'confirmada' | 'rechazada', texto?: string) {
    setGuardando(true)
    setErrorCita(null)
    const { error: errorRpc } = await supabase.rpc('responder_cita', {
      p_cita: cita.id,
      p_estado: estado,
      p_mensaje: texto ?? null,
    })
    setGuardando(false)
    if (errorRpc) {
      setErrorCita(errorRpc.message)
      return
    }
    setMensaje('')
    void cargar()
  }

  function elegirOpcionRapida(opcion: string) {
    setTipoNovedad(opcion)
    setMostrarInputTexto(false)
  }

  function cerrarModalReporte() {
    setMostrarReporte(false)
    setTipoNovedad('')
    setMostrarInputTexto(false)
    setError(null)
  }

  async function reportarNovedad() {
    if (!medicoId || !tipoNovedad.trim()) return
    setEnviando(true)
    setError(null)
    setEnviado(false)
    const { error: insertError } = await supabase.from('reportes').insert({
      medico_id: medicoId,
      motivo: tipoNovedad.trim(),
      estado: 'pendiente',
    })
    setEnviando(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    cerrarModalReporte()
    setEnviado(true)
    void cargar()
  }

  return (
    <div className="relative flex min-h-svh w-full flex-col bg-gradient-to-b from-[#f4f9fa] to-[#dfeced]">
      <Encabezado />
      <main className="relative z-10 flex-1 pb-32">
        <Portada
          alto="bajo"
          titulo="Mis citas"
          subtitulo={
            perfil.especialidad
              ? `${perfil.especialidad.nombre} · ${perfil.sede?.nombre ?? 'Sin sede'} · ${perfil.medico?.consultorio ?? ''}`
              : 'Gestiona tus citas, acepta solicitudes y reporta retrasos o novedades a tus pacientes.'
          }
        />

        <div className="relative z-10 mx-auto -mt-12 w-full max-w-6xl space-y-5 px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaMetrica etiqueta="Citas hoy" valor={conteos.hoy} Icono={CalendarDays} tono="azul" />
            <TarjetaMetrica etiqueta="Pendientes" valor={conteos.pendientes} Icono={Clock} tono="ambar" />
            <TarjetaMetrica etiqueta="Confirmadas" valor={conteos.confirmadas} Icono={CircleCheck} tono="verde" />
            <TarjetaMetrica etiqueta="Horarios libres" valor={conteos.libres} Icono={CalendarClock} tono="teal" nota="Próximos 14 días" />
          </div>

          {cargando ? (
            <p className="text-sm text-slate-500">Cargando tus citas…</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-3">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                  <CalendarDays className="h-5 w-5 text-[#2c6672]" /> Próximas citas
                </h2>
                {lista.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No tienes citas asignadas todavía.</p>
                ) : (
                  <ul className="space-y-2">
                    {lista.map((c) => {
                      const { etiqueta, chip, Icono } = ESTADOS_CITA[c.estado]
                      const activa = seleccionada?.id === c.id
                      return (
                        <li
                          key={c.id}
                          className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ring-1 transition-colors ${
                            activa ? 'bg-sky-50/70 ring-sky-200' : 'ring-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <button type="button" onClick={() => setSeleccionadaId(c.id)} className="min-w-0 flex-1 text-left">
                            <p className="font-bold text-slate-900">
                              {hora(c.inicio)}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                {claveDia(c.inicio) === hoy ? 'Hoy' : fechaLarga(c.inicio)}
                              </span>
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                              {(c.paciente_id && pacientes.get(c.paciente_id)) || 'Paciente'}
                            </p>
                            {c.motivo && <p className="text-xs text-slate-500">{c.motivo}</p>}
                          </button>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${chip}`}>
                            <Icono className="h-3.5 w-3.5" /> {etiqueta}
                          </span>
                          {c.estado === 'pendiente' && (
                            <span className="flex gap-2">
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => responder(c, 'confirmada')}
                                className="rounded-lg bg-[#013b4d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f4d60] disabled:opacity-50"
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => responder(c, 'rechazada')}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                  <UserRound className="h-5 w-5 text-[#2c6672]" /> Gestionar cita seleccionada
                </h2>
                {seleccionada ? (
                  <div className="space-y-3 text-sm">
                    <dl className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                      {[
                        ['Paciente', (seleccionada.paciente_id && pacientes.get(seleccionada.paciente_id)) || '—'],
                        ['Fecha', fechaLarga(seleccionada.inicio)],
                        ['Hora', hora(seleccionada.inicio)],
                        ['Motivo', seleccionada.motivo ?? '—'],
                        ['Sede', `${perfil.sede?.nombre ?? '—'} · ${perfil.medico?.consultorio ?? ''}`],
                        ['Estado', ESTADOS_CITA[seleccionada.estado].etiqueta],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-3 px-3 py-2">
                          <dt className="w-20 shrink-0 text-slate-400">{k}:</dt>
                          <dd className="text-slate-800">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <label htmlFor="mensaje" className="block text-xs font-medium text-slate-500">
                      Mensaje al paciente
                    </label>
                    <textarea
                      id="mensaje"
                      rows={2}
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder={seleccionada.mensaje ?? 'Escribe un mensaje opcional…'}
                      className="w-full resize-none rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-[#2c6672]"
                    />
                    {errorCita && <p className="text-sm text-red-600">{errorCita}</p>}
                    {(seleccionada.estado === 'pendiente' || seleccionada.estado === 'confirmada') && (
                      <div className="space-y-2">
                        {seleccionada.estado === 'pendiente' && (
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => responder(seleccionada, 'confirmada', mensaje)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#013b4d] py-3 font-semibold text-white hover:bg-[#0f4d60] disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" /> Aceptar cita
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => responder(seleccionada, 'rechazada', mensaje)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-red-600 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" /> {seleccionada.estado === 'pendiente' ? 'Rechazar solicitud' : 'Cancelar cita'}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEnviado(false)
                        setMostrarReporte(true)
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50"
                    >
                      <TriangleAlert className="h-4 w-4" /> Reportar retraso
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Elige una cita de la lista.</p>
                )}
              </section>
            </div>
          )}

          {/* Panel de novedades: reciclado del conductor casi sin cambios. */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            {enviado && !mostrarReporte && (
              <p className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CircleCheck className="h-4 w-4" />
                Novedad enviada al administrador. Tus pacientes la verán cuando la apruebe.
              </p>
            )}

            {mostrarReporte ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">¿Qué novedad tienes?</p>
                  <button
                    type="button"
                    onClick={cerrarModalReporte}
                    aria-label="Cancelar reporte"
                    className="grid h-10 w-10 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {OPCIONES_RAPIDAS.map(({ motivo, titulo, detalle, Icono }) => {
                    const sel = tipoNovedad === motivo && !mostrarInputTexto
                    return (
                      <button
                        key={motivo}
                        type="button"
                        onClick={() => elegirOpcionRapida(motivo)}
                        aria-pressed={sel}
                        className={claseOpcion(sel)}
                      >
                        <span className={claseIconoOpcion(sel)}>
                          <Icono className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-lg leading-tight font-bold text-slate-900">{titulo}</span>
                          <span className="block text-xs text-slate-500">{detalle}</span>
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarInputTexto(true)
                      setTipoNovedad('')
                    }}
                    aria-pressed={mostrarInputTexto}
                    className={`sm:col-span-3 ${claseOpcion(mostrarInputTexto)}`}
                  >
                    <span className={claseIconoOpcion(mostrarInputTexto)}>
                      <MessageSquareText className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-bold text-slate-900">Otra novedad</span>
                      <span className="block text-xs text-slate-500">Cambio de consultorio, urgencia, reprogramación…</span>
                    </span>
                  </button>
                </div>
                {mostrarInputTexto && (
                  <textarea
                    value={tipoNovedad}
                    onChange={(e) => setTipoNovedad(e.target.value)}
                    placeholder="Escribe qué está pasando…"
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-2xl border-2 border-slate-200 p-3 text-base outline-none transition-colors focus:border-[#2c6672]"
                  />
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="button"
                  onClick={reportarNovedad}
                  disabled={enviando || !tipoNovedad.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  <Send className="h-5 w-5" />
                  {enviando ? 'Enviando…' : 'Enviar novedad'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="mr-auto">
                  <p className="font-semibold text-slate-900">Novedades rápidas</p>
                  <p className="text-sm text-slate-500">Avisa retrasos o ausencias a tus pacientes (pasan por el administrador).</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEnviado(false)
                    setMostrarReporte(true)
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white shadow-lg shadow-red-600/25 hover:bg-red-700"
                >
                  <TriangleAlert className="h-5 w-5" /> Reportar novedad
                </button>
              </div>
            )}

            {reportes.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                {reportes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {r.motivo}
                    </span>
                    <span className="text-xs text-slate-500">{ESTADO_REPORTE[r.estado]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Pie texto="Panel médico" />
      <Plantas />
    </div>
  )
}
