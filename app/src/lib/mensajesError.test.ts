import { esErrorDeRed, mensajeDeError } from './mensajesError'

describe('mensajeDeError', () => {
  beforeEach(() => {
    // El caso "sin traducir" deja un aviso en consola a propósito.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('reconoce la falta de red en Chrome, Firefox, Safari y en supabase-js', () => {
    const sinRed = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toBe(sinRed)
    expect(mensajeDeError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(sinRed)
    expect(mensajeDeError({ message: 'Load failed' })).toBe(sinRed)
    expect(mensajeDeError({ name: 'FunctionsFetchError', message: 'x' })).toBe(sinRed)
    expect(esErrorDeRed({ name: 'AuthRetryableFetchError' })).toBe(true)
  })

  it('traduce los códigos de Auth y de Postgres', () => {
    expect(mensajeDeError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.')
    expect(mensajeDeError({ code: 'user_already_exists' })).toBe('Ya existe una cuenta con ese correo.')
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe('No tienes permiso para hacer esto.')
    expect(mensajeDeError({ code: '23514', message: 'violates check constraint' })).toMatch(/no cumple las reglas/)
  })

  it('reconoce Auth antiguo sin código, por el texto', () => {
    expect(mensajeDeError({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.')
  })

  it('P0001 (raise exception de nuestras funciones) se muestra tal cual: ya viene en español', () => {
    expect(mensajeDeError({ code: 'P0001', message: 'Solo puedes cancelar hasta 2 horas antes de la cita.' })).toBe(
      'Solo puedes cancelar hasta 2 horas antes de la cita.',
    )
  })

  it('lo desconocido no muestra el texto técnico y queda en consola', () => {
    expect(mensajeDeError({ code: 'XX000', message: 'internal error at tuple 42' })).toBe('Algo salió mal. Inténtalo de nuevo en un momento.')
    expect(console.warn).toHaveBeenCalled()
    expect(mensajeDeError(null)).toBe('Algo salió mal. Inténtalo de nuevo en un momento.')
  })
})
