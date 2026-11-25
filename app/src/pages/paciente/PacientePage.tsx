import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
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
  Navigation,
  Repeat,
  Search,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'
import { mensajeDeError } from '../../lib/mensajesError'
import { AvisoError } from '../../lib/AvisoError'
import { AjustarARuta, Mapa, MarcadorMiUbicacion, MarcadorParada } from '../../lib/Mapa'
import type { Coordenada } from '../../lib/mapaConfig'
import { DISTANCIA_MAXIMA_M, distanciaMetros, lugarMasCercano, minutosCaminando, textoDistancia } from '../../lib/paradaCercana'
import { useMiUbicacion, type MiUbicacion } from '../../hooks/useMiUbicacion'
import { useAlertasNovedades, type AlertaCita } from '../../hooks/useAlertasNovedades'
import { Encabezado, Pie, Plantas, Portada, TarjetaMetrica, TituloSeccion } from '../../lib/Plantilla'
import {
  ESTADOS_CITA,
  HORAS_LIMITE_CANCELACION,
  claveDia,
  diaCorto,
  fechaLarga,
  hora,
  iconoDe,
  proximosDias,
  textoDia,
  sePuedeCancelar,
} from '../../lib/citas'
import type { Cita, Especialidad, Medico, Sede, Usuario } from '../../types/domain'

// Datos de catálogo que usan las tres vistas del paciente.
interface Catalogo {
  especialidades: Especialidad[]
  sedes: Sede[]
  medicos: Medico[]
  nombres: Map<string, string>
}

// `reprogramar`: la cita que se va a mover. Si viene, el agendador cambia esa
// cita por el horario nuevo en una sola operación (reprogramar_cita).
// La vista vive en la URL (patrón UsuarioPage de la guía de Buses Metro): así
// el "atrás" del celular funciona y se puede compartir el enlace de una cita.
type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'agendar'; especialidad: Especialidad; reprogramar?: Cita }
  | { tipo: 'mis-citas' }
  | { tipo: 'detalle'; cita: Cita }

function rutaDe(vista: Vista): string {
  switch (vista.tipo) {
    case 'inicio':
      return '/paciente'
    case 'mis-citas':
      return '/paciente/citas'
    case 'detalle':
      return `/paciente/citas/${vista.cita.id}`
    case 'agendar':
      return `/paciente/agendar/${vista.especialidad.id}${vista.reprogramar ? `?reprogramar=${vista.reprogramar.id}` : ''}`
  }
}

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

// Texto de la alerta según el tipo de novedad: lo útil para el paciente es
// cuándo lo atienden, no solo qué pasó.
function textoAlerta(alerta: AlertaCita, medico: string): string {
  const { cita } = alerta
  const cuando = `${textoDia(claveDia(cita.inicio))} a las ${hora(cita.inicio)}`
  if (alerta.tipo === 'ausencia')
    return `${medico} no podrá atender ${textoDia(claveDia(cita.inicio))}. Tu cita de ${cuando} puede cancelarse; puedes reprogramarla desde "Mis citas".`
  if (alerta.tipo === 'retraso' && alerta.horaEstimada)
    return `Tu cita con ${medico} de ${cuando} podría empezar hacia las ${hora(alerta.horaEstimada)} (${alerta.minutos} min de retraso).`
  return `Novedad con ${medico} para tu cita de ${cuando}: ${alerta.motivos.join(' · ')}`
}

