-- Cierre de la cita y tiempos (parte 3 del plan de acción, resto de E2).
-- 1. Estados nuevos: 'atendida' y 'no_asistio'. Antes una cita confirmada se
--    quedaba "confirmada" para siempre aunque ya hubiera pasado.
-- 2. solicitada_en / respondida_en: actualizado_en se sobrescribe en cada
--    cambio y no sirve para medir cuánto tarda un médico en responder. Son la
--    base del panel de estadísticas (parte 4).
-- Idempotente. Requiere 2026-11-23_3_ciclo_de_cita.sql.

-- 1. Estados -------------------------------------------------------------------
alter table citas drop constraint if exists citas_estado_check;
alter table citas add constraint citas_estado_check check (
  estado in ('disponible', 'pendiente', 'confirmada', 'rechazada', 'cancelada', 'atendida', 'no_asistio')
);

-- 2. Tiempos -------------------------------------------------------------------
alter table citas add column if not exists solicitada_en timestamptz;
alter table citas add column if not exists respondida_en timestamptz;
-- Las citas anteriores a esta migración quedan sin tiempos (null): las
-- estadísticas las ignoran en vez de inventar un dato.

-- 3. Tomar cita: guarda cuándo se solicitó --------------------------------------
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

  select c.inicio, m.especialidad_id into v_inicio, v_especialidad
  from citas c join medicos m on m.id = c.medico_id
  where c.id = p_cita and c.estado = 'disponible' and c.inicio > now()
  for update of c;
  if not found then raise exception 'Esa cita ya no está disponible.'; end if;

  perform validar_reserva((select auth.uid()), v_inicio, v_especialidad);

  update citas set paciente_id = (select auth.uid()), estado = 'pendiente',
    motivo = nullif(btrim(p_motivo), ''), mensaje = 'Tu cita está en revisión por el médico.',
    cancelada_por = null, motivo_cancelacion = null,
    solicitada_en = now(), respondida_en = null, actualizado_en = now()
  where id = p_cita;
end $$;

-- 4. Reprogramar: la cita nueva también guarda cuándo se solicitó ---------------
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
    mensaje = 'Tu cita está en revisión por el médico.',
    solicitada_en = now(), respondida_en = null, actualizado_en = now()
  where id = p_nueva;
end $$;

-- 5. Responder: guarda cuándo respondió el médico -------------------------------
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
      mensaje = coalesce(v_mensaje, 'Te recomendamos llegar 15 minutos antes de tu cita.'),
      respondida_en = now(), actualizado_en = now()
    where id = p_cita;
  elsif p_estado = 'rechazada' then
    if v_estado <> 'pendiente' then raise exception 'Solo se pueden rechazar solicitudes pendientes.'; end if;
    update citas set estado = 'rechazada',
      mensaje = coalesce(v_mensaje, 'El médico no podrá atenderte en ese horario.'),
      respondida_en = now(), actualizado_en = now()
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

-- 6. Cerrar la cita (solo el médico, solo cuando ya empezó) ---------------------
create or replace function public.cerrar_cita(p_cita uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_inicio timestamptz;
begin
  if p_resultado not in ('atendida', 'no_asistio') then raise exception 'Resultado no válido.'; end if;

  select inicio into v_inicio from citas
  where id = p_cita and medico_id = (select auth.uid()) and estado = 'confirmada'
  for update;
  if not found then raise exception 'Solo puedes cerrar tus citas confirmadas.'; end if;
  if v_inicio > now() then raise exception 'La cita todavía no ha empezado.'; end if;

  update citas set estado = p_resultado,
    mensaje = case when p_resultado = 'atendida' then 'Cita atendida.' else 'No asististe a esta cita.' end,
    actualizado_en = now()
  where id = p_cita;
end $$;

-- 7. Permisos -------------------------------------------------------------------
revoke execute on function public.tomar_cita(uuid, text) from public, anon;
revoke execute on function public.reprogramar_cita(uuid, uuid, text) from public, anon;
revoke execute on function public.responder_cita(uuid, text, text) from public, anon;
revoke execute on function public.cerrar_cita(uuid, text) from public, anon;
grant execute on function public.tomar_cita(uuid, text) to authenticated;
grant execute on function public.reprogramar_cita(uuid, uuid, text) to authenticated;
grant execute on function public.responder_cita(uuid, text, text) to authenticated;
grant execute on function public.cerrar_cita(uuid, text) to authenticated;
