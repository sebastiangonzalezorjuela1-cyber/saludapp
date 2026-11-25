import { esEmailValido } from './validarEmail'

describe('esEmailValido', () => {
  it('acepta correos normales, con subdominios y espacios alrededor', () => {
    expect(esEmailValido('paciente@test.com')).toBe(true)
    expect(esEmailValido('ana.lopez@correo.eps.com.co')).toBe(true)
    expect(esEmailValido('  dani@gmail.com  ')).toBe(true)
  })

  it('exige dominio de primer nivel (type="email" no lo hace)', () => {
    expect(esEmailValido('daniel@gmail')).toBe(false)
    expect(esEmailValido('daniel@gmail.c')).toBe(false)
  })

  it('rechaza formas rotas', () => {
    expect(esEmailValido('sin-arroba.com')).toBe(false)
    expect(esEmailValido('dos@@arrobas.com')).toBe(false)
    expect(esEmailValido('con espacio@correo.com')).toBe(false)
    expect(esEmailValido('')).toBe(false)
  })
})
