import { useState, type FormEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CircleCheck, CircleX, KeyRound, ShieldQuestion, UserRound, X, type LucideIcon } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useAuth } from './useAuth'
import { mensajeDeError } from './mensajesError'
import { PREGUNTAS_SEGURIDAD } from './preguntasSeguridad'
import { CampoPassword, RequisitosPassword } from './CampoPassword'
import { faltantesComoTexto, passwordEsValida } from './validarPassword'

// Ventana de Ajustes (botón ⚙️ de la cabecera). Reescrita a partir de la guía de
// Buses Metro (§4.4): tres secciones independientes, cada una con su resultado.

type Resultado = { tipo: 'ok' | 'error'; texto: string } | null

const CLASE_CAMPO =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2c6672] focus:ring-1 focus:ring-[#2c6672]'
const FOCO = 'focus:border-[#2c6672] focus:ring-[#2c6672]'

function Seccion({ titulo, Icono, children }: { titulo: string; Icono: LucideIcon; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl p-4 ring-1 ring-slate-200">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0f3a48]">
        <Icono className="h-4 w-4 text-[#2c6672]" aria-hidden="true" />
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function MensajeResultado({ resultado }: { resultado: Resultado }) {
  if (!resultado) return null
  const ok = resultado.tipo === 'ok'
  const Icono = ok ? CircleCheck : CircleX
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-1.5 text-sm ${ok ? 'text-emerald-700' : 'text-red-600'}`}
    >
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {resultado.texto}
    </p>
  )
}

function BotonGuardar({ guardando, children }: { guardando: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={guardando}
      className="rounded-xl bg-[#013b4d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4d60] disabled:opacity-50"
    >
      {guardando ? 'Guardando…' : children}
    </button>
  )
}

function SeccionNombre() {
  const { session, nombre, actualizarNombre } = useAuth()
  const [valor, setValor] = useState(nombre ?? '')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<Resultado>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = valor.trim()
    if (limpio.length === 0 || limpio.length > 80) {
      setResultado({ tipo: 'error', texto: 'El nombre debe tener entre 1 y 80 caracteres.' })
      return
    }
    if (!session) return
    setGuardando(true)
    setResultado(null)
    // .select('id'): si RLS rechaza el update no da error, devuelve 0 filas.
    const { data, error } = await supabase.from('usuarios').update({ nombre: limpio }).eq('id', session.user.id).select('id')
    setGuardando(false)
    if (error || !data?.length) {
      setResultado({ tipo: 'error', texto: error ? mensajeDeError(error) : 'No se pudo guardar el nombre.' })
      return
    }
    setValor(limpio)
    actualizarNombre(limpio)
    setResultado({ tipo: 'ok', texto: 'Nombre actualizado.' })
  }

  return (
    <Seccion titulo="Nombre" Icono={UserRound}>
      <form onSubmit={guardar} className="space-y-3">
        <label htmlFor="ajustes-nombre" className="sr-only">
          Nombre
        </label>
        <input
          id="ajustes-nombre"
          type="text"
          value={valor}
          maxLength={80}
          onChange={(e) => setValor(e.target.value)}
          className={CLASE_CAMPO}
        />
        <MensajeResultado resultado={resultado} />
        <BotonGuardar guardando={guardando}>Guardar nombre</BotonGuardar>
      </form>
    </Seccion>
  )
}

function SeccionPassword() {
  const { session } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<Resultado>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setResultado(null)
    if (!passwordEsValida(nueva)) {
      setResultado({ tipo: 'error', texto: faltantesComoTexto(nueva) })
      return
    }
    if (nueva !== confirmacion) {
      setResultado({ tipo: 'error', texto: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    const email = session?.user.email
    if (!email) return
    setGuardando(true)
    // updateUser no pide la contraseña actual: se verifica antes, para que nadie
    // con la sesión abierta en un equipo ajeno pueda cambiarla.
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual })
    if (errorActual) {
      setGuardando(false)
      setResultado({
        tipo: 'error',
        texto: errorActual.code === 'invalid_credentials' ? 'La contraseña actual no es correcta.' : mensajeDeError(errorActual),
      })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: nueva })
    setGuardando(false)
    if (error) {
      setResultado({ tipo: 'error', texto: mensajeDeError(error) })
      return
    }
    setActual('')
    setNueva('')
    setConfirmacion('')
    setResultado({ tipo: 'ok', texto: 'Contraseña actualizada.' })
  }

  return (
    <Seccion titulo="Contraseña" Icono={KeyRound}>
      <form onSubmit={guardar} className="space-y-3">
        <CampoPassword
          id="ajustes-actual"
          etiqueta="Contraseña actual"
          valor={actual}
          onChange={setActual}
          autoComplete="current-password"
          clasesFoco={FOCO}
        />
        <CampoPassword
          id="ajustes-nueva"
          etiqueta="Contraseña nueva"
          valor={nueva}
          onChange={setNueva}
          autoComplete="new-password"
          clasesFoco={FOCO}
        />
        {nueva.length > 0 && <RequisitosPassword valor={nueva} />}
        <CampoPassword
          id="ajustes-confirmacion"
          etiqueta="Repite la contraseña nueva"
          valor={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
          clasesFoco={FOCO}
        />
        <MensajeResultado resultado={resultado} />
        <BotonGuardar guardando={guardando}>Cambiar contraseña</BotonGuardar>
      </form>
    </Seccion>
  )
}

// Solo pacientes: la recuperación por pregunta no está disponible para el personal.
function SeccionPregunta() {
  const [pregunta, setPregunta] = useState<string>(PREGUNTAS_SEGURIDAD[0])
  const [respuesta, setRespuesta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<Resultado>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (respuesta.trim().length < 2) {
      setResultado({ tipo: 'error', texto: 'La respuesta debe tener al menos 2 caracteres.' })
      return
    }
    setGuardando(true)
    setResultado(null)
    const { error } = await supabase.rpc('guardar_pregunta_seguridad', { p_pregunta: pregunta, p_respuesta: respuesta })
    setGuardando(false)
    if (error) {
      setResultado({ tipo: 'error', texto: mensajeDeError(error) })
      return
    }
    setRespuesta('')
    setResultado({ tipo: 'ok', texto: 'Pregunta de seguridad guardada.' })
  }

  return (
    <Seccion titulo="Pregunta de seguridad" Icono={ShieldQuestion}>
      <p className="text-xs text-slate-500">Sirve para recuperar tu contraseña si la olvidas. Reemplaza la anterior.</p>
      <form onSubmit={guardar} className="space-y-3">
        <label htmlFor="ajustes-pregunta" className="block text-sm font-medium text-slate-700">
          Pregunta
        </label>
        <select id="ajustes-pregunta" value={pregunta} onChange={(e) => setPregunta(e.target.value)} className={CLASE_CAMPO}>
          {PREGUNTAS_SEGURIDAD.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label htmlFor="ajustes-respuesta" className="block text-sm font-medium text-slate-700">
          Respuesta
        </label>
        <input
          id="ajustes-respuesta"
          type="text"
          autoComplete="off"
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          className={CLASE_CAMPO}
        />
        <p className="text-xs text-slate-400">No importan mayúsculas ni tildes.</p>
        <MensajeResultado resultado={resultado} />
        <BotonGuardar guardando={guardando}>Guardar pregunta</BotonGuardar>
      </form>
    </Seccion>
  )
}

export function VentanaAjustes({ abierta, onCambiar }: { abierta: boolean; onCambiar: (abierta: boolean) => void }) {
  const { rol } = useAuth()
  return (
    <Dialog.Root open={abierta} onOpenChange={onCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#013b4d]/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-slate-900">Ajustes de tu cuenta</Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar ajustes"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Cambia tu nombre, tu contraseña o tu pregunta de seguridad.</Dialog.Description>
          {/* Se desmontan al cerrar: al volver a abrir, los campos empiezan limpios. */}
          <div className="space-y-4">
            <SeccionNombre />
            <SeccionPassword />
            {rol === 'paciente' && <SeccionPregunta />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
