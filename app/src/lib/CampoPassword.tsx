import { useId, useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { REQUISITOS_PASSWORD, requisitosCumplidos } from './validarPassword'

export function CampoPassword({
  id,
  etiqueta,
  valor,
  onChange,
  autoComplete,
  placeholder,
  clasesFoco = 'focus:border-sky-500 focus:ring-sky-500',
  children,
}: {
  id: string
  etiqueta: string
  valor: string
  onChange: (valor: string) => void
  autoComplete?: string
  placeholder?: string
  clasesFoco?: string
  /** Contenido extra junto a la etiqueta, p. ej. el enlace de contraseña olvidada. */
  children?: React.ReactNode
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {etiqueta}
        </label>
        {children}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          className={`w-full rounded border border-slate-300 bg-white/40 py-2 pr-10 pl-3 text-sm outline-none focus:ring-1 ${clasesFoco}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export function RequisitosPassword({ valor }: { valor: string }) {
  const idLista = useId()
  const cumplidos = requisitosCumplidos(valor)
  const total = REQUISITOS_PASSWORD.length

  // Paleta de estado fija. El color nunca va solo: cada requisito lleva su icono
  // y su texto, y la barra se acompaña del contador.
  const colorBarra = cumplidos === total ? '#0ca30c' : cumplidos >= 3 ? '#fab219' : '#d03b3b'

  return (
    <div className="rounded-lg bg-slate-50/60 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Requisitos</p>
        <p className="text-xs text-slate-500">
          {cumplidos} de {total}
        </p>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded bg-slate-200" aria-hidden="true">
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: `${(cumplidos / total) * 100}%`, backgroundColor: colorBarra }}
        />
      </div>

      <ul id={idLista} className="space-y-1">
        {REQUISITOS_PASSWORD.map((requisito) => {
          const ok = requisito.cumple(valor)
          return (
            <li
              key={requisito.id}
              className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              )}
              <span className={ok ? 'line-through decoration-emerald-600/40' : ''}>{requisito.texto}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
