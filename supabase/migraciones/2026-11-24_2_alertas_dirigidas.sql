-- Alertas dirigidas (parte 2 del plan de acción, propuesta E4).
-- 1. Cada rol lee solo las novedades que le corresponden. Antes cualquier
--    usuario con sesión leía todas (también pendientes y rechazadas) y todos
--    los pacientes recibían sus eventos en tiempo real.
-- 2. Ante una ausencia aprobada, el admin puede cancelar en bloque las citas
--    de ese médico ese día y cerrar su agenda de ese día.
-- Idempotente. Requiere 2026-11-24_1_novedades_estructuradas.sql.

-- 1. Lectura por rol -----------------------------------------------------------
--   admin:    todas.
--   médico:   las suyas.
--   paciente: aprobadas y sin archivar, de un médico con el que tiene una cita
--             activa justo el día afectado.
-- Realtime respeta esta policy: cada paciente solo recibe sus eventos.
drop policy if exists reportes_select on reportes;
create policy reportes_select on reportes for select to authenticated
  using (
    es_admin()
    or medico_id = (select auth.uid())
    or (
      estado = 'aprobado'
      and archivado = false
      and exists (
        select 1 from citas c
        where c.paciente_id = (select auth.uid())
          and c.medico_id = reportes.medico_id
          and c.estado in ('pendiente', 'confirmada')
          and (c.inicio at time zone 'America/Bogota')::date = reportes.fecha_afectada
      )
    )
  );

-- La subconsulta busca por paciente: este índice ya existe (citas_paciente_idx).

-- 2. Cancelar por ausencia (solo admin) ----------------------------------------
-- Cancela las citas pendientes o confirmadas de ese médico ese día (los
-- pacientes lo ven al instante y pueden reprogramar) y retira los horarios
-- libres de ese día para que nadie los tome. Devuelve cuántas citas de
-- pacientes canceló.
create or replace function public.cancelar_citas_por_ausencia(p_reporte uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_medico uuid; v_fecha date; v_citas int;
begin
  if not es_admin() then raise exception 'Solo un administrador puede cancelar citas por ausencia.'; end if;

  select medico_id, fecha_afectada into v_medico, v_fecha from reportes
  where id = p_reporte and tipo = 'ausencia' and estado = 'aprobado';
  if not found then raise exception 'Esa novedad no es una ausencia aprobada.'; end if;

  update citas set estado = 'cancelada', cancelada_por = 'sistema', motivo_cancelacion = 'Ausencia del médico',
    mensaje = 'El médico no podrá atender ese día. Reprograma tu cita.', actualizado_en = now()
  where medico_id = v_medico and estado in ('pendiente', 'confirmada') and inicio > now()
    and (inicio at time zone 'America/Bogota')::date = v_fecha;
  get diagnostics v_citas = row_count;

  -- Horarios libres de ese día: dejan de ofrecerse (quedan como cancelados por el sistema).
  update citas set estado = 'cancelada', cancelada_por = 'sistema', motivo_cancelacion = 'Ausencia del médico',
    actualizado_en = now()
  where medico_id = v_medico and estado = 'disponible' and inicio > now()
    and (inicio at time zone 'America/Bogota')::date = v_fecha;

  return v_citas;
end $$;

revoke execute on function public.cancelar_citas_por_ausencia(uuid) from public, anon;
grant execute on function public.cancelar_citas_por_ausencia(uuid) to authenticated;
