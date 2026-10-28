// Esta clave viaja en el bundle y es visible para cualquiera que abra el
// inspector. A diferencia de VITE_SUPABASE_ANON_KEY —que es pública por diseño y
// queda protegida por las políticas RLS—, una clave de Google Maps no tiene nada
// equivalente: quien la extraiga puede gastar contra tu facturación. La única
// defensa es restringirla por referente HTTP en la consola de Google Cloud.
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

// AdvancedMarker no se dibuja si el mapa no lleva un Map ID. 'DEMO_MAP_ID' es el
// identificador de desarrollo de Google: evita tener que crear uno para empezar.
// Para producción crea el tuyo en la consola y ponlo en VITE_GOOGLE_MAPS_ID; el
// de demo no admite estilos personalizados.
export const GOOGLE_MAPS_ID: string = import.meta.env.VITE_GOOGLE_MAPS_ID ?? 'DEMO_MAP_ID'

// Sin clave el mapa de Google se renderiza en gris con una marca de agua de error,
// que parece un bug de la app. Con esto mostramos un aviso honesto en su lugar.
export const mapasConfigurados: boolean = GOOGLE_MAPS_API_KEY.trim() !== ''

// Todas las rutas del proyecto están en Medellín. Antes cada página definía su
// propio centro y el del pasajero apuntaba a Santiago de Chile.
export const CENTRO_MEDELLIN = { lat: 6.26, lng: -75.58 }

// Orden fijo de una paleta categórica validada: estos tres tonos se distinguen
// entre sí también con daltonismo. El orden importa, no son intercambiables.
// Aun así los mapas llevan leyenda con el nombre de cada línea: el color nunca
// es el único canal de identidad.
export const COLORES_RUTA = ['#2a78d6', '#eb6834', '#1baf7a']

// Cuando se mira una sola ruta, los colores distinguen sentidos, no líneas: el
// teal de siempre para la ida y el azul de la paleta para la vuelta.
export const COLOR_IDA = '#0d9488'
export const COLOR_VUELTA = '#2a78d6'

// El resto del proyecto (y las columnas lat/lng de la tabla `paradas`) usa pares
// [lat, lng]. Google espera objetos, así que la conversión vive solo aquí.
export type Coordenada = [number, number]

export function aLatLng([lat, lng]: Coordenada): google.maps.LatLngLiteral {
  return { lat, lng }
}

// Distancia en línea recta entre dos puntos (Haversine).
export function distanciaKm([la1, lo1]: Coordenada, [la2, lo2]: Coordenada): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const h =
    Math.sin(rad(la2 - la1) / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Haversine sobre el trazado: la distancia realmente recorrida, no la línea recta.
export function longitudKm(recorrido: Coordenada[]): number {
  let total = 0
  for (let i = 1; i < recorrido.length; i++) total += distanciaKm(recorrido[i - 1], recorrido[i])
  return Math.round(total * 10) / 10
}
