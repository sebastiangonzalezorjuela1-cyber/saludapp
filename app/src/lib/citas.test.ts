import { claveDia, diaCorto, inicioDeHoy, proximosDias, sePuedeCancelar, textoDia } from './citas'

// Todas las fechas se interpretan en hora de Colombia (UTC-5, sin horario de verano).

describe('claveDia', () => {
  it('usa el día de Colombia, no el de UTC', () => {
    // 23:30 del 24 en Bogotá = 04:30 del 25 en UTC.
    expect(claveDia('2026-11-25T04:30:00Z')).toBe('2026-11-24')
    // Medianoche en Bogotá = 05:00 UTC.
    expect(claveDia('2026-11-25T05:00:00Z')).toBe('2026-11-25')
  })
})

describe('diaCorto', () => {
  it('no corre el día al formatear', () => {
    expect(diaCorto('2026-11-25')).toEqual({ semana: expect.stringMatching(/^mi/i), numero: '25', mes: expect.stringMatching(/^nov/i) })
  })
})

describe('con el reloj fijo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Miércoles 25-nov-2026, 10:00 en Bogotá.
    vi.setSystemTime(new Date('2026-11-25T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('proximosDias empieza hoy y son días seguidos', () => {
    expect(proximosDias(3)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27'])
  })

  it('textoDia dice hoy, mañana o la fecha', () => {
    expect(textoDia('2026-11-25')).toBe('hoy')
    expect(textoDia('2026-11-26')).toBe('mañana')
    expect(textoDia('2026-11-30')).toMatch(/30 de noviembre/)
  })

  it('inicioDeHoy es la medianoche de Colombia', () => {
    expect(inicioDeHoy()).toBe('2026-11-25T05:00:00.000Z')
  })

  it('sePuedeCancelar exige más de 2 horas de antelación (igual que la base)', () => {
    expect(sePuedeCancelar('2026-11-25T17:30:00Z')).toBe(true) // 12:30, faltan 2 h 30
    expect(sePuedeCancelar('2026-11-25T17:00:00Z')).toBe(false) // 12:00, faltan 2 h justas
    expect(sePuedeCancelar('2026-11-25T16:00:00Z')).toBe(false) // 11:00
  })
})
