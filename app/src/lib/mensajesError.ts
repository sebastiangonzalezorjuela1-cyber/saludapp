// Traduce los errores de Supabase, Postgres y la red a mensajes en español
// para el usuario. Nunca mostrar error.message crudo: suele venir en inglés o
// con detalles técnicos ("JWT expired", "violates check constraint…").
// Reescrito a partir de la guía de Buses Metro (§4.6).

const SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
const GENERICO = 'Algo salió mal. Inténtalo de nuevo en un momento.'

// Mensajes de fetch fallido según el navegador.
const FALLOS_DE_RED = ['failed to fetch', 'networkerror when attempting to fetch', 'load failed', 'network request failed']
const NOMBRES_DE_RED = ['AuthRetryableFetchError', 'FunctionsFetchError']

const POR_CODIGO_AUTH: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es demasiado débil. Revisa los requisitos.',
  same_password: 'La contraseña nueva debe ser distinta de la actual.',
  email_not_confirmed: 'Debes confirmar tu correo antes de ingresar.',
  email_address_invalid: 'Ese correo no es válido.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera un momento.',
  over_email_send_rate_limit: 'Demasiados intentos seguidos. Espera un momento.',
  reauthentication_needed: 'Por seguridad, cierra sesión, vuelve a entrar y repite el cambio.',
  session_not_found: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  user_not_found: 'No se encontró la cuenta.',
}

const POR_CODIGO_POSTGRES: Record<string, string> = {
  '23514': 'Algún dato no cumple las reglas (por ejemplo, un texto vacío o demasiado largo).',
  '23505': 'Ese registro ya existe.',
  '42501': 'No tienes permiso para hacer esto.',
  PGRST301: 'Tu sesión venció. Vuelve a iniciar sesión.',
}

interface ErrorConCodigo {
  name?: unknown
  message?: unknown
  code?: unknown
}

export function esErrorDeRed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as ErrorConCodigo
  if (typeof name === 'string' && NOMBRES_DE_RED.includes(name)) return true
  const texto = typeof message === 'string' ? message.toLowerCase() : ''
  return FALLOS_DE_RED.some((f) => texto.includes(f))
}

export function mensajeDeError(error: unknown): string {
  if (!error) return GENERICO
  if (esErrorDeRed(error)) return SIN_CONEXION

  const { code, message } = error as ErrorConCodigo
  const texto = typeof message === 'string' ? message : ''

  if (typeof code === 'string') {
    // P0001 = raise exception de nuestras funciones SQL: ya vienen en español.
    if (code === 'P0001' && texto) return texto
    if (POR_CODIGO_AUTH[code]) return POR_CODIGO_AUTH[code]
    if (POR_CODIGO_POSTGRES[code]) return POR_CODIGO_POSTGRES[code]
  }

  // Versiones viejas de Auth no traen code: se reconoce por el texto.
  if (texto === 'Invalid login credentials') return POR_CODIGO_AUTH.invalid_credentials
  if (texto === 'User already registered') return POR_CODIGO_AUTH.user_already_exists

  console.warn('Error sin traducir:', error)
  return GENERICO
}
