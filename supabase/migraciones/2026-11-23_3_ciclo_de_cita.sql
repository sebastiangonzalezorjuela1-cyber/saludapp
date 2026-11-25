-- Ciclo de vida de la cita (plan exprés, bloque 3).
-- Corrige H-R1 (rechazar inutilizaba el horario), H-R2 (cancelar borraba el
-- historial), H-R3 (sin límites de reserva), H-R4 (reagendar no reagendaba) y
-- H-R5 (horarios duplicados posibles).
--
-- Idea central: una cita cancelada o rechazada CONSERVA su fila (historial) y,
-- si el horario sigue en el futuro, se crea una fila nueva 'disponible' para el
-- mismo médico y hora. El índice único parcial impide dos filas activas iguales.
--
-- Reglas acordadas (docs/auditoria/04-planes-de-accion.md):
--   · máximo 1 cita activa por especialidad y 3 en total por paciente;
--   · sin dos citas a la misma hora;
--   · cancelar o reprogramar solo hasta 2 horas antes.
-- Idempotente.

-- 1. Columnas nuevas ----------------------------------------------------------
alter table citas add column if not exists cancelada_por text;
alter table citas add column if not exists motivo_cancelacion text;
alter table citas drop constraint if exists citas_cancelada_por_valida;
alter table citas add constraint citas_cancelada_por_valida
  check (cancelada_por is null or cancelada_por in ('paciente', 'medico', 'sistema'));
alter table citas drop constraint if exists citas_motivo_cancelacion_largo;
alter table citas add constraint citas_motivo_cancelacion_largo
  check (motivo_cancelacion is null or char_length(motivo_cancelacion) <= 300);

-- 2. Un solo horario activo por médico y hora ------------------------------
create unique index if not exists citas_horario_activo_unico
  on citas (medico_id, inicio)
  where estado in ('disponible', 'pendiente', 'confirmada');

-- 3. Reabrir un horario (uso interno, no expuesta a la API) -----------------
create or replace function public.reabrir_horario(p_medico uuid, p_inicio timestamptz)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into citas (medico_id, inicio)
  select p_medico, p_inicio
  where p_inicio > now()
  on conflict (medico_id, inicio) where estado in ('disponible', 'pendiente', 'confirmada') do nothing;
$$;
revoke execute on function public.reabrir_horario(uuid, timestamptz) from public, anon, authenticated;

-- Los horarios rechazados en el pasado reciente que todavía son futuros se reabren.
insert into citas (medico_id, inicio)
select distinct c.medico_id, c.inicio
from citas c
where c.estado in ('rechazada', 'cancelada') and c.inicio > now()
  and not exists (
    select 1 from citas d
    where d.medico_id = c.medico_id and d.inicio = c.inicio
      and d.estado in ('disponible', 'pendiente', 'confirmada')
  );

