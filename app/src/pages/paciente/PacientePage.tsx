import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock,
  FileText,
  Footprints,
  LocateFixed,
  MapPin,
  MapPinOff,
  Search,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { AjustarARuta, Mapa, MarcadorMiUbicacion, MarcadorParada } from '../../lib/Mapa'
import type { Coordenada } from '../../lib/mapaConfig'
import { DISTANCIA_MAXIMA_M, distanciaMetros, lugarMasCercano, minutosCaminando, textoDistancia } from '../../lib/paradaCercana'
import { useMiUbicacion, type MiUbicacion } from '../../hooks/useMiUbicacion'
import { useAlertaNovedades } from '../../hooks/useAlertaNovedades'
import { Encabezado, Pie, Plantas, Portada, TarjetaMetrica, TituloSeccion } from '../../lib/Plantilla'
import { ESTADOS_CITA, claveDia, diaCorto, fechaLarga, hora, iconoDe, proximosDias } from '../../lib/citas'
import type { Cita, Especialidad, Medico, Sede, Usuario } from '../../types/domain'

// Datos de catálogo que usan las tres vistas del paciente.
interface Catalogo {
  especialidades: Especialidad[]
  sedes: Sede[]
  medicos: Medico[]
  nombres: Map<string, string>
}

type Vista = { tipo: 'inicio' } | { tipo: 'agendar'; especialidad: Especialidad } | { tipo: 'mis-citas' }

const DIAS_AGENDA = 14

function esActiva(c: Cita) {
  return (c.estado === 'pendiente' || c.estado === 'confirmada') && Date.parse(c.inicio) > Date.now()
}

// Datos de una cita listos para mostrar: médico, especialidad y sede.
function detalleDe(cita: Cita, catalogo: Catalogo) {
  const medico = catalogo.medicos.find((m) => m.id === cita.medico_id)
  const especialidad = catalogo.especialidades.find((e) => e.id === medico?.especialidad_id)
  const sede = catalogo.sedes.find((s) => s.id === medico?.sede_id)
  return {
    medico: catalogo.nombres.get(cita.medico_id) ?? 'Médico',
    consultorio: medico?.consultorio ?? '',
    especialidad,
    sede,
  }
}

function IconoEspecialidad({ clave, grande = false }: { clave?: string; grande?: boolean }) {
  const Icono = iconoDe(clave ?? 'stethoscope')
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-teal-50 text-[#2c6672] ${grande ? 'h-16 w-16' : 'h-12 w-12'}`}
    >
      <Icono className={grande ? 'h-8 w-8' : 'h-6 w-6'} />
    </span>
  )
}

