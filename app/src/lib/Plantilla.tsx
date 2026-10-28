import type { ReactNode } from 'react'
import { User, type LucideIcon } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { Marca } from './Marca'
import tuerca from '../assets/decor/tuerca.png'
import plantaIzquierda from '../assets/decor/planta-izquierda.png'
import plantaDerecha from '../assets/decor/planta-derecha.png'

// Piezas de interfaz que en Buses Metro estaban copiadas dentro de cada página
// (cabecera, portada, plantas decorativas, títulos de sección). Aquí se sacan
// a un solo archivo para que las tres pantallas de SaludApp las compartan.

export function Encabezado({ derecha }: { derecha?: ReactNode }) {
  const { nombre, session } = useAuth()
  const nombreMostrado = nombre ?? session?.user.email?.split('@')[0] ?? 'Usuario'

  return (
    <header className="relative z-20 shrink-0 bg-[#013b4d] shadow-lg shadow-[#013b4d]/25">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <Marca pequena />
        <div className="mr-auto" />
        {derecha}

        <button
          type="button"
          aria-label="Configuración"
          title="Configuración"
          className="group grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-white/20 transition-colors hover:bg-white/10"
        >
          <img src={tuerca} alt="" className="h-6 w-6 transition-transform duration-500 group-hover:rotate-90" />
        </button>

        <div className="flex items-center gap-2.5 rounded-full bg-white/10 p-1.5 ring-1 ring-white/15 sm:pr-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#013b4d]">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden text-sm leading-tight sm:block">
            <p className="text-[11px] text-teal-200/90">Bienvenido,</p>
            <p className="font-semibold text-white">{nombreMostrado}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap text-teal-200 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}

// Antes la portada era una foto de la ciudad con un degradado encima. Aquí se
// conserva el degradado y la foto se cambia por formas suaves: es provisional.
export function Portada({ titulo, subtitulo, alto = 'normal' }: { titulo: string; subtitulo: string; alto?: 'normal' | 'bajo' }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0f5560]">
      <div className="absolute inset-0 bg-gradient-to-r from-[#013b4d] via-[#0f5560] to-[#3fb7b0]/70" />
      <div className="absolute -top-24 right-[-6rem] h-80 w-80 rounded-full bg-white/10" />
      <div className="absolute right-40 -bottom-28 h-64 w-64 rounded-full bg-white/5" />
      <svg viewBox="0 0 40 40" className="absolute top-8 right-10 hidden h-40 w-40 text-white/10 md:block" aria-hidden="true">
        <path
          d="M14 3h12a2 2 0 0 1 2 2v9h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9v9a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-9H3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h9V5a2 2 0 0 1 2-2z"
          fill="currentColor"
        />
      </svg>
      <div
        className={`relative mx-auto w-full max-w-6xl px-4 sm:px-6 ${
          alto === 'normal' ? 'pt-12 pb-24 sm:pt-16 sm:pb-28' : 'pt-10 pb-20 sm:pt-12 sm:pb-24'
        }`}
      >
        <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">{titulo}</h1>
        <p className="mt-2 max-w-xl text-sm text-teal-50/90 sm:text-base">{subtitulo}</p>
      </div>
    </section>
  )
}

export function Plantas() {
  return (
    <>
      <img
        src={plantaIzquierda}
        alt=""
        className="pointer-events-none fixed bottom-0 left-0 z-0 w-36 opacity-90 sm:w-56 lg:w-72"
      />
      <img
        src={plantaDerecha}
        alt=""
        className="pointer-events-none fixed right-0 bottom-0 z-0 w-36 opacity-90 sm:w-56 lg:w-72"
      />
    </>
  )
}

export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mt-8 mb-4 flex items-center gap-2.5">
      <span className="h-5 w-1 rounded-full bg-[#2c6672]" />
      <h2 className="mr-auto text-sm font-semibold tracking-wide text-[#0f3a48] uppercase">{children}</h2>
      {accion}
    </div>
  )
}

// La misma tarjeta de métrica del panel del agente.
export function TarjetaMetrica({
  etiqueta,
  valor,
  Icono,
  tono = 'teal',
  nota,
}: {
  etiqueta: string
  valor: number
  Icono: LucideIcon
  tono?: 'teal' | 'ambar' | 'verde' | 'rojo' | 'azul'
  nota?: string
}) {
  const tonos = {
    teal: 'bg-teal-50 text-teal-700',
    ambar: 'bg-amber-50 text-amber-600',
    verde: 'bg-emerald-50 text-emerald-600',
    rojo: 'bg-red-50 text-red-600',
    azul: 'bg-sky-50 text-sky-700',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg shadow-[#013b4d]/10 ring-1 ring-slate-200/80">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tonos[tono]}`}>
        <Icono className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl leading-none font-bold text-slate-900">{valor}</p>
        <p className="mt-1 text-sm font-medium text-slate-700">{etiqueta}</p>
        {nota && <p className="text-xs text-slate-400">{nota}</p>}
      </div>
    </div>
  )
}

export function Pie({ texto }: { texto: string }) {
  return (
    <footer className="relative z-10 shrink-0 bg-[#013b4d] py-3 text-center text-xs text-teal-200/80">
      © SaludApp {new Date().getFullYear()} · {texto}
    </footer>
  )
}
