// Reciclado de Buses Metro: mismos tres roles, otro dominio.
//   usuario   -> paciente
//   conductor -> medico
//   agente    -> admin
export type Rol = 'paciente' | 'medico' | 'admin'

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
}

// Antes: Parada (punto en el mapa). Ahora: la clínica donde se atiende.
export interface Sede {
  id: string
  nombre: string
  ciudad: string
  direccion: string
  lat: number
  lng: number
}

export interface Especialidad {
  id: string
  nombre: string
  descripcion: string
  icono: string
}

// Antes: Bus (con su conductor). Ahora: el médico con su sede y especialidad.
export interface Medico {
  id: string
  especialidad_id: string
  sede_id: string | null
  consultorio: string
}

export type EstadoCita = 'disponible' | 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada'

export interface Cita {
  id: string
  medico_id: string
  inicio: string
  paciente_id: string | null
  estado: EstadoCita
  motivo: string | null
  mensaje: string | null
  actualizado_en: string
}

// Igual que en buses: novedad que reporta el médico y revisa el admin.
export type EstadoReporte = 'pendiente' | 'aprobado' | 'rechazado'

export interface Reporte {
  id: string
  medico_id: string
  motivo: string
  estado: EstadoReporte
  revisado_por: string | null
  revisado_en: string | null
  archivado: boolean
  creado_en: string
}
