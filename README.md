# SaludApp (provisional)

Ejercicio de clase: **reciclar el código de Buses Metro** para una idea totalmente distinta, una app de **citas médicas**.
Es una versión rápida y provisional. Tiene su **propia base de datos de Supabase** (`khyfckehcvpnswdjyshv`), que no tiene nada que ver con la de Buses Metro.

## Cómo arrancarla

Requisitos: Node.js 22 o superior.

```
cd app
npm install
npm run dev          # http://localhost:5173
```

Para abrir los tres roles a la vez, cada uno en su puerto:

```
npm run dev:all      # paciente:5173, médico:5174, admin:5175
```

`app/.env.local` ya viene con la URL y la clave pública del Supabase de SaludApp y con la clave de Google Maps.

## Usuarios de prueba

Contraseña para todos: `123456` (cuentas de demo, anteriores a los requisitos de contraseña; cámbiala desde ⚙️ Ajustes si quieres probarlos).
Solo los **pacientes** pueden recuperar la contraseña con su pregunta de seguridad. Los pacientes de prueba tienen «¿En qué ciudad naciste?» → `medellin`. Médicos y admin ya no tienen pregunta: su contraseña se restablece desde el dashboard de Supabase.

| Rol | Correo | Nombre |
|---|---|---|
| Paciente | paciente@test.com | Dani (ya tiene citas: una confirmada, una pendiente y una rechazada) |
| Paciente | paciente2@test.com, paciente3@test.com, paciente4@test.com | Juan Pérez, Valentina López, Camilo Ruiz |
| Médico | medico@test.com | Dra. Laura Gómez · Medicina general · Clínica Central (tiene solicitudes pendientes) |
| Médico | medico2@test.com / medico3@test.com | Dr. Andrés Restrepo (Bello) / Dra. Sofía Rincón (Bogotá) |
| Médico | odontologo@test.com / odontologo2@test.com | Dr. Carlos Méndez / Dr. Felipe Arango |
| Médico | pediatra@test.com / psicologo@test.com | Dra. Mariana López / Dr. Alejandro Ruiz |
| Admin | admin@test.com | Administrador |

Hay cuatro sedes: Clínica Central (Medellín), Clínica Norte (Bello), Clínica Sur (Envigado) y Clínica Capital (Bogotá). Cada médico tiene horarios de lunes a sábado durante 14 días.

## Flujo para la demo

`npm run dev:all` y tres ventanas: paciente `http://localhost:5173`, médico `:5174`, admin `:5175`
(cada puerto guarda su propia sesión). El mapa solo funciona desde esos tres puertos.

**Preparación (antes de presentar):**
- Admin → *Médicos y sedes* → **Generar horarios** si a algún médico le queda poca agenda.
- Ya cargados: datos de prueba para las estadísticas ([supabase/semillas/](supabase/semillas/)); se deshacen con `2026-11-25_citas_demo_deshacer.sql`.

**Guion (unos 10 minutos):**

1. **Paciente** (`paciente2@test.com`, Juan): busca *Medicina general* y pide una cita con la **Dra. Laura Gómez para hoy o mañana**. Queda *Pendiente*.
   Reglas: máximo **1 cita activa por especialidad** y **3 en total**, nunca dos a la misma hora.
2. **Médico** (`medico@test.com`): la solicitud entra en vivo. La **acepta** con un mensaje; el paciente lo ve sin recargar. (Si la rechazara, el horario volvería a quedar libre.)
3. **Médico:** arriba aparecen las citas **Por cerrar** (confirmadas cuya hora ya pasó): marca una como **Atendida** o **No asistió**.
4. **Médico:** **Reportar novedad** → *15 min* → día de la cita de Juan.
5. **Admin** (`admin@test.com`): la novedad entra en la bandeja con su tipo y su día. La **aprueba** (o la rechaza escribiendo el motivo, que el médico ve al instante).
6. **Paciente:** le sale el aviso 🚨 con la **hora estimada** («podría empezar hacia las 10:15») y la cita queda marcada. Un paciente con cita otro día no ve nada.
7. **Paciente:** *Ver detalles* de la cita → mapa de la sede, **Cómo llegar**, **Reprogramar** (todo o nada) o **Cancelar** (hasta 2 h antes). El botón «atrás» del navegador funciona entre pantallas.
8. **Admin:** pestaña **Estadísticas** → tasa de confirmación, respuesta media del médico, inasistencia, ocupación por especialidad y sede, demanda por hora. Cada gráfico tiene «Ver como tabla».
9. **Extra si hay tiempo:**
   - Médico reporta **No disponible** → admin la aprueba y pulsa **Cancelar citas de ese día** → los pacientes ven su cita cancelada.
   - Cualquier rol: ⚙️ **Ajustes** (nombre, contraseña y, en pacientes, pregunta de seguridad).
   - Admin → *Médicos y sedes*: cambiar la sede de un médico o generar horarios.

## Pruebas

```
cd app
npm test          # pruebas de la lógica de src/lib (Vitest)
npm run lint      # oxlint
npx tsc -b        # tipos
```

La base de datos está versionada en [supabase/](supabase/): migraciones, foto
completa del esquema (`schema.sql`, `policies.sql`) y cómo regenerarla.

## Auditoría y planes

La auditoría del proyecto, el análisis de reutilización de Buses Metro y los planes de acción están en [docs/auditoria/](docs/auditoria/).

## Qué se recicló de Buses Metro

| Buses Metro | SaludApp | Cómo |
|---|---|---|
| Roles pasajero / conductor / agente | paciente / médico / admin | Mismo `AuthContext`, `RutaProtegida`, rutas y login |
| Login, registro, contraseña segura, recuperación por pregunta de seguridad | Igual | Archivos copiados sin cambios, más la misma Edge Function y las mismas funciones SQL |
| Conductor reporta retraso → agente aprueba → pasajero recibe alerta | Médico reporta novedad → admin aprueba → paciente recibe alerta | Misma tabla `reportes`, mismo panel de opciones rápidas, misma bandeja y misma suscripción en tiempo real |
| Panel del agente (métricas, bandeja, filtros, archivar) | Panel del admin | Mismo componente, adaptado |
| Asignar bus a conductor | Asignar sede a médico | Mismo patrón de `select` por fila |
| Mapa de Google + "Tu parada más cercana" + "Tú estás aquí" | Mapa de clínicas + "Tu clínica más cercana" | `Mapa.tsx`, `mapaConfig.ts` y `useMiUbicacion` sin cambios; `paradaCercana.ts` generalizado |
| Diseño (cabecera teal, tuerca, plantas, tarjetas) | Igual | Sacado a `lib/Plantilla.tsx` para compartirlo |
| Simulador, ubicaciones y llegadas | — | No aplica |

**Lo nuevo:** la tabla `citas` con sus funciones `tomar_cita`, `cancelar_cita` y `responder_cita`, el calendario para agendar, "Mis citas" y la pantalla del médico para aceptar o rechazar.
