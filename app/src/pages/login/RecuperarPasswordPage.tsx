import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { llamarRecuperacion } from '../../lib/preguntasSeguridad'
import { CampoPassword, RequisitosPassword } from '../../lib/CampoPassword'
import { faltantesComoTexto, passwordEsValida } from '../../lib/validarPassword'

type Paso = 'correo' | 'respuesta' | 'listo'

export function RecuperarPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rolVuelta = searchParams.get('rol')
  const rutaLogin = rolVuelta ? `/login/${rolVuelta}` : '/login'

  const [paso, setPaso] = useState<Paso>('correo')
  const [email, setEmail] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleBuscarPregunta(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const { pregunta: preguntaUsuario } = await llamarRecuperacion<{ pregunta: string }>({
        accion: 'pregunta',
        email,
      })
      setPregunta(preguntaUsuario)
      setPaso('respuesta')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar la pregunta.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleRestablecer(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!passwordEsValida(password)) {
      setError(faltantesComoTexto(password))
      return
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      await llamarRecuperacion({
        accion: 'restablecer',
        email,
        respuesta,
        nuevaPassword: password,
      })
      setPaso('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">SaludApp</h1>
          <p className="mt-1 text-sm text-slate-500">Recuperar contraseña</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          {paso === 'listo' ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-600" />
              <h2 className="text-base font-medium text-slate-800">Contraseña actualizada</h2>
              <p className="mt-2 text-sm text-slate-500">
                Ya puedes ingresar con tu contraseña nueva.
              </p>
              <button
                type="button"
                onClick={() => navigate(rutaLogin, { replace: true })}
                className="mt-6 w-full rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col items-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
                  <KeyRound className="h-8 w-8 text-sky-700" />
                </div>
                <h2 className="text-base font-medium text-slate-700">
                  {paso === 'correo' ? 'Verifica tu identidad' : 'Responde tu pregunta'}
                </h2>
              </div>

              {paso === 'correo' ? (
                <form onSubmit={handleBuscarPregunta} className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Escribe tu correo y te mostraremos la pregunta de seguridad que elegiste al
                    registrarte.
                  </p>

                  <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {enviando ? 'Un momento…' : 'Continuar'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRestablecer} className="space-y-4">
                  <div className="rounded-lg bg-sky-50 p-3 ring-1 ring-sky-100">
                    <p className="text-xs text-sky-900/70">Tu pregunta de seguridad</p>
                    <p className="mt-0.5 text-sm font-medium text-sky-900">{pregunta}</p>
                  </div>

                  <div>
                    <label htmlFor="respuesta" className="mb-1 block text-sm font-medium text-slate-700">
                      Respuesta
                    </label>
                    <input
                      id="respuesta"
                      type="text"
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      required
                      autoComplete="off"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      No importan mayúsculas ni tildes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <CampoPassword
                      id="password"
                      etiqueta="Contraseña nueva"
                      valor={password}
                      onChange={setPassword}
                      autoComplete="new-password"
                    />
                    {password.length > 0 && <RequisitosPassword valor={password} />}
                  </div>

                  <div>
                    <CampoPassword
                      id="confirmacion"
                      etiqueta="Repite la contraseña"
                      valor={confirmacion}
                      onChange={setConfirmacion}
                      autoComplete="new-password"
                    />
                    {confirmacion.length > 0 && password !== confirmacion && (
                      <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden.</p>
                    )}
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {enviando ? 'Un momento…' : 'Cambiar contraseña'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaso('correo')
                      setError(null)
                      setRespuesta('')
                    }}
                    className="w-full text-center text-xs text-slate-500 hover:underline"
                  >
                    Usar otro correo
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <Link
          to={rutaLogin}
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
