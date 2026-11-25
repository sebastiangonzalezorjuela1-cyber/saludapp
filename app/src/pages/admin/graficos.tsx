import { useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { marcasEje, porcentaje, textoPorcentaje } from '../../lib/estadisticas'

// Gráficos accesibles sin librería (patrón graficos.tsx de la guía de Buses Metro).
// Reglas (skill de visualización):
//   · una sola serie por gráfico → un solo color y sin leyenda (el título la nombra);
//   · barras de máximo 24 px, extremo de datos redondeado 4 px, cuadrado en la base;
//   · tooltip al pasar el ratón Y al enfocar con teclado; el valor va primero;
//   · todo valor del tooltip también está en "Ver como tabla" (el tooltip no es la única vía);
//   · el texto nunca usa el color de la serie.
// #0d9488 pasa las comprobaciones del validador contra la superficie blanca
// (el teal de marca #2c6672 se lee gris: falla el mínimo de croma).
const COLOR_SERIE = '#0d9488'
const COLOR_PISTA = '#ccfbf1' // paso claro de la misma rampa (teal-100) para la parte no ocupada

interface Tooltip {
  valor: string
  etiqueta: string
  x: number
  y: number
}

// Un tooltip por gráfico, posicionado respecto al contenedor.
function useTooltip() {
  const contenedor = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  function mostrar(e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>, valor: string, etiqueta: string) {
    const caja = contenedor.current?.getBoundingClientRect()
    if (!caja) return
    // Con ratón sigue al puntero; con teclado se ancla al centro de la marca.
    const punto =
      'clientX' in e
        ? { x: e.clientX, y: e.clientY }
        : (() => {
            const r = e.currentTarget.getBoundingClientRect()
            return { x: r.left + r.width / 2, y: r.top }
          })()
    setTooltip({ valor, etiqueta, x: punto.x - caja.left, y: punto.y - caja.top })
  }

  const ocultar = () => setTooltip(null)

  const capa = tooltip && (
    // aria-hidden: cada marca ya lleva su aria-label con el mismo dato.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <span className="block text-sm font-semibold">{tooltip.valor}</span>
      <span className="block text-slate-300">{tooltip.etiqueta}</span>
    </div>
  )

  return { contenedor, mostrar, ocultar, capa }
}

// "Ver como tabla": cada gráfico se puede leer sin color, sin ratón y con lector de pantalla.
export function TablaDatos({ columnas, filas }: { columnas: string[]; filas: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-[#2c6672] hover:underline">Ver como tabla</summary>
      <table className="mt-2 w-full text-left">
        <thead className="text-xs text-slate-500">
          <tr>
            {columnas.map((c, i) => (
              <th key={c} className={`py-1 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {filas.map((fila) => (
            <tr key={String(fila[0])}>
              {fila.map((celda, i) => (
                <td key={i} className={`py-1 pr-3 ${i > 0 ? 'text-right' : ''}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export interface DatoOcupacion {
  etiqueta: string
  tomadas: number
  ofrecidas: number
}

// Ocupación por categoría: barra horizontal de 0 a 100 % sobre una pista clara
// de la misma rampa. Valor en la punta, fuera de la barra (nunca recortado).
export function BarrasOcupacion({ datos, columnaEtiqueta }: { datos: DatoOcupacion[]; columnaEtiqueta: string }) {
  const { contenedor, mostrar, ocultar, capa } = useTooltip()
  if (datos.length === 0) return <p className="text-sm text-slate-500">No hay horarios abiertos en los próximos 14 días.</p>

  return (
    <div ref={contenedor} className="relative">
      <ul className="space-y-2.5">
        {datos.map((d) => {
          const pct = porcentaje(d.tomadas, d.ofrecidas)
          const valor = textoPorcentaje(pct)
          const detalle = `${d.etiqueta} · ${d.tomadas} de ${d.ofrecidas} horarios tomados`
          return (
            <li key={d.etiqueta}>
              <button
                type="button"
                aria-label={`${d.etiqueta}: ${valor} de ocupación, ${d.tomadas} de ${d.ofrecidas} horarios tomados`}
                onPointerMove={(e) => mostrar(e, valor, detalle)}
                onPointerLeave={ocultar}
                onFocus={(e) => mostrar(e, valor, detalle)}
                onBlur={ocultar}
                className="group grid w-full grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488]"
              >
                <span className="truncate text-sm text-slate-700">{d.etiqueta}</span>
                <span className="h-4 w-full overflow-hidden rounded-r-[4px]" style={{ backgroundColor: COLOR_PISTA }}>
                  <span
                    className="block h-full rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: COLOR_SERIE }}
                  />
                </span>
                <span className="text-right text-sm font-semibold text-slate-900 tabular-nums">{valor}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {capa}
      <TablaDatos
        columnas={[columnaEtiqueta, 'Tomadas', 'Ofrecidas', 'Ocupación']}
        filas={datos.map((d) => [d.etiqueta, d.tomadas, d.ofrecidas, textoPorcentaje(porcentaje(d.tomadas, d.ofrecidas))])}
      />
    </div>
  )
}

// Demanda por hora del día: columnas verticales con eje Y de marcas limpias.
// Se muestra el horario de atención (7-17 h) ampliado si hay citas fuera de él;
// los ceros dentro del rango se ven (una hora sin citas también es un dato).
export function ColumnasPorHora({ datos }: { datos: { hora: number; total: number }[] }) {
  const { contenedor, mostrar, ocultar, capa } = useTooltip()
  const conDatos = datos.filter((d) => d.total > 0).map((d) => d.hora)
  const desde = Math.min(7, ...conDatos)
  const hasta = Math.max(17, ...conDatos)
  const visibles = datos.filter((d) => d.hora >= desde && d.hora <= hasta)
  const maximo = Math.max(0, ...visibles.map((d) => d.total))
  const marcas = marcasEje(maximo)
  const tope = marcas[marcas.length - 1]
  const horaPico = maximo > 0 ? visibles.find((d) => d.total === maximo)?.hora : undefined
  const rango = (h: number) => `${h}:00 – ${h}:59`

  if (maximo === 0) return <p className="text-sm text-slate-500">Todavía no hay citas solicitadas en este periodo.</p>

  return (
    <div ref={contenedor} className="relative">
      <div className="flex gap-2">
        {/* Eje Y: texto atenuado, marcas redondas. */}
        <div className="relative h-40 w-6 shrink-0 text-right text-[11px] text-slate-400 tabular-nums" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(m / tope) * 100}%` }}>
              {m}
            </span>
          ))}
        </div>
        <div className="relative h-40 flex-1">
          {/* Rejilla: líneas finas y continuas, discretas. */}
          {marcas.map((m) => (
            <span
              key={m}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-slate-200"
              style={{ bottom: `${(m / tope) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {visibles.map((d) => {
              const valor = `${d.total} ${d.total === 1 ? 'cita' : 'citas'}`
              return (
                <button
                  key={d.hora}
                  type="button"
                  aria-label={`${rango(d.hora)}: ${valor}`}
                  onPointerMove={(e) => mostrar(e, valor, rango(d.hora))}
                  onPointerLeave={ocultar}
                  onFocus={(e) => mostrar(e, valor, rango(d.hora))}
                  onBlur={ocultar}
                  // El área de toque es toda la franja (más grande que la columna).
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-2 focus-visible:outline-[#0d9488]"
                >
                  {d.hora === horaPico && (
                    <span
                      className="absolute text-xs font-semibold text-slate-900 tabular-nums"
                      style={{ bottom: `calc(${(d.total / tope) * 100}% + 4px)` }}
                      aria-hidden="true"
                    >
                      {d.total}
                    </span>
                  )}
                  <span
                    className="block w-full max-w-6 rounded-t-[4px] transition-[filter] group-hover:brightness-110"
                    style={{ height: `${(d.total / tope) * 100}%`, backgroundColor: COLOR_SERIE }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {/* Eje X: una etiqueta cada dos horas para que no se amontonen. */}
      <div className="mt-1 ml-8 flex gap-[2px] text-[11px] text-slate-400 tabular-nums" aria-hidden="true">
        {visibles.map((d) => (
          <span key={d.hora} className="flex-1 text-center">
            {d.hora % 2 === 0 ? `${d.hora}h` : ''}
          </span>
        ))}
      </div>
      {capa}
      <TablaDatos columnas={['Hora', 'Citas']} filas={visibles.map((d) => [rango(d.hora), d.total])} />
    </div>
  )
}

// Cifra destacada (tarjeta de estadística): etiqueta, valor y nota opcional.
export function Cifra({
  etiqueta,
  valor,
  nota,
  destacada = false,
}: {
  etiqueta: string
  valor: ReactNode
  nota?: string
  destacada?: boolean
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${destacada ? 'ring-2 ring-[#2c6672]' : 'ring-slate-200/80'}`}
    >
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className={`mt-1 font-semibold text-slate-900 ${destacada ? 'text-4xl' : 'text-2xl'}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-slate-400">{nota}</p>}
    </div>
  )
}
