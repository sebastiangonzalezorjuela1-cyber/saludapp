import { faltantesComoTexto, passwordEsValida, requisitosCumplidos } from './validarPassword'

describe('validarPassword', () => {
  it('acepta una contraseña que cumple los cinco requisitos', () => {
    expect(passwordEsValida('Clave#2026')).toBe(true)
    expect(requisitosCumplidos('Clave#2026')).toBe(5)
  })

  it('cuenta las letras con tilde y la ñ como mayúsculas y minúsculas', () => {
    expect(passwordEsValida('Ñandú#2026')).toBe(true)
    expect(passwordEsValida('ÁRBOL#2026')).toBe(false) // falta minúscula
  })

  it('no cuenta un espacio como símbolo', () => {
    expect(passwordEsValida('Clave 2026')).toBe(false)
    expect(faltantesComoTexto('Clave 2026')).toBe('A la contraseña le falta: un símbolo (! @ # $ …).')
  })

  it('la contraseña de demo 123456 no cumple', () => {
    expect(passwordEsValida('123456')).toBe(false)
    expect(requisitosCumplidos('123456')).toBe(1)
  })

  it('nombra todo lo que falta, con "y" antes del último', () => {
    expect(faltantesComoTexto('abc')).toBe(
      'A la contraseña le falta: al menos 8 caracteres, una letra mayúscula, un número y un símbolo (! @ # $ …).',
    )
    expect(faltantesComoTexto('Clave#2026')).toBe('')
  })
})
