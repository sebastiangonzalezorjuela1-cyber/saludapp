import { supabase } from './supabaseClient'

export const PREGUNTAS_SEGURIDAD = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo de la infancia?',
  '¿Cuál es tu comida favorita?',
  '¿Cuál fue tu primer colegio?',
  '¿Cuál es el segundo nombre de tu madre?',
] as const

// El endpoint devuelve el detalle del fallo en el cuerpo JSON, pero supabase-js
// lo deja envuelto en error.context cuando el status no es 2xx.
export async function llamarRecuperacion<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('recuperar-password', { body })
  if (!error) return data as T

  const contexto = (error as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    const detalle = await contexto.json().catch(() => null)
    if (detalle?.error) throw new Error(detalle.error)
  }
  throw new Error(error.message)
}
