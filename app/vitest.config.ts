import { defineConfig } from 'vitest/config'

// Pruebas de la lógica pura de src/lib (sin navegador ni base de datos).
// globals: true y sin importar describe/it/expect en los *.test.ts: en Windows,
// con la unidad en minúscula (c:\), importar 'vitest' cargaba otra copia y
// fallaban todas las pruebas (lección 17 de la guía de Buses Metro).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
