import { RefreshCw, TriangleAlert } from 'lucide-react'

// Reemplaza los estados vacíos engañosos ("No hay citas") cuando lo que pasó
// es que falló la carga. Reescrito a partir de la guía de Buses Metro (§4.5).
export function AvisoError({
  titulo,
  detalle,
  onReintentar,
  reintentando = false,
  className = '',
}: {
  titulo: string
  detalle?: string
  onReintentar?: () => void
  reintentando?: boolean
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-red-900 ring-1 ring-red-200 ${className}`}
    >
      <TriangleAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="mr-auto min-w-0">
        <p className="text-sm font-semibold">{titulo}</p>
        {detalle && <p className="text-sm text-red-800/90">{detalle}</p>}
      </div>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          disabled={reintentando}
          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reintentando ? 'animate-spin' : ''}`} aria-hidden="true" />
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    </div>
  )
}
