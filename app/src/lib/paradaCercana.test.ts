import { distanciaMetros, lugarMasCercano, minutosCaminando, textoDistancia } from './paradaCercana'

const sedes = [
  { nombre: 'Clínica Central', lat: 6.2442, lng: -75.5812 },
  { nombre: 'Clínica Norte', lat: 6.3373, lng: -75.5579 },
  { nombre: 'Clínica Capital', lat: 4.711, lng: -74.0721 },
]

describe('lugarMasCercano', () => {
  it('elige la sede más cercana y da la distancia en metros', () => {
    const r = lugarMasCercano([6.25, -75.58], sedes)
    expect(r?.lugar.nombre).toBe('Clínica Central')
    expect(r?.metros).toBeGreaterThan(500)
    expect(r?.metros).toBeLessThan(800)
  })

  it('sin lugares devuelve null', () => {
    expect(lugarMasCercano([6.25, -75.58], [])).toBeNull()
  })
})

describe('distanciaMetros', () => {
  it('Medellín–Bogotá en línea recta ronda los 240 km', () => {
    const km = distanciaMetros([6.2442, -75.5812], [4.711, -74.0721]) / 1000
    expect(km).toBeGreaterThan(230)
    expect(km).toBeLessThan(250)
  })
})

describe('minutosCaminando y textoDistancia', () => {
  it('a 4,5 km/h y nunca menos de 1 minuto', () => {
    expect(minutosCaminando(10)).toBe(1)
    expect(minutosCaminando(1500)).toBe(20)
  })

  it('metros redondeados a decenas o kilómetros con un decimal', () => {
    expect(textoDistancia(347)).toBe('350 m')
    expect(textoDistancia(1430)).toBe('1.4 km')
  })
})