function AvisoAlerta({ alerta, medico, onCerrar }: { alerta: AlertaCita; medico: string; onCerrar: () => void }) {
  return (
    <div role="alert" className="mt-6 flex items-center gap-3 rounded-2xl bg-red-50 px-5 py-4 text-red-900 shadow-sm ring-1 ring-red-200">
      <span className="text-lg" aria-hidden="true">
        🚨
      </span>
      <p className="mr-auto text-sm sm:text-base">
        <span className="font-semibold">Novedad: </span>
        {textoAlerta(alerta, medico)}
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

// Marca junto a una cita afectada por una novedad aprobada. Queda aunque el
// paciente cierre el aviso de arriba. Icono + texto: el color nunca va solo.
function MarcaNovedad({ alerta }: { alerta?: AlertaCita }) {
  if (!alerta) return null
  const texto =
    alerta.tipo === 'ausencia'
      ? 'El médico no atenderá este día'
      : alerta.horaEstimada
        ? `Hora estimada: ${hora(alerta.horaEstimada)} (+${alerta.minutos} min)`
        : 'Hay una novedad del médico'
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {texto}
    </span>
  )
}

// ---------------------------------------------------------------------------
// "Cómo llegar": distancia desde el paciente y enlace a las indicaciones de
// Google Maps. El enlace es la URL pública de Maps: no gasta la clave de la API.
// ---------------------------------------------------------------------------
function ComoLlegar({ sede, miUbicacion }: { sede: Sede; miUbicacion: MiUbicacion }) {
  const metros = miUbicacion.posicion ? distanciaMetros(miUbicacion.posicion, [sede.lat, sede.lng]) : null
  const url = `https://www.google.com/maps/dir/?api=1&destination=${sede.lat},${sede.lng}`
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {metros !== null && (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Footprints className="h-3.5 w-3.5" aria-hidden="true" />a {textoDistancia(metros)}
          {metros < 3000 && ` · ${minutosCaminando(metros)} min caminando`}
        </span>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2c6672] hover:underline"
      >
        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
        Cómo llegar
        <span className="sr-only"> a {sede.nombre} (abre Google Maps)</span>
      </a>
    </span>
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
  novedadesPorCita,
  onAgendar,
  onMisCitas,
  onVerCita,
}: {
  catalogo: Catalogo
  citas: Cita[]
  miUbicacion: MiUbicacion
  novedadesPorCita: Map<string, AlertaCita>
  onAgendar: (e: Especialidad) => void
  onMisCitas: () => void
  onVerCita: (cita: Cita) => void
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
                {detalleProxima.sede && (
                  <div className="pl-6">
                    <ComoLlegar sede={detalleProxima.sede} miUbicacion={miUbicacion} />
                  </div>
                )}
                {proxima.mensaje && <p className="pl-6 text-xs text-slate-500">{proxima.mensaje}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <ChipEstado estado={proxima.estado} />
                <MarcaNovedad alerta={novedadesPorCita.get(proxima.id)} />
                <button
                  type="button"
                  onClick={() => onVerCita(proxima)}
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
  reprogramar,
  catalogo,
  onVolver,
  onAgendada,
}: {
  especialidad: Especialidad
  reprogramar?: Cita
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
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

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
    const { data, error: errorConsulta } = await supabase
      .from('citas')
      .select('*')
      .eq('estado', 'disponible')
      .in('medico_id', medicosEsp.map((m) => m.id))
      .gt('inicio', new Date().toISOString())
      .lt('inicio', hasta)
      .order('inicio')
    // Si falla, se conservan los horarios que ya había y se avisa.
    if (errorConsulta) setErrorCarga(mensajeDeError(errorConsulta))
    else {
      setErrorCarga(null)
      setDisponibles((data as Cita[]) ?? [])
    }
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
    // Reprogramar cambia la cita vieja por la nueva en una sola transacción:
    // si el horario nuevo ya no está, la cita original queda intacta.
    const { error: errorRpc } = reprogramar
      ? await supabase.rpc('reprogramar_cita', { p_actual: reprogramar.id, p_nueva: elegida.id, p_motivo: motivo })
      : await supabase.rpc('tomar_cita', { p_cita: elegida.id, p_motivo: motivo })
    setEnviando(false)
    if (errorRpc) {
      setError(mensajeDeError(errorRpc))
      void cargar()
      return
    }
    onAgendada()
  }

  const selectClase =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2c6672]'

  return (
    <>
      <Portada
        alto="bajo"
        titulo={`${reprogramar ? 'Reprogramar' : 'Agendar'} ${especialidad.nombre.toLowerCase()}`}
        subtitulo={
          reprogramar
            ? `Elige el nuevo horario. Tu cita actual (${fechaLarga(reprogramar.inicio)} · ${hora(reprogramar.inicio)}) se mantiene hasta que confirmes.`
            : especialidad.descripcion
        }
      />
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
            {errorCarga && (
              <AvisoError
                titulo={disponibles.length ? 'No se pudieron actualizar los horarios' : 'No se pudieron cargar los horarios'}
                detalle={errorCarga}
                onReintentar={() => void cargar()}
                reintentando={cargando}
              />
            )}
            {cargando ? (
              <p className="text-sm text-slate-500">Cargando horarios…</p>
            ) : errorCarga && disponibles.length === 0 ? null : medicosVisibles.length === 0 ? (
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
                      {enviando ? 'Guardando…' : reprogramar ? 'Reprogramar cita' : 'Solicitar cita'}
                    </button>
                    <p className="text-xs text-slate-400">
                      {reprogramar
                        ? 'Tu cita anterior se cancelará y su horario quedará libre. El médico debe aceptar la nueva.'
                        : 'El médico debe aceptarla. Te avisaremos aquí mismo.'}
                    </p>
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

// Cancelación compartida por "Mis citas" y el detalle de una cita.
function confirmarCancelacion(cita: Cita, medico: string): boolean {
  return window.confirm(
    `¿Cancelar tu cita con ${medico} del ${fechaLarga(cita.inicio)} a las ${hora(cita.inicio)}?\n\nEl horario quedará libre para otro paciente.`,
  )
}

// Devuelve el mensaje de error, o null si se canceló bien.
async function cancelarCita(cita: Cita): Promise<string | null> {
  const { error } = await supabase.rpc('cancelar_cita', { p_cita: cita.id })
  return error ? mensajeDeError(error) : null
}

function MisCitas({
  citas,
  catalogo,
  miUbicacion,
  novedadesPorCita,
  onVolver,
  onReagendar,
  onVerCita,
  onCambio,
}: {
  citas: Cita[]
  catalogo: Catalogo
  miUbicacion: MiUbicacion
  novedadesPorCita: Map<string, AlertaCita>
  onVolver: () => void
  onReagendar: (e: Especialidad, reprogramar?: Cita) => void
  onVerCita: (cita: Cita) => void
  onCambio: () => void
}) {
  const [filtro, setFiltro] = useState<FiltroCitas>('todas')
  const [error, setError] = useState<string | null>(null)
  // Id de la cita que se está cancelando: evita el doble toque.
  const [cancelando, setCancelando] = useState<string | null>(null)

  const futura = (c: Cita) => Date.parse(c.inicio) > Date.now()
  const proximas = citas.filter((c) => c.estado === 'confirmada' && futura(c))
  const pendientes = citas.filter((c) => c.estado === 'pendiente' && futura(c))
  const historial = citas.filter((c) => !futura(c) || c.estado === 'rechazada' || c.estado === 'cancelada')

  const visibles = { todas: citas, proximas, pendientes, historial }[filtro]
    .slice()
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))

  async function cancelar(cita: Cita, medico: string) {
    if (!confirmarCancelacion(cita, medico)) return
    setError(null)
    setCancelando(cita.id)
    const fallo = await cancelarCita(cita)
    setCancelando(null)
    if (fallo) setError(fallo)
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
              const activa = (c.estado === 'pendiente' || c.estado === 'confirmada') && futura(c)
              const modificable = sePuedeCancelar(c.inicio)
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center"
                >
                  <button
                    type="button"
                    onClick={() => onVerCita(c)}
                    className="group flex items-center gap-4 rounded-xl text-left lg:w-1/4"
                  >
                    <IconoEspecialidad clave={det.especialidad?.icono} grande />
                    <span>
                      <span className="block font-bold text-slate-900">{det.especialidad?.nombre}</span>
                      <span className="block text-sm text-slate-700">{det.medico}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#2c6672] group-hover:underline">
                        Ver detalle <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
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
                    {activa && det.sede && (
                      <div className="pl-6">
                        <ComoLlegar sede={det.sede} miUbicacion={miUbicacion} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 lg:w-1/4 lg:border-l lg:border-slate-200 lg:pl-5">
                    <ChipEstado estado={c.estado} />
                    {activa && <MarcaNovedad alerta={novedadesPorCita.get(c.id)} />}
                    {c.mensaje && <p className="text-xs text-slate-500">{c.mensaje}</p>}
                    {c.estado === 'cancelada' && c.motivo_cancelacion && (
                      <p className="text-xs text-slate-500">Motivo: {c.motivo_cancelacion}</p>
                    )}
                  </div>
                  <div className="flex gap-2 lg:w-40 lg:flex-col">
                    {activa && modificable && (
                      <>
                        <button
                          type="button"
                          disabled={cancelando === c.id}
                          onClick={() => cancelar(c, det.medico)}
                          className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancelando === c.id ? 'Cancelando…' : 'Cancelar cita'}
                        </button>
                        {det.especialidad && (
                          <button
                            type="button"
                            onClick={() => onReagendar(det.especialidad!, c)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[#013b4d] hover:bg-slate-200"
                          >
                            <Repeat className="h-4 w-4" /> Reprogramar
                          </button>
                        )}
                      </>
                    )}
                    {activa && !modificable && (
                      <p className="text-xs text-slate-500">
                        Faltan menos de {HORAS_LIMITE_CANCELACION} h: ya no se puede cancelar ni reprogramar.
                      </p>
                    )}
                    {!activa && det.especialidad && (
                      <button
                        type="button"
                        onClick={() => onReagendar(det.especialidad!)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[#013b4d] hover:bg-slate-200"
                      >
                        <CalendarDays className="h-4 w-4" /> Agendar de nuevo
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
// Detalle de una cita (/paciente/citas/:id): todo lo de la cita en una página
// que se puede abrir desde un enlace, con mapa de la sede y cómo llegar.
// ---------------------------------------------------------------------------
function DetalleCita({
  cita,
  catalogo,
  miUbicacion,
  alerta,
  onVolver,
  onReprogramar,
  onCambio,
}: {
  cita: Cita
  catalogo: Catalogo
  miUbicacion: MiUbicacion
  alerta?: AlertaCita
  onVolver: () => void
  onReprogramar: (e: Especialidad, cita: Cita) => void
  onCambio: () => void
}) {
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const det = detalleDe(cita, catalogo)
  const activa = esActiva(cita)
  const modificable = sePuedeCancelar(cita.inicio)
  const { sede } = det
  // Encuadre: la sede y, si se conoce, la ubicación del paciente.
  const puntos: Coordenada[] = sede ? [[sede.lat, sede.lng], ...(miUbicacion.posicion ? [miUbicacion.posicion] : [])] : []

  async function cancelar() {
    if (!confirmarCancelacion(cita, det.medico)) return
    setError(null)
    setCancelando(true)
    const fallo = await cancelarCita(cita)
    setCancelando(false)
    if (fallo) setError(fallo)
    onCambio()
  }

  const filas: [string, ReactNode][] = [
    ['Médico', det.medico],
    ['Fecha', fechaLarga(cita.inicio)],
    ['Hora', hora(cita.inicio)],
    ['Sede', sede ? `${sede.nombre} · ${sede.direccion} · ${sede.ciudad}` : '—'],
    ['Consultorio', det.consultorio || '—'],
    ['Motivo', cita.motivo ?? '—'],
  ]

  return (
    <>
      <Portada alto="bajo" titulo={det.especialidad?.nombre ?? 'Tu cita'} subtitulo={`${det.medico} · ${fechaLarga(cita.inicio)}, ${hora(cita.inicio)}`} />
      <div className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <button
              type="button"
              onClick={onVolver}
              className="flex items-center gap-2 text-sm font-medium text-[#2c6672] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Mis citas
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <ChipEstado estado={cita.estado} />
              {activa && <MarcaNovedad alerta={alerta} />}
            </div>
            {cita.mensaje && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{cita.mensaje}</p>}
            {cita.estado === 'cancelada' && cita.motivo_cancelacion && (
              <p className="text-sm text-slate-500">Motivo de la cancelación: {cita.motivo_cancelacion}</p>
            )}
            <dl className="divide-y divide-slate-100 rounded-xl text-sm ring-1 ring-slate-200">
              {filas.map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2">
                  <dt className="w-24 shrink-0 text-slate-400">{k}</dt>
                  <dd className="text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </p>
            )}
            {activa && modificable && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={cancelar}
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  {cancelando ? 'Cancelando…' : 'Cancelar cita'}
                </button>
                {det.especialidad && (
                  <button
                    type="button"
                    onClick={() => onReprogramar(det.especialidad!, cita)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-[#013b4d] hover:bg-slate-200"
                  >
                    <Repeat className="h-4 w-4" /> Reprogramar
                  </button>
                )}
              </div>
            )}
            {activa && !modificable && (
              <p className="text-xs text-slate-500">
                Faltan menos de {HORAS_LIMITE_CANCELACION} h: ya no se puede cancelar ni reprogramar.
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-3">
            {sede ? (
              <>
                <Mapa centro={{ lat: sede.lat, lng: sede.lng }} zoom={15} className="h-[320px] w-full">
                  {puntos.length > 1 && <AjustarARuta puntos={puntos} margen={60} />}
                  <MarcadorParada posicion={[sede.lat, sede.lng]} titulo={sede.nombre} activa />
                  {miUbicacion.posicion && <MarcadorMiUbicacion posicion={miUbicacion.posicion} precision={miUbicacion.precision} />}
                </Mapa>
                <div className="p-4">
                  <p className="font-semibold text-slate-900">{sede.nombre}</p>
                  <p className="mb-2 text-sm text-slate-500">
                    {sede.direccion} · {sede.ciudad}
                  </p>
                  <ComoLlegar sede={sede} miUbicacion={miUbicacion} />
                </div>
              </>
            ) : (
              <p className="p-6 text-sm text-slate-500">El médico todavía no tiene una sede asignada.</p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
export function PacientePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [catalogo, setCatalogo] = useState<Catalogo>({ especialidades: [], sedes: [], medicos: [], nombres: new Map() })
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [reintentando, setReintentando] = useState(false)
  // Como en buses: la ubicación se pide una sola vez para toda la página.
  const miUbicacion = useMiUbicacion()
  const usuarioId = session?.user.id

  // Devuelven el error en vez de tragárselo: un fallo de red no debe verse
  // como "no tienes citas".
  const cargarCatalogo = useCallback(async (): Promise<unknown> => {
    const [resEsp, resSedes, resMedicos, resUsuarios] = await Promise.all([
      supabase.from('especialidades').select('*').order('nombre'),
      supabase.from('sedes').select('*').order('nombre'),
      supabase.from('medicos').select('*'),
      supabase.from('usuarios').select('id, nombre, rol').eq('rol', 'medico'),
    ])
    const fallo = resEsp.error ?? resSedes.error ?? resMedicos.error ?? resUsuarios.error
    if (fallo) return fallo
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
    return null
  }, [])

  const cargarCitas = useCallback(async (): Promise<unknown> => {
    if (!usuarioId) return null
    const { data, error } = await supabase.from('citas').select('*').eq('paciente_id', usuarioId).order('inicio')
    if (error) return error
    setCitas((data as Cita[]) ?? [])
    return null
  }, [usuarioId])

  const cargarTodo = useCallback(async () => {
    const [falloCatalogo, falloCitas] = await Promise.all([cargarCatalogo(), cargarCitas()])
    const fallo = falloCatalogo ?? falloCitas
    setErrorCarga(fallo ? mensajeDeError(fallo) : null)
    setCargando(false)
  }, [cargarCatalogo, cargarCitas])

  const recargarCitas = useCallback(async () => {
    const fallo = await cargarCitas()
    setErrorCarga(fallo ? mensajeDeError(fallo) : null)
  }, [cargarCitas])

  useEffect(() => {
    void cargarTodo()
  }, [cargarTodo])

  async function reintentar() {
    setReintentando(true)
    await cargarTodo()
    setReintentando(false)
  }

  // Cuando el médico acepta o rechaza, la cita cambia en vivo. Al (re)conectar
  // el canal se recarga: lo que cambió sin red no llega por Realtime.
  useEffect(() => {
    if (!usuarioId) return
    const canal = supabase
      .channel('citas-paciente')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'citas', filter: `paciente_id=eq.${usuarioId}` },
        () => void recargarCitas(),
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') void recargarCitas()
      })
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [usuarioId, recargarCitas])

  // Hay datos que mostrar aunque la última recarga fallara.
  const hayDatos = catalogo.especialidades.length > 0

  // La vista sale de la URL: /paciente, /paciente/citas, /paciente/citas/:id,
  // /paciente/agendar/:especialidadId?reprogramar=:citaId. null = ruta que no
  // existe (o una cita/especialidad que no es del paciente): se vuelve al inicio.
  const [, , seccion, idRuta] = location.pathname.split('/')
  const reprogramarId = new URLSearchParams(location.search).get('reprogramar')
  const vista = useMemo((): Vista | null => {
    if (!seccion) return { tipo: 'inicio' }
    if (seccion === 'citas' && !idRuta) return { tipo: 'mis-citas' }
    if (seccion === 'citas') {
      const cita = citas.find((c) => c.id === idRuta)
      return cita ? { tipo: 'detalle', cita } : null
    }
    if (seccion === 'agendar') {
      const especialidad = catalogo.especialidades.find((e) => e.id === idRuta)
      if (!especialidad) return null
      const reprogramar = reprogramarId ? citas.find((c) => c.id === reprogramarId) : undefined
      return { tipo: 'agendar', especialidad, reprogramar }
    }
    return null
  }, [seccion, idRuta, reprogramarId, citas, catalogo.especialidades])

  const ir = useCallback((destino: Vista, reemplazar = false) => navigate(rutaDe(destino), { replace: reemplazar }), [navigate])

  // Cada vista empieza arriba, como una página nueva.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Novedades aprobadas que afectan a sus citas (solo las del día de cada cita).
  const { alertas, porCita: novedadesPorCita, cerrar } = useAlertasNovedades(citas)

  return (
    <div className="relative flex min-h-svh w-full flex-col bg-gradient-to-b from-[#f4f9fa] via-[#e9f3f4] to-[#d8e9eb]">
      <Encabezado />
      <main className="relative z-10 flex-1 pb-32">
        {alertas.length > 0 && (
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            {alertas.map((a) => (
              <AvisoAlerta
                key={a.clave}
                alerta={a}
                medico={catalogo.nombres.get(a.cita.medico_id) ?? 'tu médico'}
                onCerrar={() => cerrar(a.clave)}
              />
            ))}
          </div>
        )}
        {errorCarga && (
          <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
            <AvisoError
              titulo={hayDatos ? 'No se pudieron actualizar tus datos' : 'No se pudieron cargar tus datos'}
              detalle={hayDatos ? `${errorCarga} Lo que ves puede estar desactualizado.` : errorCarga}
              onReintentar={reintentar}
              reintentando={reintentando}
            />
          </div>
        )}
        {cargando ? (
          <p className="p-10 text-center text-sm text-slate-500">Cargando…</p>
        ) : errorCarga && !hayDatos ? null : !vista ? (
          // Ruta desconocida, o una cita/especialidad que no existe para este paciente.
          <Navigate to="/paciente" replace />
        ) : vista.tipo === 'agendar' ? (
          <Agendar
            // La key reinicia el agendador al pasar de agendar a reprogramar.
            key={`${vista.especialidad.id}-${vista.reprogramar?.id ?? 'nueva'}`}
            especialidad={vista.especialidad}
            reprogramar={vista.reprogramar}
            catalogo={catalogo}
            onVolver={() => ir(vista.reprogramar ? { tipo: 'detalle', cita: vista.reprogramar } : { tipo: 'inicio' })}
            onAgendada={() => {
              void recargarCitas()
              // replace: con "atrás" no se vuelve a un formulario ya enviado.
              ir({ tipo: 'mis-citas' }, true)
            }}
          />
        ) : vista.tipo === 'detalle' ? (
          <DetalleCita
            cita={vista.cita}
            catalogo={catalogo}
            miUbicacion={miUbicacion}
            alerta={novedadesPorCita.get(vista.cita.id)}
            onVolver={() => ir({ tipo: 'mis-citas' })}
            onReprogramar={(e, cita) => ir({ tipo: 'agendar', especialidad: e, reprogramar: cita })}
            onCambio={() => void recargarCitas()}
          />
        ) : vista.tipo === 'mis-citas' ? (
          <MisCitas
            citas={citas}
            catalogo={catalogo}
            miUbicacion={miUbicacion}
            novedadesPorCita={novedadesPorCita}
            onVolver={() => ir({ tipo: 'inicio' })}
            onReagendar={(e, reprogramar) => ir({ tipo: 'agendar', especialidad: e, reprogramar })}
            onVerCita={(cita) => ir({ tipo: 'detalle', cita })}
            onCambio={() => void recargarCitas()}
          />
        ) : (
          <Inicio
            catalogo={catalogo}
            citas={citas}
            miUbicacion={miUbicacion}
            novedadesPorCita={novedadesPorCita}
            onAgendar={(e) => ir({ tipo: 'agendar', especialidad: e })}
            onMisCitas={() => ir({ tipo: 'mis-citas' })}
            onVerCita={(cita) => ir({ tipo: 'detalle', cita })}
          />
        )}
      </main>
      <Pie texto="Tu salud, nuestra prioridad" />
      <Plantas />
      {/* Atajo flotante en móvil, igual que el "Ver mapa" del pasajero. */}
      {vista?.tipo === 'inicio' && !cargando && (
        <button
          type="button"
          onClick={() => ir({ tipo: 'mis-citas' })}
          className="fixed right-4 bottom-16 z-20 flex items-center gap-2 rounded-full bg-[#013b4d] px-4 py-3 text-sm font-semibold text-white shadow-xl sm:hidden"
        >
          Mis citas <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
