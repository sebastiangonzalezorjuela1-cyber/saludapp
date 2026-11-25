# Base de datos de SaludApp

Proyecto Supabase: `khyfckehcvpnswdjyshv` (provisional, separado de Buses Metro).

Ya está creada y con datos de prueba. Se creó con la migración
`saludapp_esquema` (dashboard → Database → Migrations). Tablas: usuarios,
sedes, especialidades, medicos, citas, reportes, seguridad_usuario. Las
acciones sobre citas pasan por las funciones `tomar_cita`, `cancelar_cita`,
`responder_cita` y `reprogramar_cita`.

## Migraciones posteriores (`migraciones/`)

Se ejecutan **en orden** en el SQL Editor del dashboard. Todas son idempotentes
(se pueden volver a ejecutar sin romper nada).

| Archivo | Qué hace |
|---|---|
| `2026-11-23_1_seguridad_minima.sql` | Novedades siempre nacen pendientes; funciones sin acceso anónimo; recuperación solo para pacientes; índices |
| `2026-11-23_2_perfil_por_trigger.sql` | El perfil del paciente lo crea un trigger al registrarse (el navegador ya no inserta en `usuarios`) |
| `2026-11-23_3_ciclo_de_cita.sql` | Historial de canceladas/rechazadas, reapertura de horarios, índice único, límites de reserva, `reprogramar_cita` |
| `2026-11-23_4_ajustes_de_cuenta.sql` | Cada usuario puede cambiar su nombre (y nada más de su fila) |
| `2026-11-24_1_novedades_estructuradas.sql` | Novedades con tipo, minutos de retraso, día afectado y motivo de rechazo |
| `2026-11-24_2_alertas_dirigidas.sql` | Cada rol lee solo sus novedades (el paciente, solo las del día de su cita); `cancelar_citas_por_ausencia` |
| `2026-11-24_3_cierre_de_cita.sql` | Estados `atendida` / `no_asistio` con `cerrar_cita`; `solicitada_en` y `respondida_en` para medir tiempos |
| `2026-11-24_4_corrige_minutos_retraso.sql` | Corrige la regla que dejaba pasar un retraso sin minutos (un CHECK acepta NULL) |
| `2026-11-24_5_estadisticas.sql` | `estadisticas_citas(p_desde)`: todo el panel de estadísticas del admin en un solo `jsonb` |

**El frontend actual necesita las cuatro**: sin la 2, los registros nuevos
quedan sin perfil; sin la 3, "Reprogramar" y la cancelación fallan.

## Datos de prueba para la demo (`semillas/`)

- `2026-11-25_citas_demo.sql`: crea 12 pacientes ficticios **sin contraseña**
  (`demo.pacienteNN@saludapp.test`) con ~48 citas pasadas y 1-3 futuras cada uno,
  para que el panel de estadísticas tenga datos. No toca a los pacientes de prueba
  reales ni inserta horarios: reutiliza los libres.
- `2026-11-25_citas_demo_deshacer.sql`: lo deja todo como estaba.

## Foto completa del esquema

- `schema.sql`: tablas, restricciones, índices, funciones y triggers.
- `policies.sql`: RLS, políticas, permisos de funciones y tablas, tiempo real.

Se generan con `herramientas/exportar-esquema.sql` (consulta de **solo lectura**
al catálogo; no hace falta Docker ni la CLI de Supabase). Recrean la base en un
proyecto Supabase vacío ejecutando `schema.sql` y luego `policies.sql`; los datos
de prueba no van incluidos.

## Procedimiento para cambiar la base

1. Migración nueva en `migraciones/AAAA-MM-DD_N_descripcion.sql`, idempotente.
2. Ejecutarla en el SQL Editor.
3. Probar con los tres roles (`npm run dev:all`).
4. Volver a exportar `schema.sql` y `policies.sql` con `herramientas/exportar-esquema.sql`.

`functions/recuperar-password` es la misma Edge Function de Buses Metro, ya
desplegada en este proyecto.
