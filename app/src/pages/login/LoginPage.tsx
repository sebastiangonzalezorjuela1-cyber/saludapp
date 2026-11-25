import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'
import { mensajeDeError } from '../../lib/mensajesError'
import { ProblemaPerfil } from '../../lib/ProblemaPerfil'
import { PREGUNTAS_SEGURIDAD } from '../../lib/preguntasSeguridad'
import { esEmailValido } from '../../lib/validarEmail'
import { CampoPassword, RequisitosPassword } from '../../lib/CampoPassword'
import { faltantesComoTexto, passwordEsValida } from '../../lib/validarPassword'
import type { Rol } from '../../types/domain'
import { Marca } from '../../lib/Marca'

type ModoIngreso = 'ingresar' | 'registrar'

interface Tema {
  titulo: string
  subtitulo: string
  boton: string
  foco: string
  permiteRegistro: boolean
}

// Reciclado del login de Buses Metro: el formulario, el registro con pregunta
// de seguridad y la redirección por rol son los mismos. Cambian los textos y
// la portada (antes una foto por rol, ahora un degradado).
const TEMAS: Record<Rol, Tema> = {
  paciente: {
    titulo: 'Acceso paciente',
    subtitulo: 'Agenda y sigue tus citas médicas',
    boton: 'bg-[#013b4d]',
    foco: 'focus:border-teal-600 focus:ring-teal-600',
    permiteRegistro: true,
  },
  medico: {
    titulo: 'Acceso médico',
    subtitulo: 'Gestiona tus citas y reporta novedades',
    boton: 'bg-[#013b4d]',
    foco: 'focus:border-teal-600 focus:ring-teal-600',
    permiteRegistro: false,
  },
  admin: {
    titulo: 'Acceso administrador',
    subtitulo: 'Supervisa médicos, sedes y novedades',
    boton: 'bg-[#013b4d]',
    foco: 'focus:border-teal-600 focus:ring-teal-600',
    permiteRegistro: false,
  },
}

