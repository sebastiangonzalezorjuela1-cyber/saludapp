// `<input type="email">` solo exige la forma `algo@algo`: da por bueno
// "daniel@gmail" sin dominio de primer nivel, y Supabase también lo acepta.
// Por eso hace falta este chequeo extra, que sí exige el punto y un TLD
// de al menos dos letras.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i

export function esEmailValido(email: string): boolean {
  return FORMATO_EMAIL.test(email.trim())
}
