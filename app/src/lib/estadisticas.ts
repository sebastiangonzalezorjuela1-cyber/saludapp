// Utilidades puras del panel de estadísticas. Reescritas a partir de la guía
// de Buses Metro (§4.6, estadisticas.ts), sin la parte de su dominio.

export type Periodo = '7' | '30' | 'todo'

// Inicio del periodo en ISO para la función SQL (undefined = sin límite).
export function desdePeriodo(periodo: Periodo, ahora = Date.now()): string | undefined {
  if (periodo === 'todo') return undefined
  return new Date(ahora - Number(periodo) * 86_400_000).toISOString()
}

// "45 s" | "4 min" | "1 h 20 min" | "2 días" | "—"
export function formatearDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return '—'
  const s = Math.max(0, Math.round(segundos))
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  if (h < 24) return resto ? `${h} h ${resto} min` : `${h} h`
  const dias = Math.round(h / 24)
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

// Porcentaje 0-100 o null si no hay base (no se inventa un 0 %).
export function porcentaje(parte: number, total: number): number | null {
  if (!total) return null
  return (parte / total) * 100
}

// "12 %", "0,4 %" (un decimal solo por debajo de 10) o "—".
export function textoPorcentaje(valor: number | null): string {
  if (valor === null) return '—'
  const decimales = valor > 0 && valor < 10 ? 1 : 0
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: decimales, minimumFractionDigits: decimales })} %`
}

// Marcas del eje con pasos 1/2/5 × 10^n, enteras: 0, 2, 4, 6 …
export function marcasEje(maximo: number, divisiones = 4): number[] {
  if (maximo <= 0) return [0, 1]
  const bruto = maximo / divisiones
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const paso = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitud).find((p) => p >= bruto) ?? 10 * magnitud)
  const marcas: number[] = []
  for (let v = 0; v < maximo + paso; v += paso) marcas.push(v)
  return marcas
}
