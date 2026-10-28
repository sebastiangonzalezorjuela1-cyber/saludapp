# Base de datos de SaludApp

Proyecto Supabase: `khyfckehcvpnswdjyshv` (provisional, separado de Buses Metro).

Ya está creada y con datos de prueba; no hay que ejecutar nada. Se creó con la
migración `saludapp_esquema` (se puede ver en el dashboard → Database →
Migrations). Tablas: usuarios, sedes, especialidades, medicos, citas, reportes,
seguridad_usuario. Las acciones sobre citas pasan por las funciones
`tomar_cita`, `cancelar_cita` y `responder_cita`.

`functions/recuperar-password` es la misma Edge Function de Buses Metro, ya
desplegada en este proyecto.
