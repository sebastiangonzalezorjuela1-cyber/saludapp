import type { Rol } from '../types/domain'

const ROLES_VALIDOS: Rol[] = ['paciente', 'medico', 'admin']

const valorEnv = import.meta.env.VITE_ROL_INICIAL

export const rolInicial: Rol | null = ROLES_VALIDOS.includes(valorEnv as Rol) ? (valorEnv as Rol) : null