export function LoginPage() {
  const { rol: rolUrl } = useParams<{ rol: string }>()
  const navigate = useNavigate()
  const { rol: rolSesion, cargando, session, problemaPerfil } = useAuth()
  const [modo, setModo] = useState<ModoIngreso>('ingresar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pregunta, setPregunta] = useState<string>(PREGUNTAS_SEGURIDAD[0])
  const [respuestaSeguridad, setRespuestaSeguridad] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Mientras se registra, el perfil ya existe (lo crea un trigger) y la
  // redirección automática desmontaría la página antes de guardar la pregunta.
  const [registrando, setRegistrando] = useState(false)
  // La cuenta se creó pero la pregunta de seguridad falló: se ofrece continuar.
  const [puedeContinuar, setPuedeContinuar] = useState(false)

  useEffect(() => {
    if (!cargando && rolSesion && !registrando) navigate(`/${rolSesion}`, { replace: true })
  }, [rolSesion, cargando, registrando, navigate])

  if (!rolUrl || !(rolUrl in TEMAS)) return <Navigate to="/login" replace />
  // Ingresó bien pero no hay perfil o no hay red: antes el botón se quedaba en
  // "Un momento…" para siempre.
  if (!cargando && session && problemaPerfil && !registrando) return <ProblemaPerfil />
  const rolObjetivo = rolUrl as Rol
  const tema = TEMAS[rolObjetivo]

  function cambiarModo(nuevoModo: ModoIngreso) {
    setModo(nuevoModo)
    setError(null)
    setMensaje(null)
  }

  async function handleIngresar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setEnviando(true)
    // Mismo trim que en el registro: si no, un espacio pegado al copiar el correo
    // hace fallar el ingreso de una cuenta que sí existe.
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(mensajeDeError(error))
      setEnviando(false)
    }
    // si no hay error, el useEffect de arriba redirige apenas se resuelva el rol
  }

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)

    const nombreLimpio = nombre.trim()
    if (nombreLimpio.length === 0 || nombreLimpio.length > 80) {
      setError('Escribe tu nombre (máximo 80 caracteres).')
      return
    }

    const emailLimpio = email.trim()
    if (!esEmailValido(emailLimpio)) {
      setError('Escribe un correo válido, por ejemplo nombre@gmail.com')
      return
    }

    if (!passwordEsValida(password)) {
      setError(faltantesComoTexto(password))
      return
    }

    if (respuestaSeguridad.trim().length < 2) {
      setError('La respuesta de seguridad debe tener al menos 2 caracteres.')
      return
    }

    setEnviando(true)
    setRegistrando(true)

    // El perfil (rol paciente) lo crea la base con un trigger, usando este nombre.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: emailLimpio,
      password,
      options: { data: { nombre: nombreLimpio } },
    })
    if (signUpError || !data.user) {
      setError(signUpError ? mensajeDeError(signUpError) : 'No se pudo crear la cuenta.')
      setEnviando(false)
      setRegistrando(false)
      return
    }

    if (!data.session) {
      // Auth exige confirmar el correo: sin sesión no se puede guardar la pregunta.
      setRegistrando(false)
      cambiarModo('ingresar')
      setMensaje(
        'Cuenta creada. Revisa tu correo para confirmarla e inicia sesión. Luego configura tu pregunta de seguridad en Ajustes.',
      )
      setEnviando(false)
      return
    }

    // La respuesta se hashea dentro de la función.
    const { error: errorPregunta } = await supabase.rpc('guardar_pregunta_seguridad', {
      p_pregunta: pregunta,
      p_respuesta: respuestaSeguridad,
    })

    if (errorPregunta) {
      // La cuenta ya existe: no tiene sentido volver a registrarse.
      setError(`Tu cuenta se creó, pero no se pudo guardar la pregunta de seguridad (${mensajeDeError(errorPregunta)}). Puedes configurarla luego en Ajustes.`)
      setPuedeContinuar(true)
      setEnviando(false)
      return
    }

    navigate('/paciente', { replace: true })
  }

  const esRegistro = tema.permiteRegistro && modo === 'registrar'

  const campos = (
    <form onSubmit={esRegistro ? handleRegistrar : handleIngresar} className="space-y-4">
      {tema.permiteRegistro && modo === 'registrar' && (
        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre
          </label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className={`w-full rounded border border-slate-300 bg-white/40 px-3 py-2 text-sm outline-none focus:ring-1 ${tema.foco}`}
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={`w-full rounded border border-slate-300 bg-white/40 px-3 py-2 text-sm outline-none focus:ring-1 ${tema.foco}`}
        />
      </div>

      <div className="space-y-2">
        <CampoPassword
          id="password"
          etiqueta="Contraseña"
          placeholder="Contraseña"
          valor={password}
          onChange={setPassword}
          autoComplete={esRegistro ? 'new-password' : 'current-password'}
          clasesFoco={tema.foco}
        >
          {modo === 'ingresar' && (
            <Link to={`/recuperar?rol=${rolObjetivo}`} className="text-xs text-teal-700 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          )}
        </CampoPassword>

        {/* Solo al registrarse: en el ingreso marcaría como inválida la contraseña
            de quien se registró antes de que existieran estas reglas. */}
        {esRegistro && password.length > 0 && <RequisitosPassword valor={password} />}
      </div>

      {tema.permiteRegistro && modo === 'registrar' && (
        <>
          <div>
            <label htmlFor="pregunta" className="mb-1 block text-sm font-medium text-slate-700">
              Pregunta de seguridad
            </label>
            <select
              id="pregunta"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              className={`w-full rounded border border-slate-300 bg-white/40 px-3 py-2 text-sm outline-none focus:ring-1 ${tema.foco}`}
            >
              {PREGUNTAS_SEGURIDAD.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="respuestaSeguridad" className="mb-1 block text-sm font-medium text-slate-700">
              Respuesta
            </label>
            <input
              id="respuestaSeguridad"
              type="text"
              value={respuestaSeguridad}
              onChange={(e) => setRespuestaSeguridad(e.target.value)}
              required
              autoComplete="off"
              className={`w-full rounded border border-slate-300 bg-white/40 px-3 py-2 text-sm outline-none focus:ring-1 ${tema.foco}`}
            />
            <p className="mt-1 text-xs text-slate-400">
              Te servirá para recuperar tu contraseña. No importan mayúsculas ni tildes.
            </p>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="text-sm text-emerald-600">
          {mensaje}
        </p>
      )}
      {puedeContinuar && (
        <button
          type="button"
          onClick={() => navigate('/paciente', { replace: true })}
          className="w-full rounded px-3 py-2 text-sm font-medium text-[#013b4d] ring-1 ring-[#013b4d]/30 hover:bg-white/60"
        >
          Continuar
        </button>
      )}

      <button
        type="submit"
        disabled={enviando}
        className={`w-full rounded px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${tema.boton}`}
      >
        {enviando ? 'Un momento…' : tema.permiteRegistro && modo === 'registrar' ? 'Crear cuenta' : 'Ingresar'}
      </button>

      {tema.permiteRegistro && (
        <p className="text-center text-xs text-slate-500">
          {modo === 'ingresar' ? (
            <>
              ¿No tienes una cuenta?{' '}
              <button type="button" onClick={() => cambiarModo('registrar')} className="font-medium text-teal-700 hover:underline">
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes una cuenta?{' '}
              <button type="button" onClick={() => cambiarModo('ingresar')} className="font-medium text-teal-700 hover:underline">
                Inicia sesión
              </button>
            </>
          )}
        </p>
      )}
    </form>
  )

  return (
    <div className="flex min-h-svh flex-col bg-[#013b4d] p-3 sm:p-4 lg:p-5">
      <div className="relative flex flex-1 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#0f5560] via-[#2c6672] to-[#3fb7b0] sm:rounded-[26px]">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute right-10 -bottom-32 h-80 w-80 rounded-full bg-white/10" />

        <div className="absolute top-5 left-6 sm:top-8 sm:left-10">
          <Marca />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-10 px-4 py-20 sm:px-8 lg:flex-row lg:justify-between lg:px-16 xl:px-24">
          <div className="hidden max-w-md text-white lg:block">
            <h1 className="text-4xl leading-tight font-bold">Cuidamos lo más importante: tu bienestar</h1>
            <p className="mt-3 text-teal-50/90">{tema.subtitulo}</p>
          </div>

          <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-2xl ring-1 ring-white/50 backdrop-blur-md sm:p-7">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
                <User className="h-8 w-8 text-teal-700" />
              </div>
              <h2 className="text-base font-medium text-slate-700">{tema.titulo}</h2>
              <Link to="/login" className="mt-1 text-xs text-slate-500 hover:underline">
                Cambiar de rol
              </Link>
            </div>
            {campos}
          </div>
        </div>
      </div>
    </div>
  )
}