-- 4. Reglas de reserva (uso interno) ----------------------------------------
-- p_excluir: la cita que se está reprogramando, que no debe contar.
create or replace function public.validar_reserva(
  p_paciente uuid, p_inicio timestamptz, p_especialidad uuid, p_excluir uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_activas int;
begin
  if exists (
    select 1 from citas
    where paciente_id = p_paciente and estado in ('pendiente', 'confirmada')
      and inicio = p_inicio and id is distinct from p_excluir
  ) then
    raise exception 'Ya tienes otra cita a esa misma hora.';
  end if;

  if exists (
    select 1 from citas c join medicos m on m.id = c.medico_id
    where c.paciente_id = p_paciente and c.estado in ('pendiente', 'confirmada')
      and c.inicio > now() and m.especialidad_id = p_especialidad
      and c.id is distinct from p_excluir
  ) then
    raise exception 'Ya tienes una cita activa de esta especialidad. Cancélala o reprográmala para pedir otra.';
  end if;

  select count(*) into v_activas from citas
  where paciente_id = p_paciente and estado in ('pendiente', 'confirmada')
    and inicio > now() and id is distinct from p_excluir;
  if v_activas >= 3 then
    raise exception 'Puedes tener como máximo 3 citas activas a la vez.';
  end if;
end $$;
revoke execute on function public.validar_reserva(uuid, timestamptz, uuid, uuid) from public, anon, authenticated;

-- 5. Tomar cita (paciente): ahora con reglas de reserva ----------------------
create or replace function public.tomar_cita(p_cita uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_inicio timestamptz; v_especialidad uuid;
begin
  if not exists (select 1 from usuarios where id = (select auth.uid()) and rol = 'paciente') then
    raise exception 'Solo un paciente puede tomar citas.';
  end if;

  -- for update: si dos pacientes piden el mismo horario, el segundo espera y
  -- después ya no lo encuentra disponible.
  select c.inicio, m.especialidad_id into v_inicio, v_especialidad
  from citas c join medicos m on m.id = c.medico_id
  where c.id = p_cita and c.estado = 'disponible' and c.inicio > now()
  for update of c;
  if not found then raise exception 'Esa cita ya no está disponible.'; end if;

  perform validar_reserva((select auth.uid()), v_inicio, v_especialidad);

  update citas set paciente_id = (select auth.uid()), estado = 'pendiente',
    motivo = nullif(btrim(p_motivo), ''), mensaje = 'Tu cita está en revisión por el médico.',
    cancelada_por = null, motivo_cancelacion = null, actualizado_en = now()
  where id = p_cita;
end $$;

-- 6. Cancelar (paciente): conserva el historial y libera el horario ----------
-- Cambia de firma (añade p_motivo): se borra la versión vieja para que la API
-- no tenga dos funciones con el mismo nombre.
drop function if exists public.cancelar_cita(uuid);
create or replace function public.cancelar_cita(p_cita uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_medico uuid; v_inicio timestamptz;
begin
  select medico_id, inicio into v_medico, v_inicio from citas
  where id = p_cita and paciente_id = (select auth.uid()) and estado in ('pendiente', 'confirmada')
  for update;
  if not found then raise exception 'No se pudo cancelar la cita.'; end if;
  if v_inicio <= now() + interval '2 hours' then
    raise exception 'Solo puedes cancelar hasta 2 horas antes de la cita.';
  end if;

  update citas set estado = 'cancelada', cancelada_por = 'paciente',
    motivo_cancelacion = nullif(btrim(p_motivo), ''), mensaje = 'Cancelaste esta cita.', actualizado_en = now()
  where id = p_cita;

  perform reabrir_horario(v_medico, v_inicio);
end $$;

-- 7. Responder (médico): aceptar, rechazar o cancelar -------------------------
--   confirmada: solo desde pendiente.
--   rechazada:  solo desde pendiente; el horario vuelve a ofrecerse.
--   cancelada:  solo desde confirmada; el horario NO se reabre (el médico no
--               puede atender a esa hora).
create or replace function public.responder_cita(p_cita uuid, p_estado text, p_mensaje text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_estado text; v_inicio timestamptz; v_mensaje text := nullif(btrim(p_mensaje), '');
begin
  select estado, inicio into v_estado, v_inicio from citas
  where id = p_cita and medico_id = (select auth.uid())
  for update;
  if not found then raise exception 'No se pudo actualizar la cita.'; end if;

  if p_estado = 'confirmada' then
    if v_estado <> 'pendiente' then raise exception 'Solo se pueden aceptar solicitudes pendientes.'; end if;
    update citas set estado = 'confirmada',
      mensaje = coalesce(v_mensaje, 'Te recomendamos llegar 15 minutos antes de tu cita.'), actualizado_en = now()
    where id = p_cita;
  elsif p_estado = 'rechazada' then
    if v_estado <> 'pendiente' then raise exception 'Solo se pueden rechazar solicitudes pendientes.'; end if;
    update citas set estado = 'rechazada',
      mensaje = coalesce(v_mensaje, 'El médico no podrá atenderte en ese horario.'), actualizado_en = now()
    where id = p_cita;
    perform reabrir_horario((select auth.uid()), v_inicio);
  elsif p_estado = 'cancelada' then
    if v_estado <> 'confirmada' then raise exception 'Solo se pueden cancelar citas confirmadas.'; end if;
    update citas set estado = 'cancelada', cancelada_por = 'medico',
      mensaje = coalesce(v_mensaje, 'El médico canceló esta cita.'), actualizado_en = now()
    where id = p_cita;
  else
    raise exception 'Estado no válido.';
  end if;
end $$;

-- 8. Reprogramar (paciente): todo o nada ------------------------------------
create or replace function public.reprogramar_cita(p_actual uuid, p_nueva uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_medico_act uuid; v_inicio_act timestamptz; v_motivo_act text;
  v_inicio_nuevo timestamptz; v_especialidad uuid;
begin
  if not exists (select 1 from usuarios where id = v_uid and rol = 'paciente') then
    raise exception 'Solo un paciente puede reprogramar citas.';
  end if;

  select medico_id, inicio, motivo into v_medico_act, v_inicio_act, v_motivo_act from citas
  where id = p_actual and paciente_id = v_uid and estado in ('pendiente', 'confirmada')
  for update;
  if not found then raise exception 'No se encontró la cita que quieres reprogramar.'; end if;
  if v_inicio_act <= now() + interval '2 hours' then
    raise exception 'Solo puedes reprogramar hasta 2 horas antes de la cita.';
  end if;

  select c.inicio, m.especialidad_id into v_inicio_nuevo, v_especialidad
  from citas c join medicos m on m.id = c.medico_id
  where c.id = p_nueva and c.estado = 'disponible' and c.inicio > now()
  for update of c;
  if not found then raise exception 'El nuevo horario ya no está disponible.'; end if;

  perform validar_reserva(v_uid, v_inicio_nuevo, v_especialidad, p_actual);

  update citas set estado = 'cancelada', cancelada_por = 'paciente', motivo_cancelacion = 'Reprogramada',
    mensaje = 'Reprogramaste esta cita.', actualizado_en = now()
  where id = p_actual;
  perform reabrir_horario(v_medico_act, v_inicio_act);

  update citas set paciente_id = v_uid, estado = 'pendiente',
    motivo = coalesce(nullif(btrim(p_motivo), ''), v_motivo_act),
    mensaje = 'Tu cita está en revisión por el médico.', actualizado_en = now()
  where id = p_nueva;
end $$;

-- 9. Permisos: solo usuarios con sesión ------------------------------------
revoke execute on function public.tomar_cita(uuid, text) from public, anon;
revoke execute on function public.cancelar_cita(uuid, text) from public, anon;
revoke execute on function public.responder_cita(uuid, text, text) from public, anon;
revoke execute on function public.reprogramar_cita(uuid, uuid, text) from public, anon;
grant execute on function public.tomar_cita(uuid, text) to authenticated;
grant execute on function public.cancelar_cita(uuid, text) to authenticated;
grant execute on function public.responder_cita(uuid, text, text) to authenticated;
grant execute on function public.reprogramar_cita(uuid, uuid, text) to authenticated;
