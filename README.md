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

Contraseña para todos: `123456`.
Pregunta de seguridad para recuperar la contraseña: «¿En qué ciudad naciste?» → `medellin`.

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

1. **Paciente:** elige una especialidad, filtra por ciudad o sede, elige un día y una hora y solicita la cita. Queda *Pendiente*.
2. **Médico:** la ve aparecer en vivo y la **acepta** o la **rechaza**, con un mensaje opcional. El paciente ve el cambio sin recargar.
3. **Médico:** usa **Reportar retraso / novedad** (10 min, 15 min, no disponible hoy u otra).
4. **Admin:** recibe la novedad en su bandeja y la **aprueba**. En ese momento les sale la alerta 🚨 a los pacientes que tienen cita con ese médico.
5. **Admin:** en *Médicos y sedes* cambia la sede de un médico o le **genera horarios** nuevos.

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
