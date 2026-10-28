import { useEffect, useState } from 'react'
import type { Coordenada } from '../lib/mapaConfig'

export type EstadoUbicacion = 'pidiendo' | 'ok' | 'denegado' | 'no-disponible' | 'error'

export interface MiUbicacion {
  posicion: Coordenada | null
  // Radio en metros dentro del cual está la posición real, según el navegador.
  precision: number | null
  estado: EstadoUbicacion
}

const hayGeolocalizacion = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

// Posición del pasajero, al día mientras se mueve. Solo usa la geolocalización
// del navegador, que exige HTTPS o localhost: por http en la red local falla.
export function useMiUbicacion(): MiUbicacion {
  const [ubicacion, setUbicacion] = useState<MiUbicacion>(() => ({
    posicion: null,
    precision: null,
    estado: hayGeolocalizacion() ? 'pidiendo' : 'no-disponible',
  }))

  useEffect(() => {
    if (!hayGeolocalizacion()) return

    const id = navigator.geolocation.watchPosition(
      (p) =>
        setUbicacion({
          posicion: [p.coords.latitude, p.coords.longitude],
          precision: p.coords.accuracy,
          estado: 'ok',
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setUbicacion({ posicion: null, precision: null, estado: 'denegado' })
          return
        }
        // Un timeout suelto no borra una posición que ya era buena: el watch
        // sigue y la próxima lectura la actualiza.
        setUbicacion((actual) => (actual.posicion ? actual : { ...actual, estado: 'error' }))
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return ubicacion
}
