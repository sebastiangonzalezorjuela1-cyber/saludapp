import { desdePeriodo, formatearDuracion, marcasEje, porcentaje, textoPorcentaje } from './estadisticas'

describe('formatearDuracion', () => {
  it('elige la unidad según el tamaño', () => {
    expect(formatearDuracion(45)).toBe('45 s')
    expect(formatearDuracion(240)).toBe('4 min')
    expect(formatearDuracion(3600)).toBe('1 h')
    expect(formatearDuracion(4800)).toBe('1 h 20 min')
    expect(formatearDuracion(86_400)).toBe('1 día')
    expect(formatearDuracion(2 * 86_400)).toBe('2 días')
  })

  it('sin dato devuelve una raya, no 0', () => {
    expect(formatearDuracion(null)).toBe('—')
    expect(formatearDuracion(undefined)).toBe('—')
    expect(formatearDuracion(Number.NaN)).toBe('—')
  })
})

describe('porcentaje y textoPorcentaje', () => {
  it('sin base no inventa un 0 %', () => {
    expect(porcentaje(0, 0)).toBeNull()
    expect(textoPorcentaje(null)).toBe('—')
  })

  it('un decimal solo por debajo de 10 %, con coma decimal', () => {
    expect(textoPorcentaje(porcentaje(1, 252))).toBe('0,4 %')
    expect(textoPorcentaje(porcentaje(1, 4))).toBe('25 %')
    expect(textoPorcentaje(0)).toBe('0 %')
    expect(textoPorcentaje(100)).toBe('100 %')
  })
})

describe('marcasEje', () => {
  it('usa pasos 1, 2 o 5 y llega hasta el máximo', () => {
    expect(marcasEje(3)).toEqual([0, 1, 2, 3])
    expect(marcasEje(7)).toEqual([0, 2, 4, 6, 8])
    expect(marcasEje(18)).toEqual([0, 5, 10, 15, 20])
    expect(marcasEje(0)).toEqual([0, 1])
  })

  it('la última marca nunca queda por debajo del máximo', () => {
    for (const max of [1, 4, 9, 13, 27, 99, 101]) expect(marcasEje(max).at(-1)).toBeGreaterThanOrEqual(max)
  })
})

describe('desdePeriodo', () => {
  it('resta los días pedidos; "todo" no pone límite', () => {
    const ahora = Date.parse('2026-11-25T15:00:00Z')
    expect(desdePeriodo('7', ahora)).toBe('2026-11-18T15:00:00.000Z')
    expect(desdePeriodo('30', ahora)).toBe('2026-10-26T15:00:00.000Z')
    expect(desdePeriodo('todo', ahora)).toBeUndefined()
  })
})
