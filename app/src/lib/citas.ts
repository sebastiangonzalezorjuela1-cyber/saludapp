import { Baby, Brain, CalendarClock, CircleCheck, CircleX, Clock, Ban, Stethoscope, type LucideIcon } from 'lucide-react'
import { createElement, type SVGProps } from 'react'
import type { EstadoCita } from '../types/domain'

// Todas las citas se muestran en hora de Colombia, aunque el navegador esté en
// otra zona: los horarios de las clínicas son locales.
const ZONA = 'America/Bogota'

export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function hora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(iso),
  )
}

// "2026-10-28": clave del día en hora de Colombia, para agrupar y filtrar.
export function claveDia(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  )
}

export function diaCorto(clave: string): { semana: string; numero: string; mes: string } {
  // Mediodía UTC: así el día no se corre al formatear en Colombia.
  const fecha = new Date(`${clave}T12:00:00Z`)
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, ...o }).format(fecha)
  return { semana: f({ weekday: 'short' }), numero: f({ day: 'numeric' }), mes: f({ month: 'short' }) }
}

export function proximosDias(cantidad: number): string[] {
  const dias: string[] = []
  const hoy = Date.now()
  for (let i = 0; i < cantidad; i++) dias.push(claveDia(new Date(hoy + i * 86_400_000)))
  return dias
}

// Misma idea que ESTADOS en el panel del agente: el color nunca va solo, cada
// estado lleva icono y etiqueta.
export const ESTADOS_CITA: Record<EstadoCita, { etiqueta: string; chip: string; Icono: LucideIcon }> = {
  disponible: { etiqueta: 'Disponible', chip: 'bg-sky-50 text-sky-800 ring-sky-200', Icono: CalendarClock },
  pendiente: { etiqueta: 'Pendiente', chip: 'bg-amber-50 text-amber-800 ring-amber-200', Icono: Clock },
  confirmada: { etiqueta: 'Confirmada', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icono: CircleCheck },
  rechazada: { etiqueta: 'Rechazada', chip: 'bg-red-50 text-red-800 ring-red-200', Icono: CircleX },
  cancelada: { etiqueta: 'Cancelada', chip: 'bg-slate-100 text-slate-600 ring-slate-200', Icono: Ban },
}

// Lucide no trae muela: se dibuja aquí con el mismo trazo de sus iconos.
function IconoMuela(props: SVGProps<SVGSVGElement>) {
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
    },
    createElement('path', {
      d: 'M7 3c-2.5 0-4 2-4 4.5 0 2 .7 3.3 1.3 4.6.6 1.4.7 3 .9 4.9.2 2 .8 4 2.3 4 1.4 0 1.8-1.8 2.1-3.6.3-1.6.6-2.9 2.4-2.9s2.1 1.3 2.4 2.9c.3 1.8.7 3.6 2.1 3.6 1.5 0 2.1-2 2.3-4 .2-1.9.3-3.5.9-4.9.6-1.3 1.3-2.6 1.3-4.6C21 5 19.5 3 17 3c-1.9 0-3 1-5 1S8.9 3 7 3z',
    }),
  )
}

type ComponenteIcono = LucideIcon | ((props: SVGProps<SVGSVGElement>) => ReturnType<typeof createElement>)

export const ICONOS_ESPECIALIDAD: Record<string, ComponenteIcono> = {
  stethoscope: Stethoscope,
  tooth: IconoMuela,
  baby: Baby,
  brain: Brain,
}

export function iconoDe(clave: string): ComponenteIcono {
  return ICONOS_ESPECIALIDAD[clave] ?? Stethoscope
}
