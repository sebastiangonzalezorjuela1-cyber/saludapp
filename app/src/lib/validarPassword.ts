export interface RequisitoPassword {
  id: string
  texto: string
  cumple: (valor: string) => boolean
}

// Se usan clases Unicode en vez de [A-Z] / [a-z] para que el español funcione:
// con rangos ASCII, "Ñ" o "Á" no contarían como mayúscula y "contraseñá" daría
// por cumplido el requisito de símbolo solo por llevar tildes.
export const REQUISITOS_PASSWORD: RequisitoPassword[] = [
  { id: 'longitud', texto: 'Al menos 8 caracteres', cumple: (v) => v.length >= 8 },
  { id: 'mayuscula', texto: 'Una letra mayúscula', cumple: (v) => /\p{Lu}/u.test(v) },
  { id: 'minuscula', texto: 'Una letra minúscula', cumple: (v) => /\p{Ll}/u.test(v) },
  { id: 'numero', texto: 'Un número', cumple: (v) => /\p{N}/u.test(v) },
  // \s excluido: un espacio es invisible, así que darlo por símbolo válido deja
  // marcar el requisito en verde sin que se vea nada escrito.
  { id: 'simbolo', texto: 'Un símbolo (! @ # $ …)', cumple: (v) => /[^\p{L}\p{N}\s]/u.test(v) },
]

export function requisitosCumplidos(valor: string): number {
  return REQUISITOS_PASSWORD.filter((r) => r.cumple(valor)).length
}

export function passwordEsValida(valor: string): boolean {
  return REQUISITOS_PASSWORD.every((r) => r.cumple(valor))
}

// Para el mensaje de error al enviar: nombra lo que falta en vez de un genérico
// "la contraseña no es válida".
export function faltantesComoTexto(valor: string): string {
  const faltan = REQUISITOS_PASSWORD.filter((r) => !r.cumple(valor)).map((r) => r.texto.toLowerCase())
  if (faltan.length === 0) return ''
  if (faltan.length === 1) return `A la contraseña le falta: ${faltan[0]}.`
  return `A la contraseña le falta: ${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}.`
}
