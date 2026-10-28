// Logo de SaludApp: cruz médica con corazón. Reemplaza el texto "SITVA" que
// usaban todas las cabeceras de Buses Metro.
export function Marca({ oscura = false, pequena = false }: { oscura?: boolean; pequena?: boolean }) {
  const tamano = pequena ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className={tamano} aria-hidden="true">
        <path
          d="M14 3h12a2 2 0 0 1 2 2v9h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9v9a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-9H3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h9V5a2 2 0 0 1 2-2z"
          fill="#3fb7b0"
        />
        <path
          d="M20 28.5s-7-4.3-7-9.2c0-2.3 1.8-4.1 4-4.1 1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.2 0 4 1.8 4 4.1 0 4.9-7 9.2-7 9.2z"
          fill="#fff"
        />
      </svg>
      <span
        className={`${pequena ? 'text-xl' : 'text-2xl'} font-extrabold tracking-tight ${oscura ? 'text-[#013b4d]' : 'text-white'}`}
      >
        SaludApp
      </span>
    </span>
  )
}
