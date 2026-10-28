import { useEffect, useRef, useState } from 'react'
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
  type ControlPosition,
} from '@vis.gl/react-google-maps'
import { BusFront, MapPinOff } from 'lucide-react'
import {
  CENTRO_MEDELLIN,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_ID,
  aLatLng,
  mapasConfigurados,
  type Coordenada,
} from './mapaConfig'

function AvisoSinClave({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-slate-100 p-6 ${className ?? ''}`}>
      <div className="max-w-sm text-center">
        <MapPinOff className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Mapa no configurado</p>
        <p className="mt-1 text-xs text-slate-500">
          Falta <code className="rounded bg-slate-200 px-1">VITE_GOOGLE_MAPS_API_KEY</code> en el archivo{' '}
          <code className="rounded bg-slate-200 px-1">.env.local</code>.
        </p>
      </div>
    </div>
  )
}

export function Mapa({
  centro = CENTRO_MEDELLIN,
  zoom,
  className,
  posicionZoom,
  children,
}: {
  centro?: google.maps.LatLngLiteral
  zoom: number
  className?: string
  // Para mapas con algo flotando encima de la esquina inferior derecha, donde
  // Google pone el zoom por defecto.
  posicionZoom?: ControlPosition
  children?: React.ReactNode
}) {
  if (!mapasConfigurados) return <AvisoSinClave className={className} />

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        defaultCenter={centro}
        defaultZoom={zoom}
        mapId={GOOGLE_MAPS_ID}
        className={className}
        disableDefaultUI
        zoomControl
        // La copia de ControlPosition de vis.gl tiene los mismos valores que la de
        // Google; se usa porque `google.maps` aún no existe al primer render.
        zoomControlOptions={
          posicionZoom === undefined
            ? undefined
            : { position: posicionZoom as unknown as google.maps.ControlPosition }
        }
        gestureHandling="greedy"
      >
        {children}
      </Map>
    </APIProvider>
  )
}

// Encuadra el mapa para que quepa la ruta completa. Sin esto habría que adivinar
// un centro y un zoom por ruta, y cada una tiene largo y orientación distintos.
export function AjustarARuta({
  puntos,
  margen = 48,
}: {
  puntos: Coordenada[]
  // Un número para los cuatro lados, o uno por lado si algo tapa parte del mapa.
  margen?: number | google.maps.Padding
}) {
  const mapa = useMap()
  const libreriaNucleo = useMapsLibrary('core')
  const clavePuntos = JSON.stringify(puntos)

  useEffect(() => {
    if (!mapa || !libreriaNucleo) return
    const lista = JSON.parse(clavePuntos) as Coordenada[]
    if (lista.length === 0) return

    const limites = new libreriaNucleo.LatLngBounds()
    for (const p of lista) limites.extend(aLatLng(p))
    mapa.fitBounds(limites, margen)
  }, [mapa, libreriaNucleo, clavePuntos, margen])

  return null
}

// Mantiene el mapa centrado en un punto que se mueve (el bus del conductor).
// La primera vez acerca el zoom; después solo desplaza, así que si el conductor
// ajusta el zoom a mano, se respeta. Arrastrar el mapa suelta el seguimiento:
// quien arrastra quiere mirar otra zona, y recentrar le quitaría la vista.
export function SeguirPunto({
  punto,
  activo,
  zoom = 16,
  compensacionY = 0,
  onSoltar,
}: {
  punto: Coordenada | null
  activo: boolean
  zoom?: number
  // Píxeles que el punto queda por encima del centro, para que no lo tape lo
  // que flote sobre la parte baja del mapa.
  compensacionY?: number
  onSoltar: () => void
}) {
  const mapa = useMap()
  const yaAcercado = useRef(false)
  const clave = punto ? `${punto[0]},${punto[1]}` : ''

  useEffect(() => {
    if (!mapa) return
    if (!activo) {
      // Al retomar el seguimiento vuelve a acercar, por si se alejó entretanto.
      yaAcercado.current = false
      return
    }
    if (!clave) return
    const [lat, lng] = clave.split(',').map(Number)
    if (!yaAcercado.current) {
      mapa.setZoom(zoom)
      yaAcercado.current = true
    }
    // Centrar un poco al sur del bus lo deja por encima del centro en pantalla.
    const metros = compensacionY * metrosPorPixel(lat, mapa.getZoom() ?? zoom)
    mapa.panTo({ lat: lat - metros / METROS_POR_GRADO_LAT, lng })
  }, [mapa, activo, clave, zoom, compensacionY])

  useEffect(() => {
    if (!mapa) return
    const oyente = mapa.addListener('dragstart', onSoltar)
    return () => oyente.remove()
  }, [mapa, onSoltar])

  return null
}

// Mueve el mapa a una parada concreta sin cambiar el zoom. Va aparte de
// AjustarARuta, que solo encuadra al cargar la ruta.
export function CentrarEn({ punto }: { punto: Coordenada | null }) {
  const mapa = useMap()
  const clave = punto ? `${punto[0]},${punto[1]}` : ''

  useEffect(() => {
    if (!mapa || !clave) return
    const [lat, lng] = clave.split(',').map(Number)
    mapa.panTo({ lat, lng })
  }, [mapa, clave])

  return null
}

// El número va dentro del marcador a propósito: con 21 paradas, rotular cada
// nombre sobre el mapa se solapa sin remedio. El número es el puente entre el
// marcador y la lista de abajo, donde el nombre sí cabe entero.
export function MarcadorParada({
  posicion,
  titulo,
  numero,
  activa = false,
  onClick,
}: {
  posicion: Coordenada
  titulo: string
  numero?: number
  activa?: boolean
  onClick?: () => void
}) {
  return (
    <AdvancedMarker position={aLatLng(posicion)} title={titulo} onClick={onClick}>
      {numero === undefined ? (
        <div className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0f2f37] shadow" />
      ) : (
        <div
          className={`flex items-center justify-center rounded-full border-2 border-white font-bold shadow transition-all ${
            activa
              ? 'h-7 w-7 bg-[#e0484a] text-[11px] text-white ring-2 ring-[#e0484a]/40'
              : 'h-5 w-5 bg-[#0f2f37] text-[9px] text-white'
          }`}
        >
          {numero}
        </div>
      )}
    </AdvancedMarker>
  )
}

// Por debajo de este zoom los nombres se pisan entre sí y tapan la ruta: solo
// queda el símbolo, y los nombres aparecen al acercarse.
const ZOOM_MINIMO_NOMBRES = 15

function useZoomActual() {
  const mapa = useMap()
  // El zoom se lee del mapa en cada render; el estado solo sirve para forzar
  // ese render cuando cambia.
  const [, setCambios] = useState(0)

  useEffect(() => {
    if (!mapa) return
    const oyente = mapa.addListener('zoom_changed', () => setCambios((n) => n + 1))
    return () => oyente.remove()
  }, [mapa])

  return mapa?.getZoom() ?? null
}

// Variante para el conductor: un símbolo de parada con el nombre debajo, en vez
// del número del pasajero, porque el conductor no tiene una lista al lado para
// cruzar números con nombres.
export function MarcadorParadaRotulada({ posicion, nombre }: { posicion: Coordenada; nombre: string }) {
  const zoom = useZoomActual()
  const mostrarNombre = zoom !== null && zoom >= ZOOM_MINIMO_NOMBRES

  return (
    <AdvancedMarker position={aLatLng(posicion)} title={nombre}>
      {/* translate-y-1/2: el marcador se ancla por abajo; así el centro del
          símbolo cae justo sobre la parada. El nombre va en absolute para no
          mover ese anclaje. */}
      <div className="relative translate-y-1/2">
        <div className="grid h-6 w-6 place-items-center rounded-md border-2 border-white bg-[#013b4d] shadow-md">
          <BusFront className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        {mostrarNombre && (
          <span
            className="pointer-events-none absolute top-full left-1/2 mt-0.5 w-28 -translate-x-1/2 text-center text-[10px] leading-tight font-semibold text-[#0f2f37]"
            style={{ textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff' }}
          >
            {nombre}
          </span>
        )}
      </div>
    </AdvancedMarker>
  )
}

// Un bus en su posición en vivo. El color es el del sentido en que va, el mismo
// de su línea en el mapa, y la placa lo distingue de los otros buses.
export function MarcadorBus({
  posicion,
  placa,
  color,
  titulo,
  destacado = false,
  alerta = false,
  onClick,
}: {
  posicion: Coordenada
  placa: string
  color: string
  titulo?: string
  // Más grande: el bus del propio conductor, o el que el agente seleccionó.
  destacado?: boolean
  // Insignia roja: el bus tiene reportes sin revisar.
  alerta?: boolean
  onClick?: () => void
}) {
  return (
    <AdvancedMarker
      position={aLatLng(posicion)}
      title={titulo ?? placa}
      zIndex={destacado ? 30 : 20}
      onClick={onClick}
    >
      {/* Igual que en las paradas: el centro del círculo cae sobre la
          posición, y la placa va en absolute para no mover ese anclaje. */}
      <div className="relative translate-y-1/2">
        <div
          className={`grid place-items-center rounded-full border-2 border-white shadow-lg ${
            destacado ? 'h-10 w-10 ring-4 ring-white/60' : 'h-8 w-8'
          }`}
          style={{ backgroundColor: color }}
        >
          <BusFront className={`text-white ${destacado ? 'h-5 w-5' : 'h-4 w-4'}`} strokeWidth={2.5} />
        </div>
        {alerta && (
          <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-red-600 text-[9px] leading-none font-bold text-white">
            !
          </span>
        )}
        <span className="pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded bg-[#0f2f37] px-1 text-[10px] leading-4 font-bold whitespace-nowrap text-white shadow">
          {placa}
        </span>
      </div>
    </AdvancedMarker>
  )
}

// Más que esto, el círculo de precisión taparía media ciudad sin decir nada útil.
const PRECISION_MAXIMA_CIRCULO_M = 1000

// La posición del pasajero: el punto azul de siempre, con el círculo de
// precisión del navegador alrededor.
export function MarcadorMiUbicacion({ posicion, precision }: { posicion: Coordenada; precision: number | null }) {
  const mapa = useMap()
  const libreriaMapas = useMapsLibrary('maps')
  const [lat, lng] = posicion
  const conCirculo = precision !== null && precision < PRECISION_MAXIMA_CIRCULO_M

  useEffect(() => {
    if (!mapa || !libreriaMapas || !conCirculo) return
    const circulo = new libreriaMapas.Circle({
      center: { lat, lng },
      radius: precision ?? 0,
      strokeColor: '#2563eb',
      strokeOpacity: 0.35,
      strokeWeight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      clickable: false,
    })
    circulo.setMap(mapa)
    return () => circulo.setMap(null)
  }, [mapa, libreriaMapas, conCirculo, lat, lng, precision])

  return (
    <AdvancedMarker position={{ lat, lng }} title="Tú estás aquí" zIndex={25}>
      {/* Igual que los demás: el centro del punto cae sobre la posición. */}
      <div className="relative grid h-5 w-5 translate-y-1/2 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/40" />
        <span className="relative h-4 w-4 rounded-full border-[3px] border-white bg-blue-600 shadow-md" />
      </div>
    </AdvancedMarker>
  )
}

const METROS_POR_GRADO_LAT = 110_540
const METROS_POR_GRADO_LNG_ECUADOR = 111_320

// Corre la línea `metros` hacia la derecha del sentido de avance. En cada vértice
// se usa la bisectriz de los dos tramos que se unen, para que las esquinas no se
// abran; el tope evita picos larguísimos en giros muy cerrados.
function desplazarALaDerecha(puntos: Coordenada[], metros: number): Coordenada[] {
  if (puntos.length < 2 || metros === 0) return puntos
  const cosLat = Math.cos((puntos[0][0] * Math.PI) / 180)
  const kx = METROS_POR_GRADO_LNG_ECUADOR * cosLat
  const ky = METROS_POR_GRADO_LAT

  // Normal derecha de cada tramo, en metros. Un tramo de largo cero hereda la
  // del anterior para no dividir por cero.
  const normales: [number, number][] = []
  for (let i = 1; i < puntos.length; i++) {
    const dx = (puntos[i][1] - puntos[i - 1][1]) * kx
    const dy = (puntos[i][0] - puntos[i - 1][0]) * ky
    const largo = Math.hypot(dx, dy)
    normales.push(largo === 0 ? (normales.at(-1) ?? [0, 0]) : [dy / largo, -dx / largo])
  }

  return puntos.map(([lat, lng], i) => {
    const a = normales[Math.max(0, i - 1)]
    const b = normales[Math.min(normales.length - 1, i)]
    let nx = a[0] + b[0]
    let ny = a[1] + b[1]
    const largo = Math.hypot(nx, ny)
    if (largo < 1e-9) {
      nx = b[0]
      ny = b[1]
    } else {
      nx /= largo
      ny /= largo
    }
    const coseno = Math.max(0.5, nx * b[0] + ny * b[1])
    const d = metros / coseno
    return [lat + (ny * d) / ky, lng + (nx * d) / kx]
  })
}

// Metros que mide un píxel de pantalla a esta latitud y zoom (Web Mercator).
function metrosPorPixel(lat: number, zoom: number): number {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

// vis.gl no trae componente de polilínea: hay que instanciar la de la API
// imperativa y colgarla del mapa a mano.
export function RutaDibujada({
  puntos,
  color = '#0d9488',
  grosor = 5,
  desplazamientoPx = 0,
  flechas = false,
}: {
  puntos: Coordenada[]
  color?: string
  grosor?: number
  // Píxeles de separación hacia la derecha del sentido de avance. Se recalcula
  // con cada zoom para que la separación en pantalla no cambie.
  desplazamientoPx?: number
  // Flechas a lo largo de la línea que indican hacia dónde va el bus.
  flechas?: boolean
}) {
  const mapa = useMap()
  const libreriaMapas = useMapsLibrary('maps')

  // `puntos` suele llegar como literal nuevo en cada render; serializarlo evita
  // que la línea se destruya y se recree en bucle.
  const clavePuntos = JSON.stringify(puntos)

  useEffect(() => {
    if (!mapa || !libreriaMapas) return

    const originales = JSON.parse(clavePuntos) as Coordenada[]
    const trazar = () => {
      if (desplazamientoPx === 0 || originales.length === 0) return originales.map(aLatLng)
      const metros = desplazamientoPx * metrosPorPixel(originales[0][0], mapa.getZoom() ?? 13)
      return desplazarALaDerecha(originales, metros).map(aLatLng)
    }

    const linea = new libreriaMapas.Polyline({
      path: trazar(),
      strokeColor: color,
      strokeWeight: grosor,
      icons: flechas
        ? [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 1.8,
                strokeWeight: 0,
                fillColor: '#ffffff',
                fillOpacity: 1,
              },
              offset: '30px',
              repeat: '90px',
            },
          ]
        : undefined,
    })
    linea.setMap(mapa)

    const oyente = desplazamientoPx === 0 ? null : mapa.addListener('zoom_changed', () => linea.setPath(trazar()))

    return () => {
      oyente?.remove()
      linea.setMap(null)
    }
  }, [mapa, libreriaMapas, clavePuntos, color, grosor, desplazamientoPx, flechas])

  return null
}

// Una ruta con sus dos sentidos. Cada uno se corre hacia su derecha, como el
// carril por el que va el bus: así se ven dos líneas aunque la vuelta use las
// mismas calles que la ida, y las flechas dicen cuál es cuál.
export function RutaConSentidos({
  ida,
  vuelta,
  colorIda,
  colorVuelta = colorIda,
  grosor = 4,
}: {
  ida: Coordenada[]
  // null: la vuelta es la ida recorrida al revés.
  vuelta: Coordenada[] | null
  colorIda: string
  colorVuelta?: string
  grosor?: number
}) {
  const regreso = vuelta ?? [...ida].reverse()
  // La mitad del grosor más un píxel de aire entre las dos líneas.
  const separacion = grosor / 2 + 1
  return (
    <>
      <RutaDibujada puntos={regreso} color={colorVuelta} grosor={grosor} desplazamientoPx={separacion} flechas />
      <RutaDibujada puntos={ida} color={colorIda} grosor={grosor} desplazamientoPx={separacion} flechas />
    </>
  )
}
