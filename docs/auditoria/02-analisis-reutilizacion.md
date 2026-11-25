# 02 · Análisis de reutilización: guía de Buses Metro → SaludApp

> **Fuente.** `guia-reutilizacion.md` (PDF entregado; describe Buses Metro en el
> commit `8a64a05`, noviembre de 2026). **Solo se dispone de la guía, no del
> código de Buses Metro.** Todo lo que aquí se dice de sus módulos sale de su
> descripción, no de haberlos leído.
>
> Se respeta la clasificación de la guía: **A** copiar tal cual · **B** copiar y
> ajustar · **C** imitar el patrón · **D** solo del dominio original.
> El estado en SaludApp se basa en el documento [01](01-auditoria-proyecto.md).

---

## 1. Conclusión principal

**SaludApp se bifurcó de una versión anterior de Buses Metro a la descrita en la guía.**

- **[H]** El README afirma que el login, la recuperación y el contexto de sesión
  se copiaron "sin cambios" ([README.md:54](../../README.md#L54)).
- **[H]** Pero el `AuthContext` de SaludApp no tiene lo que la guía describe:
  ni `problemaPerfil`, ni `reintentarPerfil`, ni `actualizarNombre`, ni `maybeSingle`.
  Tampoco existen `mensajesError.ts`, `AvisoError`, `VentanaAjustes`, `fechas.ts`,
  `estadisticas.ts`, `graficos.tsx`, Vitest ni el trigger de perfil.
- **[I]** Por eso varias "lecciones aprendidas" de la guía (§7) son justo los
  defectos encontrados en la auditoría (H-U1, H-U3, H-U4, H-U5, H-S1, H-S4).

Consecuencia práctica: el mayor valor de la guía para SaludApp no es añadir
pantallas nuevas, sino **traer las correcciones que Buses Metro ya hizo** y,
sobre esa base, **adaptar sus patrones de aprobación, estadísticas y tiempo real**
al dominio de citas.

## 2. Compatibilidad tecnológica

| Aspecto | Buses Metro (guía) | SaludApp | Compatibilidad |
|---|---|---|---|
| React / Router / Vite / Tailwind / supabase-js | 19.2 / 7.18 / 8.2 / 4.3 / 2.112 | Mismas versiones | ✅ Total; ningún cambio de arquitectura |
| TypeScript | ~6.0 | ~6.0.2 | ✅ |
| Cliente tipado `createClient<Database>` | Sí | No | ⚠️ Hay que generar `database.ts` antes de copiar código que lo suponga (p. ej. `useTablaEnVivo`) |
| Vitest | 5.1.1 | No instalado | ⚠️ Dependencia nueva (justificada: mismo ecosistema Vite) |
| `@radix-ui/react-dialog` | Usado en `VentanaAjustes` | Instalado, sin uso | ✅ Se puede usar sin instalar nada |
| `schema.sql` / `policies.sql` / migraciones / `pruebas/permisos.sql` | Sí | No | ⚠️ Hay que crear la línea base antes de migrar |
| Roles | usuario / conductor / agente | paciente / medico / admin | ✅ Mismo número y misma relación (consumidor / operario / supervisor) |
| Zona horaria | `'America/Bogota'` | `'America/Bogota'` ([citas.ts:7](../../app/src/lib/citas.ts#L7)) | ✅ Las funciones de estadísticas se trasladan sin cambiar la zona |
| Simulador Node con `service_role` | Sí | No hay servidor | ⚠️ Para automatizar conviene `pg_cron` (disponible, no instalado — verificado) antes que un proceso Node |
| Sistema operativo del equipo | — | Windows (`c:\`) | ⚠️ Aplica la lección 17 (Vitest con `globals: true`) |

**No hace falta introducir ninguna tecnología nueva** para la mayoría de propuestas.
Las únicas incorporaciones que se justifican en el doc 03 son: **Vitest**
(pruebas), la extensión **`pg_cron`** (solo en el plan ambicioso) y una
**segunda Edge Function** (solo en el plan ambicioso).

## 3. Evaluación módulo por módulo

Columnas: **Nivel** según la guía · **En SaludApp** (✅ ya está y equivale · 🟡 versión
antigua o parcial · ❌ no está · ➖ no aplica) · **Encaje** con el dominio de citas ·
**Decisión**.

### 3.1 Autenticación, roles y cuenta

| Módulo (guía) | Nivel | En SaludApp | Encaje y limitaciones | Decisión |
|---|---|---|---|---|
| `supabaseClient.ts` tipado | A | 🟡 sin `<Database>` | Requiere generar tipos | **Adoptar** con T4 |
| `useAuth.ts` + `AuthContext.tsx` (`problemaPerfil`, `maybeSingle`, `reintentarPerfil`, `actualizarNombre`, contexto y Provider en archivos separados) | B | 🟡 versión antigua | Corrige H-U1 y el aviso `only-export-components` | **Adoptar** (T3) |
| `ProblemaPerfil.tsx` | B | ❌ | Cambiar textos y colores | **Adoptar** (T3) |
| `RutaProtegida.tsx` | A | 🟡 sin rama `problemaPerfil` | Cambio de 1-2 líneas | **Adoptar** (T3) |
| `rolInicial.ts`, `SeleccionRolPage` | A/B | ✅ | — | Mantener |
| Trigger `crear_perfil_al_registrarse` (§5.1) | B | ❌ (perfil insertado por el cliente) | Corrige H-U2; el trigger **nunca debe fallar** o bloquea el alta | **Adoptar** (T3) |
| `usuarios` con `check` de nombre + `grant update (nombre)` | B | ❌ | Necesario para que el usuario cambie su nombre | **Adoptar** (E1) |
| `VentanaAjustes.tsx` (nombre, contraseña verificando la actual, pregunta) | B | ❌ (botón decorativo) | Encaja directo con el botón ⚙️ existente. **No** reemplazar `Encabezado` por la `Cabecera` de la guía: basta conectar el botón | **Adoptar** (E1) |
| `Cabecera.tsx` | B | ➖ equivalente propio (`Encabezado`) | Sustituirlo sería refactorizar sin beneficio | **No traer** |
| `CampoPassword`, `validarPassword`, `validarEmail` | A | ✅ | — | Mantener; traer sus `*.test.ts` |
| Recuperación por pregunta (§5.5) | A/B | 🟡 **sin el filtro por rol** que la guía sí tiene (`p.rol = 'usuario'`) | La guía advierte: "solo tiene sentido si los correos no son reales". Con pacientes reales debe sustituirse por `resetPasswordForEmail` | **Endurecer ya** (T2); **sustituir** si hay producción |
| `mensajesError.ts` | A | ❌ | Revisar el texto de `reauthentication_needed` ("los correos del proyecto no son reales") | **Adoptar** (T3) |

### 3.2 Aprobación de solicitudes (§5.4)

| Módulo | Nivel | En SaludApp | Encaje y limitaciones | Decisión |
|---|---|---|---|---|
| Tabla `reportes` completa (`comentario_agente`, `origen`, `minutos_retraso`) | C | 🟡 sin esas tres columnas | `minutos_retraso` encaja literal (retrasos del médico); `comentario` → motivo de rechazo | **Ampliar** (E3) |
| Policy "insert con estado inicial forzado" | C | ❌ (H-S1) | Imprescindible | **Adoptar** (T2) |
| Policy "lectura distinta por rol" | C | ❌ (lectura total) | Paciente: solo aprobadas que le afectan; médico: las suyas; admin: todas | **Adoptar** (T2/E4) |
| `BandejaReportes.tsx` (filtros, archivado, motivo de rechazo, `limit 50` + `count exact`) | C | 🟡 bandeja inline en `AdminPage`, sin motivo ni conteo real | Extraerla a su componente al ampliarla | **Ampliar** (E3) |
| `conductor/opciones.ts` (opción rápida con dato estructurado) | C | 🟡 opciones sin dato estructurado ([MedicoPage.tsx:29-33](../../app/src/pages/medico/MedicoPage.tsx#L29-L33)) | Añadir `minutos` y `tipo` | **Ampliar** (E3) |
| `useMisReportes.ts` (el emisor ve la decisión en vivo) | C | 🟡 el médico recarga todo | Patrón simple, suficiente a esta escala | **Adoptar** (E3) |
| `novedades.ts` (vigencia temporal de un evento aprobado) | C | ❌ (ventana fija de 6 h) | Vigencia = hasta que pase la cita afectada | **Adoptar adaptado** (E4) |
| `useNovedadesAprobadas.ts` (Realtime + sondeo, para filas que dejan de ser visibles por RLS) | C | ❌ | Necesario en cuanto la lectura de novedades dependa del rol | **Adoptar** (E4) |
| **Reutilización creativa**: el mismo flujo pendiente → aprobado/rechazado sirve para *citas* (ya lo usa), *cambios de horario del médico* y *solicitudes de alta* | C | — | Evita inventar otro mecanismo | **Combinar** (E2, N2 opcional) |

### 3.3 Tiempo real (§4.7, §5.6)

| Módulo | Nivel | En SaludApp | Encaje y limitaciones | Decisión |
|---|---|---|---|---|
| Patrón simple "evento → recargar lista" con `filter` | C | ✅ en las 3 páginas | Correcto a esta escala | Mantener |
| `useTablaEnVivo` / `useUbicacionesEnVivo` (foto + eventos + reconexión + carrera + agrupado + caducidad) | C | ❌ | **Sobredimensionado** para citas: no hay flujo de alta frecuencia y la caducidad no tiene sentido. La plantilla de la guía además omite el agrupado y la caducidad que dice resolver, y exige el cliente tipado | **No adoptar por ahora**; reconsiderar solo si el panel del admin se vuelve lento |
| Volver a pedir la foto en `SUBSCRIBED` (reconexión) | C | 🟡 solo en `useAlertaNovedades` | Barato de añadir a los otros canales; evita perder cambios tras una caída de red | **Adoptar** donde se toque (E3/N6) |
| `agruparEventos.ts` | A | ❌ | Útil solo con ráfagas; el admin podría beneficiarse si crece | **Diferir** |
| `useAhora.ts` | A | ❌ | Resuelve los avisos `purity` y hace que "Tu próxima cita" o "hace X min" se actualicen | **Adoptar** (T3/E4) |

### 3.4 Dashboards y estadísticas

| Módulo | Nivel | En SaludApp | Encaje y limitaciones | Decisión |
|---|---|---|---|---|
| `Tarjeta`, `Panel`, `BarraDistribucion` | A | ✅ copiados inline en `AdminPage` | Ya están | Mantener; mover a un archivo solo si se reutilizan |
| `graficos.tsx` (`BarrasHorizontales`, `ColumnasPorHora`, `TablaDatos` accesible, sin librería) | A/B | ❌ | Encaje alto: demanda por hora, ocupación por especialidad/sede. Sin dependencias nuevas | **Adoptar** (N1) |
| `estadisticas.ts` (`desdePeriodo`, `formatearDuracion`, `marcasEje`, `porcentajeAprobados`) | B | ❌ | Genéricas; `etiquetaTipo` es del dominio buses | **Adoptar** (N1) |
| `estadisticas_reportes(p_desde)` → `jsonb` (`generate_series` de 24 h, `America/Bogota`) | C | ❌ | Patrón ideal: una sola llamada RPC por pestaña | **Adoptar el patrón** (N1) |
| KPIs con `count: 'exact', head: true` | C | ❌ (H-U7) | Directo | **Adoptar** (E3) |
| Pestañas `[clave, texto, Icono] as const` | C | ✅ | — | Mantener |

### 3.5 Asignación de recursos

| Módulo | Nivel | En SaludApp | Encaje y limitaciones | Decisión |
|---|---|---|---|---|
| `PanelAsignaciones` (bus → conductor) | C | ✅ adaptado (sede → médico) | Funciona y detecta rechazos silenciosos | Mantener |
| `asignar_bus` (varios `update` en una transacción, validación de rol, `get diagnostics`) | C | ❌ (la asignación es un `update` directo) | Patrón para `reprogramar_cita` y `generar_horarios` | **Adoptar el patrón** (E2, N2) |
| Índice único parcial `where … is not null` | C | ❌ | Equivalente: `unique (medico_id, inicio) where estado in ('disponible','pendiente','confirmada')`. Corrige H-R5 y permite conservar el historial (H-R1/H-R2) | **Adoptar** (E2) |

### 3.6 Automatización y procesos en segundo plano (§6)

| Idea del simulador | Nivel | Encaje en SaludApp | Decisión |
|---|---|---|---|
| Separar lógica pura del proceso que la ejecuta | C | Lógica en funciones SQL; ejecución con `pg_cron` | **Adoptar** (N3) |
| Recarga periódica de configuración desde la base | C | Las plantillas de disponibilidad (N2) se leen en cada ejecución | **Adoptar** (N3) |
| Reaccionar a decisiones de la app (reportes aprobados) | C | Novedad de ausencia aprobada → cancelar y avisar (E4) | **Adoptar** |
| Escrituras con `service_role` solo en el servidor | C | Funciones ejecutables solo por `postgres` | **Adoptar** |
| Azar determinista, reloj acelerable, teclas de control | D/C | Sin caso de uso salvo datos de demo | **No traer** |
| `crear-flota-simulacion.ts` (Auth Admin API idempotente) | C | Base del alta de médicos (N4), en una Edge Function protegida | **Adoptar el patrón** (N4) |

**Limitación:** un proceso Node como el simulador exige un servidor siempre
encendido, que SaludApp no tiene. `pg_cron` corre dentro de Postgres, está
disponible en este proyecto (comprobado en `pg_available_extensions`) y evita
infraestructura nueva. Alternativa equivalente: una Edge Function programada.

### 3.7 Errores y recuperación ante fallos

| Módulo | Nivel | En SaludApp | Decisión |
|---|---|---|---|
| `mensajesError.ts` (red, Auth, 23514, 42501, PGRST301, P0001) | A | ❌ | **Adoptar** (T3) |
| `AvisoError` con Reintentar | A | ❌ | **Adoptar** (T3) en las 3 páginas |
| `.select('id')` tras `update` para detectar rechazos silenciosos de RLS | Lección 1 | 🟡 solo en `asignarSede` | **Aplicar** a aprobar/rechazar novedad |
| `raise exception` en español (P0001) | §5.3 | ✅ las funciones ya lo hacen | Mantener |
| Doble toque (`guardando` por id) | Lección 11 | 🟡 parcial | Aplicar al tocar cada pantalla |
| Confirmar acciones destructivas | Lección 12 | ❌ | Aplicar en cancelar/rechazar (E2) |

### 3.8 Seguridad y control de acceso

| Patrón | En SaludApp | Decisión |
|---|---|---|
| `(select auth.uid())` en policies | 🟡 2 policies sin `select` (advisor) | **Corregir** (T2) |
| Revocar `execute` por rol (`from public, anon`) | ❌ (H-S4) | **Corregir** (T2) |
| Tabla secreta sin policies | ✅ `seguridad_usuario` | Mantener |
| Escritura solo desde servidor | ✅ `citas` (solo funciones y admin) | Mantener |
| `pruebas/permisos.sql` (asserts, `set local role`, terminar con `raise` para deshacer) | ❌ | **Adoptar** (T2): es la única forma barata de probar RLS sin herramientas nuevas |

### 3.9 Componentes de interfaz

Ya presentes y equivalentes: `CampoPassword`, `RequisitosPassword`, pestañas,
tarjetas de KPI, chips de estado con icono + texto. Por traer: `AvisoError`,
`ProblemaPerfil`, `VentanaAjustes` (con `Seccion`, `MensajeResultado`,
`BotonGuardar`), `graficos.tsx`, `MarcaNovedad`. **Recomendación de la propia
guía (§10)** que también aplica aquí: extraer un `CampoTexto` cuando se toquen
los formularios, no antes.

### 3.10 Pruebas automatizadas

| Elemento | Decisión |
|---|---|
| `vitest.config.ts` con `globals: true` | **Adoptar** (T4); clave en Windows |
| `tsconfig` con `types: ["vite/client", "google.maps", "vitest/globals"]` | **Adoptar** (T4) |
| `*.test.ts` de `validarPassword`, `validarEmail`, `fechas`, `estadisticas`, `paradaCercana` | **Copiar** con su módulo |
| Nuevas pruebas de `citas.ts` (cambio de día en Bogotá, `proximosDias`) | Escribir desde cero |
| Pruebas de componentes | La guía tampoco las tiene; **diferir** |

### 3.11 Mapas, geolocalización y simulación

| Módulo | Nivel | En SaludApp | Decisión |
|---|---|---|---|
| `Mapa`, `AjustarARuta`, `MarcadorParada`, `MarcadorMiUbicacion`, `useMiUbicacion`, `paradaCercana` (generalizado a `lugarMasCercano`) | B | ✅ | Ampliar su uso: "cómo llegar" y orden por cercanía (N7); elegir lat/lng al crear una sede (N4) |
| `MarcadorBus`, `RutaDibujada`, `RutaConSentidos`, `SeguirPunto`, `CentrarEn`, `MarcadorParadaRotulada` | D | ✅ copiados, **sin uso** | Eliminar (T5) o dejarlos; **no** construir funcionalidades sobre ellos |
| `proximosBuses.ts` (ETA por parada) | D | ❌ | **Solo la idea**: hora estimada de atención = inicio + minutos de retraso aprobados (E4) |
| Simulador, `ubicaciones`, `llegadas`, GPS en vivo | D | ➖ | **No traer**: no hay vehículos y rastrear la ubicación de médicos no aporta y plantea problemas de privacidad |

## 4. Advertencias sobre la propia guía

No se asume que un módulo es adecuado solo porque la guía lo marque como reutilizable:

1. **Recuperación por pregunta de seguridad.** La guía la clasifica A, pero
   advierte que solo sirve con correos ficticios. En una app de salud con
   pacientes reales es más débil que el correo (las respuestas son adivinables
   o se pueden investigar). Mantenerla solo para la demo y solo para pacientes.
2. **`useTablaEnVivo`.** La plantilla destilada no incluye el agrupado ni la
   caducidad que la guía atribuye a los hooks originales, y no compila tal cual
   con un cliente tipado (`from(tabla)` exige un nombre literal; la guía lo
   reconoce). No copiarla sin revisar.
3. **Requisitos de contraseña duplicados** (cliente + Edge Function). Es un
   riesgo de deriva: si se cambian, hay que cambiarlos en los dos sitios o,
   mejor, configurarlos también en Supabase Auth.
4. **`estadisticas_reportes` es `security invoker`.** Sus agregados respetan
   RLS: para el admin funcionan, pero si se reutiliza para un médico solo verá
   lo que su policy permite. Conviene decidirlo a propósito.
5. **El estilo** (colores escritos a mano en ~70 lugares) es deuda reconocida
   por la guía; SaludApp la hereda. Un `@theme` en Tailwind solo compensa si se
   van a tocar muchas pantallas.
6. **La guía no cubre** ciclos de vida con historial (cancelada ≠ borrada),
   reprogramación atómica, listas de espera ni notificaciones persistentes: son
   necesidades propias de citas que hay que diseñar desde cero (doc 03).

## 5. Mapa resumen: qué se puede llevar a SaludApp

| Tipo de reutilización | Piezas | Destino en doc 03 |
|---|---|---|
| **Copiar (A)** | `mensajesError`, `AvisoError`, `useAhora`, `fechas`, `vitest.config`, `*.test.ts`, `graficos.tsx`, `componentes.tsx` | T3, T4, N1, E4 |
| **Copiar y ajustar (B)** | `AuthContext`/`useAuth`, `ProblemaPerfil`, `VentanaAjustes`, `estadisticas.ts`, trigger de perfil, `usuarios` + grants | T3, E1, N1 |
| **Imitar el patrón (C)** | Bandeja de aprobación, opciones con dato estructurado, `useMisReportes`, `useNovedadesAprobadas`, `novedades.ts`, `estadisticas_reportes`, `asignar_bus`, índice único parcial, RLS por rol, `permisos.sql`, migraciones fechadas, estructura del simulador, siembra con Auth Admin API | T1, T2, E2, E3, E4, N1, N2, N3, N4 |
| **Solo como idea (D)** | `proximosBuses` (ETA) | E4 |
| **No traer** | Simulador, GPS, rutas/polilíneas, `useTablaEnVivo` completo (por ahora), `Cabecera` | — |
