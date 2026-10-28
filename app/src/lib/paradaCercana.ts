import { distanciaKm, type Coordenada } from './mapaConfig'

// Reciclado de "Tu parada más cercana" de Buses Metro. Antes recibía paradas;
// ahora sirve para cualquier lugar con lat/lng (en SaludApp, las sedes).

// Más lejos que esto ya no tiene sentido llamarla "cercana".
export const DISTANCIA_MAXIMA_M = 15000

// 4.5 km/h: paso normal de un adulto.
const METROS_POR_MINUTO_A_PIE = 4500 / 60

export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  return distanciaKm(a, b) * 1000
}

export function lugarMasCercano<T extends { lat: number; lng: number }>(
  punto: Coordenada,
  lugares: T[],
): { lugar: T; metros: number } | null {
  let mejor: { lugar: T; metros: number } | null = null
  for (const lugar of lugares) {
    const metros = distanciaMetros(punto, [lugar.lat, lugar.lng])
    if (!mejor || metros < mejor.metros) mejor = { lugar, metros }
  }
  return mejor
}

export function minutosCaminando(metros: number): number {
  return Math.max(1, Math.ceil(metros / METROS_POR_MINUTO_A_PIE))
}

// "350 m" o "1.4 km".
export function textoDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`
  return `${(metros / 1000).toFixed(1)} km`
}