function ChipEstado({ estado }: { estado: Cita['estado'] }) {
  const { etiqueta, chip, Icono } = ESTADOS_CITA[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${chip}`}>
      <Icono className="h-4 w-4" />
      {etiqueta}
    </span>
  )
}

function AvisoAlerta({ motivo, medico, onCerrar }: { motivo: string; medico: string; onCerrar: () => void }) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-2xl bg-red-50 px-5 py-4 text-red-900 shadow-sm ring-1 ring-red-200">
      <span className="text-lg">🚨</span>
      <p className="mr-auto text-sm sm:text-base">
        <span className="font-semibold">Novedad con {medico}:</span> {motivo}
      </p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar alerta"
        className="rounded-full p-1 text-red-500 hover:bg-red-100"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta "Tu clínica más cercana": reciclada de "Tu parada más cercana".
// ---------------------------------------------------------------------------
function TarjetaSedeCercana({ miUbicacion, sedes }: { miUbicacion: MiUbicacion; sedes: Sede[] }) {
  const { posicion, estado } = miUbicacion
  const cercana = useMemo(() => (posicion ? lugarMasCercano(posicion, sedes) : null), [posicion, sedes])

  const aviso = (icono: React.ReactNode, texto: string) => (
    <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
      {icono}
      {texto}
    </div>
  )

  if (estado === 'denegado')
    return aviso(<MapPinOff className="h-4 w-4 text-slate-400" />, 'Activa tu ubicación para ver tu clínica más cercana.')
  if (estado === 'error' || estado === 'no-disponible')
    return aviso(<MapPinOff className="h-4 w-4 text-slate-400" />, 'No pudimos obtener tu ubicación.')
  if (estado === 'pidiendo' || !posicion)
    return aviso(<LocateFixed className="h-4 w-4 animate-pulse text-[#2c6672]" />, 'Buscando tu ubicación…')
  if (!cercana || cercana.metros > DISTANCIA_MAXIMA_M)
    return aviso(<MapPin className="h-4 w-4 text-slate-400" />, 'No hay clínicas cerca de ti.')

  const { lugar, metros } = cercana
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#2c6672] uppercase">
        <LocateFixed className="h-3.5 w-3.5" />
        Tu clínica más cercana
      </span>
      <span className="text-base font-semibold text-slate-900">{lugar.nombre}</span>
      <span className="text-sm text-slate-500">
        {lugar.direccion} · {lugar.ciudad}
      </span>
      <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        <Footprints className="h-3.5 w-3.5" />a {textoDistancia(metros)}
        {metros < 3000 && ` · ${minutosCaminando(metros)} min caminando`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vista inicio
// ---------------------------------------------------------------------------
function Inicio({
  catalogo,
  citas,
  miUbicacion,
  onAgendar,
  onMisCitas,
}: {
  catalogo: Catalogo
  citas: Cita[]
  miUbicacion: MiUbicacion
  onAgendar: (e: Especialidad) => void
  onMisCitas: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [sedeActiva, setSedeActiva] = useState<string | null>(null)

  const proxima = useMemo(
    () => citas.filter(esActiva).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0] ?? null,
    [citas],
  )

  // Busca por especialidad, por nombre del médico o por sede/ciudad.
  const especialidadesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return catalogo.especialidades
    return catalogo.especialidades.filter((e) => {
      const textoMedicos = catalogo.medicos
        .filter((m) => m.especialidad_id === e.id)
        .map((m) => {
          const sede = catalogo.sedes.find((s) => s.id === m.sede_id)
          return `${catalogo.nombres.get(m.id) ?? ''} ${sede?.nombre ?? ''} ${sede?.ciudad ?? ''}`
        })
        .join(' ')
      return `${e.nombre} ${e.descripcion} ${textoMedicos}`.toLowerCase().includes(termino)
    })
  }, [busqueda, catalogo])

  // El mapa encuadra las sedes de la zona del paciente (o las de Medellín si no
  // hay ubicación): con Bogotá incluida el mapa quedaría demasiado lejos.
  const puntoReferencia: Coordenada = miUbicacion.posicion ?? [6.2442, -75.5812]
  const sedesZona = catalogo.sedes.filter((s) => distanciaMetros(puntoReferencia, [s.lat, s.lng]) < 60_000)
  const puntosMapa: Coordenada[] = (sedesZona.length ? sedesZona : catalogo.sedes).map((s) => [s.lat, s.lng])

  const detalleProxima = proxima ? detalleDe(proxima, catalogo) : null

  return (
    <>
      <Portada titulo="¿Qué cita necesitas hoy?" subtitulo="Busca especialidad, médico o servicio y gestiona tus citas fácilmente." />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="-mt-10 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl shadow-[#013b4d]/15 ring-1 ring-slate-200/80 transition focus-within:ring-2 focus-within:ring-[#2c6672]">
          <Search className="h-5 w-5 shrink-0 text-[#2c6672]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar especialidad, médico o servicio…"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tu próxima cita */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-[#0f3a48] uppercase">
            <CalendarDays className="h-4 w-4 text-[#2c6672]" />
            Tu próxima cita
          </p>
          {proxima && detalleProxima ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-4 md:w-1/3">
                <IconoEspecialidad clave={detalleProxima.especialidad?.icono} grande />
                <div>
                  <p className="text-lg font-bold text-slate-900">{detalleProxima.especialidad?.nombre}</p>
                  <p className="text-sm font-medium text-slate-700">{detalleProxima.medico}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-700 md:flex-1 md:border-l md:border-slate-200 md:pl-6">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#2c6672]" />
                  {fechaLarga(proxima.inicio)} · {hora(proxima.inicio)}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#2c6672]" />
                  {detalleProxima.sede?.nombre} - {detalleProxima.consultorio}
                </p>
                {proxima.mensaje && <p className="pl-6 text-xs text-slate-500">{proxima.mensaje}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <ChipEstado estado={proxima.estado} />
                <button
                  type="button"
                  onClick={onMisCitas}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-[#013b4d] ring-1 ring-[#013b4d]/30 hover:bg-slate-50"
                >
                  Ver detalles
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No tienes citas próximas. Agenda una abajo.</p>
          )}
        </section>

        <TituloSeccion>{busqueda ? 'Resultados' : 'Servicios disponibles'}</TituloSeccion>
        {especialidadesFiltradas.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <Search className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm text-slate-500">Nada coincide con «{busqueda}».</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {especialidadesFiltradas.map((e) => {
              const medicos = catalogo.medicos.filter((m) => m.especialidad_id === e.id).length
              return (
                <div key={e.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start gap-3">
                    <IconoEspecialidad clave={e.icono} />
                    <div>
                      <p className="font-semibold text-slate-900">{e.nombre}</p>
                      <p className="text-xs text-slate-500">{e.descripcion}</p>
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    {medicos} {medicos === 1 ? 'médico disponible' : 'médicos disponibles'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAgendar(e)}
                    className="mt-auto rounded-xl bg-[#013b4d] py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d60]"
                  >
                    Agendar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <TituloSeccion>Clínicas y sedes</TituloSeccion>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <Mapa zoom={12} className="h-[340px] w-full">
              <AjustarARuta puntos={puntosMapa} margen={60} />
              {catalogo.sedes.map((s, i) => (
                <MarcadorParada
                  key={s.id}
                  posicion={[s.lat, s.lng]}
                  titulo={`${s.nombre} · ${s.ciudad}`}
                  numero={i + 1}
                  activa={sedeActiva === s.id}
                  onClick={() => setSedeActiva(s.id)}
                />
              ))}
              {miUbicacion.posicion && (
                <MarcadorMiUbicacion posicion={miUbicacion.posicion} precision={miUbicacion.precision} />
              )}
            </Mapa>
          </div>
          <div className="space-y-3">
            <TarjetaSedeCercana miUbicacion={miUbicacion} sedes={catalogo.sedes} />
            <ul className="space-y-2">
              {catalogo.sedes.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSedeActiva(s.id)}
                    className={`flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 transition-colors ${
                      sedeActiva === s.id ? 'ring-2 ring-[#e0484a]' : 'ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0f2f37] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{s.nombre}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {s.ciudad} · {s.direccion}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onMisCitas}
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2c6672] py-4 font-semibold text-white shadow-lg shadow-[#2c6672]/25 transition-all hover:bg-[#357888]"
        >
          <CalendarDays className="h-5 w-5" />
          Ver mis citas
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Vista agendar: calendario de horarios disponibles de una especialidad.
// ---------------------------------------------------------------------------
function Agendar({
  especialidad,
  catalogo,
  onVolver,
  onAgendada,
}: {
  especialidad: Especialidad
  catalogo: Catalogo
  onVolver: () => void
  onAgendada: () => void
}) {
  const medicosEsp = useMemo(
    () => catalogo.medicos.filter((m) => m.especialidad_id === especialidad.id),
    [catalogo.medicos, especialidad.id],
  )
  const ciudades = useMemo(
    () => [...new Set(medicosEsp.map((m) => catalogo.sedes.find((s) => s.id === m.sede_id)?.ciudad).filter(Boolean))] as string[],
    [medicosEsp, catalogo.sedes],
  )
  const [ciudad, setCiudad] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [dia, setDia] = useState(() => claveDia(new Date()))
  const [disponibles, setDisponibles] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [elegida, setElegida] = useState<Cita | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sedesFiltro = catalogo.sedes.filter(
    (s) => medicosEsp.some((m) => m.sede_id === s.id) && (!ciudad || s.ciudad === ciudad),
  )
  const medicosVisibles = medicosEsp.filter((m) => {
    const sede = catalogo.sedes.find((s) => s.id === m.sede_id)
    return (!ciudad || sede?.ciudad === ciudad) && (!sedeId || m.sede_id === sedeId)
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    const hasta = new Date(Date.now() + DIAS_AGENDA * 86_400_000).toISOString()
    const { data } = await supabase
      .from('citas')
      .select('*')
      .eq('estado', 'disponible')
      .in('medico_id', medicosEsp.map((m) => m.id))
      .gt('inicio', new Date().toISOString())
      .lt('inicio', hasta)
      .order('inicio')
    setDisponibles((data as Cita[]) ?? [])
    setCargando(false)
  }, [medicosEsp])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visiblesIds = new Set(medicosVisibles.map((m) => m.id))
  const diasConCupo = new Set(disponibles.filter((c) => visiblesIds.has(c.medico_id)).map((c) => claveDia(c.inicio)))
  const primerDiaConCupo = proximosDias(DIAS_AGENDA).find((d) => diasConCupo.has(d)) ?? null

  // Si el día elegido se quedó sin cupo (hoy ya tarde, domingo, otro filtro),
  // salta al primer día que sí tenga horarios.
  useEffect(() => {
    if (!cargando && primerDiaConCupo && !diasConCupo.has(dia)) {
      setDia(primerDiaConCupo)
      setElegida(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, primerDiaConCupo, ciudad, sedeId])

  async function confirmar() {
    if (!elegida) return
    setEnviando(true)
    setError(null)
    const { error: errorRpc } = await supabase.rpc('tomar_cita', { p_cita: elegida.id, p_motivo: motivo })
    setEnviando(false)
    if (errorRpc) {
      setError(errorRpc.message)
      void cargar()
      return
    }
    onAgendada()
  }

  const selectClase =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2c6672]'

  return (
    <>
      <Portada alto="bajo" titulo={`Agendar ${especialidad.nombre.toLowerCase()}`} subtitulo={especialidad.descripcion} />
      <div className="relative z-10 mx-auto -mt-10 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-white p-5 shadow-xl shadow-[#013b4d]/10 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onVolver}
              className="mr-auto flex items-center gap-2 text-sm font-medium text-[#2c6672] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <select
              value={ciudad}
              onChange={(e) => {
                setCiudad(e.target.value)
                setSedeId('')
              }}
              className={selectClase}
            >
              <option value="">Todas las ciudades</option>
              {ciudades.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className={selectClase}>
              <option value="">Todas las sedes</option>
              {sedesFiltro.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Calendario: los próximos 14 días. Los días sin cupo quedan apagados. */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {proximosDias(DIAS_AGENDA).map((clave) => {
              const { semana, numero, mes } = diaCorto(clave)
              const conCupo = diasConCupo.has(clave)
              const activo = dia === clave
              return (
                <button
                  key={clave}
                  type="button"
                  disabled={!conCupo}
                  onClick={() => {
                    setDia(clave)
                    setElegida(null)
                  }}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 text-xs ring-1 transition-colors ${
                    activo
                      ? 'bg-[#013b4d] text-white ring-[#013b4d]'
                      : conCupo
                        ? 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                        : 'bg-slate-50 text-slate-300 ring-slate-100'
                  }`}
                >
                  <span className="capitalize">{semana}</span>
                  <span className="text-xl font-bold">{numero}</span>
                  <span className="capitalize">{mes}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {cargando ? (
              <p className="text-sm text-slate-500">Cargando horarios…</p>
            ) : medicosVisibles.length === 0 ? (
              <p className="text-sm text-slate-500">No hay médicos con esos filtros.</p>
            ) : (
              medicosVisibles.map((m) => {
                const sede = catalogo.sedes.find((s) => s.id === m.sede_id)
                const horarios = disponibles.filter((c) => c.medico_id === m.id && claveDia(c.inicio) === dia)
                return (
                  <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-center gap-3">
                      <IconoEspecialidad clave={especialidad.icono} />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{catalogo.nombres.get(m.id)}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {sede?.nombre} · {sede?.ciudad} · {m.consultorio}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {horarios.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin horarios este día.</p>
                      ) : (
                        horarios.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setElegida(c)}
                            className={`rounded-xl px-3 py-1.5 text-sm font-medium ring-1 transition-colors ${
                              elegida?.id === c.id
                                ? 'bg-[#2c6672] text-white ring-[#2c6672]'
                                : 'bg-white text-[#013b4d] ring-slate-300 hover:bg-teal-50'
                            }`}
                          >
                            {hora(c.inicio)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
            <p className="mb-3 font-semibold text-slate-900">Resumen de tu cita</p>
            {elegida ? (
              (() => {
                const det = detalleDe(elegida, catalogo)
                return (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="text-slate-400">Médico:</span> {det.medico}
                    </p>
                    <p>
                      <span className="text-slate-400">Fecha:</span> {fechaLarga(elegida.inicio)}
                    </p>
                    <p>
                      <span className="text-slate-400">Hora:</span> {hora(elegida.inicio)}
                    </p>
                    <p>
                      <span className="text-slate-400">Sede:</span> {det.sede?.nombre} · {det.consultorio}
                    </p>
                    <label className="block pt-2 text-xs font-medium text-slate-500" htmlFor="motivo">
                      Motivo de la consulta (opcional)
                    </label>
                    <textarea
                      id="motivo"
                      rows={3}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: dolor de garganta"
                      className="w-full resize-none rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-[#2c6672]"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                      type="button"
                      onClick={confirmar}
                      disabled={enviando}
                      className="w-full rounded-xl bg-[#013b4d] py-3 text-sm font-semibold text-white hover:bg-[#0f4d60] disabled:opacity-50"
                    >
                      {enviando ? 'Agendando…' : 'Solicitar cita'}
                    </button>
                    <p className="text-xs text-slate-400">El médico debe aceptarla. Te avisaremos aquí mismo.</p>
                  </div>
                )
              })()
            ) : (
              <p className="text-sm text-slate-500">Elige un día y un horario.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Vista mis citas
// ---------------------------------------------------------------------------
type FiltroCitas = 'todas' | 'proximas' | 'pendientes' | 'historial'

function MisCitas({
  citas,
  catalogo,
  onVolver,
  onReagendar,
  onCambio,
}: {
  citas: Cita[]
  catalogo: Catalogo
  onVolver: () => void
  onReagendar: (e: Especialidad) => void
  onCambio: () => void
}) {
  const [filtro, setFiltro] = useState<FiltroCitas>('todas')
  const [error, setError] = useState<string | null>(null)

  const futura = (c: Cita) => Date.parse(c.inicio) > Date.now()
  const proximas = citas.filter((c) => c.estado === 'confirmada' && futura(c))
  const pendientes = citas.filter((c) => c.estado === 'pendiente' && futura(c))
  const historial = citas.filter((c) => !futura(c) || c.estado === 'rechazada' || c.estado === 'cancelada')

  const visibles = { todas: citas, proximas, pendientes, historial }[filtro]
    .slice()
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))

  async function cancelar(id: string) {
    setError(null)
    const { error: errorRpc } = await supabase.rpc('cancelar_cita', { p_cita: id })
    if (errorRpc) setError(errorRpc.message)
    onCambio()
  }

  return (
    <>
      <Portada alto="bajo" titulo="Mis citas" subtitulo="Consulta, gestiona y da seguimiento a todas tus citas médicas." />
      <div className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TarjetaMetrica etiqueta="Próximas" valor={proximas.length} Icono={CalendarCheck} tono="verde" nota="Confirmadas y por realizarse" />
          <TarjetaMetrica etiqueta="Pendientes" valor={pendientes.length} Icono={Clock} tono="ambar" nota="En espera del médico" />
          <TarjetaMetrica etiqueta="Historial" valor={historial.length} Icono={FileText} tono="azul" nota="Pasadas o rechazadas" />
        </div>

        <TituloSeccion
          accion={
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroCitas)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="todas">Todas las citas</option>
              <option value="proximas">Próximas</option>
              <option value="pendientes">Pendientes</option>
              <option value="historial">Historial</option>
            </select>
          }
        >
          Mis citas
        </TituloSeccion>

        <button
          type="button"
          onClick={onVolver}
          className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2c6672] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>

        {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        {visibles.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <CalendarX className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm text-slate-500">No hay citas en esta lista.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibles.map((c) => {
              const det = detalleDe(c, catalogo)
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center"
                >
                  <div className="flex items-center gap-4 lg:w-1/4">
                    <IconoEspecialidad clave={det.especialidad?.icono} grande />
                    <div>
                      <p className="font-bold text-slate-900">{det.especialidad?.nombre}</p>
                      <p className="text-sm text-slate-700">{det.medico}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-700 lg:flex-1 lg:border-l lg:border-slate-200 lg:pl-5">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#2c6672]" /> {fechaLarga(c.inicio)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#2c6672]" /> {hora(c.inicio)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#2c6672]" /> {det.sede?.nombre} - {det.consultorio}
                    </p>
                  </div>
                  <div className="space-y-1.5 lg:w-1/4 lg:border-l lg:border-slate-200 lg:pl-5">
                    <ChipEstado estado={c.estado} />
                    {c.mensaje && <p className="text-xs text-slate-500">{c.mensaje}</p>}
                  </div>
                  <div className="flex gap-2 lg:w-40 lg:flex-col">
                    {(c.estado === 'pendiente' || c.estado === 'confirmada') && futura(c) && (
                      <button
                        type="button"
                        onClick={() => cancelar(c.id)}
                        className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-300 hover:bg-red-50"
                      >
                        Cancelar cita
                      </button>
                    )}
                    {det.especialidad && (
                      <button
                        type="button"
                        onClick={() => onReagendar(det.especialidad!)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[#013b4d] hover:bg-slate-200"
                      >
                        <CalendarDays className="h-4 w-4" /> Reagendar
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
export function PacientePage() {
  const { session } = useAuth()
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' })
  const [catalogo, setCatalogo] = useState<Catalogo>({ especialidades: [], sedes: [], medicos: [], nombres: new Map() })
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  // Como en buses: la ubicación se pide una sola vez para toda la página.
  const miUbicacion = useMiUbicacion()
  const usuarioId = session?.user.id

  const cargarCatalogo = useCallback(async () => {
    const [resEsp, resSedes, resMedicos, resUsuarios] = await Promise.all([
      supabase.from('especialidades').select('*').order('nombre'),
      supabase.from('sedes').select('*').order('nombre'),
      supabase.from('medicos').select('*'),
      supabase.from('usuarios').select('id, nombre, rol').eq('rol', 'medico'),
    ])
    // Medicina general primero, como en la referencia.
    const especialidades = ((resEsp.data as Especialidad[]) ?? []).sort((a, b) =>
      a.nombre === 'Medicina general' ? -1 : b.nombre === 'Medicina general' ? 1 : a.nombre.localeCompare(b.nombre),
    )
    setCatalogo({
      especialidades,
      sedes: (resSedes.data as Sede[]) ?? [],
      medicos: (resMedicos.data as Medico[]) ?? [],
      nombres: new Map(((resUsuarios.data as Usuario[]) ?? []).map((u) => [u.id, u.nombre])),
    })
  }, [])

  const cargarCitas = useCallback(async () => {
    if (!usuarioId) return
    const { data } = await supabase.from('citas').select('*').eq('paciente_id', usuarioId).order('inicio')
    setCitas((data as Cita[]) ?? [])
  }, [usuarioId])

  useEffect(() => {
    void Promise.all([cargarCatalogo(), cargarCitas()]).then(() => setCargando(false))
  }, [cargarCatalogo, cargarCitas])

  // Cuando el médico acepta o rechaza, la cita cambia en vivo.
  useEffect(() => {
    if (!usuarioId) return
    const canal = supabase
      .channel('citas-paciente')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'citas', filter: `paciente_id=eq.${usuarioId}` },
        () => void cargarCitas(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [usuarioId, cargarCitas])

  const medicosConCita = useMemo(() => [...new Set(citas.filter(esActiva).map((c) => c.medico_id))], [citas])
  const { alerta, cerrar } = useAlertaNovedades(medicosConCita)

  return (
    <div className="relative flex min-h-svh w-full flex-col bg-gradient-to-b from-[#f4f9fa] via-[#e9f3f4] to-[#d8e9eb]">
      <Encabezado />
      <main className="relative z-10 flex-1 pb-32">
        {alerta && (
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <AvisoAlerta
              motivo={alerta.motivo}
              medico={catalogo.nombres.get(alerta.medicoId) ?? 'tu médico'}
              onCerrar={cerrar}
            />
          </div>
        )}
        {cargando ? (
          <p className="p-10 text-center text-sm text-slate-500">Cargando…</p>
        ) : vista.tipo === 'agendar' ? (
          <Agendar
            especialidad={vista.especialidad}
            catalogo={catalogo}
            onVolver={() => setVista({ tipo: 'inicio' })}
            onAgendada={() => {
              void cargarCitas()
              setVista({ tipo: 'mis-citas' })
            }}
          />
        ) : vista.tipo === 'mis-citas' ? (
          <MisCitas
            citas={citas}
            catalogo={catalogo}
            onVolver={() => setVista({ tipo: 'inicio' })}
            onReagendar={(e) => setVista({ tipo: 'agendar', especialidad: e })}
            onCambio={() => void cargarCitas()}
          />
        ) : (
          <Inicio
            catalogo={catalogo}
            citas={citas}
            miUbicacion={miUbicacion}
            onAgendar={(e) => setVista({ tipo: 'agendar', especialidad: e })}
            onMisCitas={() => setVista({ tipo: 'mis-citas' })}
          />
        )}
      </main>
      <Pie texto="Tu salud, nuestra prioridad" />
      <Plantas />
      {/* Atajo flotante en móvil, igual que el "Ver mapa" del pasajero. */}
      {vista.tipo === 'inicio' && !cargando && (
        <button
          type="button"
          onClick={() => setVista({ tipo: 'mis-citas' })}
          className="fixed right-4 bottom-16 z-20 flex items-center gap-2 rounded-full bg-[#013b4d] px-4 py-3 text-sm font-semibold text-white shadow-xl sm:hidden"
        >
          Mis citas <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
