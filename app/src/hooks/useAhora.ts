import { useEffect, useState } from 'react'

// Date.now() que se actualiza solo cada `intervaloMs`. Para lo que depende de la
// hora actual (alertas que caducan, "próxima cita") sin que cada componente
// cree su propio temporizador. De la guía de Buses Metro (§4.7).
export function useAhora(intervaloMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
