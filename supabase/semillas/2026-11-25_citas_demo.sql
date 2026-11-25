-- Citas de prueba para el panel de estadísticas (demo del 25-nov-2026).
--
-- Crea 12 pacientes ficticios (demo.pacienteNN@saludapp.test, SIN contraseña:
-- nadie puede entrar con ellos) y les asigna:
--   · ~48 citas pasadas (últimos 28 días): atendidas, no asistió, rechazadas y
--     canceladas por paciente / médico / sistema, con tiempos de solicitud y respuesta;
--   · 1 a 3 citas futuras cada uno (próximos 14 días), confirmadas o pendientes,
--     respetando las reglas de la app (1 por especialidad, máximo 3, nunca a la misma hora).
-- No inserta citas: reutiliza horarios 'disponible' que ya existen. Los pacientes
-- reales de prueba (Dani, Juan, Valentina, Camilo) no se tocan.
--
-- Para deshacerlo todo: 2026-11-25_citas_demo_deshacer.sql
-- Se niega a ejecutarse dos veces seguidas (primero hay que deshacer).

do $semilla$
declare
  v_nombres text[] := array[
    'Andrea Torres', 'Santiago Gómez', 'Luisa Fernanda Ríos', 'Mateo Herrera', 'Paula Castaño', 'Julián Ospina',
    'Carolina Mejía', 'Sebastián Vargas', 'Natalia Zapata', 'Tomás Quintero', 'Manuela Cardona', 'Esteban Arango'];
  v_motivos text[] := array['Control general', 'Dolor de cabeza', 'Revisión de exámenes', 'Chequeo anual', 'Seguimiento', 'Dolor de espalda'];
  v_pacientes uuid[] := '{}';
  v_id uuid; v_p uuid; v_azar float; v_sol timestamptz; v_resp timestamptz; v_estado text;
  i int; r record; v_esp record; v_slot record;
begin
  perform setseed(0.25);

  -- 1. Pacientes ficticios. El trigger crear_perfil_al_registrarse les crea el
  --    perfil (rol paciente) con el nombre de la metadata.
  for i in 1 .. array_length(v_nombres, 1) loop
    select id into v_id from auth.users where email = format('demo.paciente%s@saludapp.test', lpad(i::text, 2, '0'));
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        format('demo.paciente%s@saludapp.test', lpad(i::text, 2, '0')), '', now(),
        '{"provider": "email", "providers": ["email"]}', jsonb_build_object('nombre', v_nombres[i]), now(), now(),
        '', '', '', '');
    end if;
    v_pacientes := v_pacientes || v_id;
  end loop;

  if exists (select 1 from citas where paciente_id = any (v_pacientes)) then
    raise exception 'Ya hay citas de demo. Ejecuta primero 2026-11-25_citas_demo_deshacer.sql.';
  end if;

  -- 2. Historial: horarios libres de los últimos 28 días, con más peso a las 9, 10 y 15 h.
  for r in
    select c.id, c.inicio from citas c
    where c.estado = 'disponible' and c.inicio between now() - interval '28 days' and now() - interval '1 hour'
    order by random() * case extract(hour from c.inicio at time zone 'America/Bogota')
      when 9 then 0.45 when 10 then 0.4 when 15 then 0.55 when 11 then 0.8 else 1 end
    limit 48
  loop
    v_p := v_pacientes[1 + floor(random() * array_length(v_pacientes, 1))::int];
    v_sol := r.inicio - make_interval(hours => 6 + floor(random() * 90)::int);
    -- Respuesta del médico: casi siempre en pocas horas, a veces casi un día.
    v_resp := v_sol + make_interval(mins => 10 + floor(random() ^ 2 * 1000)::int);
    v_azar := random();
    v_estado := case when v_azar < 0.58 then 'atendida' when v_azar < 0.70 then 'no_asistio'
                     when v_azar < 0.80 then 'rechazada' else 'cancelada' end;
    update citas set
      paciente_id = v_p,
      estado = v_estado,
      motivo = v_motivos[1 + floor(random() * array_length(v_motivos, 1))::int],
      solicitada_en = v_sol,
      respondida_en = v_resp,
      cancelada_por = case when v_estado <> 'cancelada' then null when v_azar < 0.90 then 'paciente' when v_azar < 0.96 then 'medico' else 'sistema' end,
      motivo_cancelacion = case when v_estado = 'cancelada' and v_azar >= 0.96 then 'Ausencia del médico' end,
      mensaje = case v_estado
        when 'atendida' then 'Cita atendida.'
        when 'no_asistio' then 'No asististe a esta cita.'
        when 'rechazada' then 'El médico no podrá atenderte en ese horario.'
        else case when v_azar < 0.90 then 'Cancelaste esta cita.' when v_azar < 0.96 then 'El médico canceló esta cita.'
                  else 'El médico no podrá atender ese día. Reprograma tu cita.' end end,
      actualizado_en = least(now(), r.inicio + interval '1 hour')
    where id = r.id;
  end loop;

  -- 3. Próximos 14 días: 1 a 3 especialidades por paciente (más medicina general y pediatría).
  foreach v_p in array v_pacientes loop
    for v_esp in
      select e.id from especialidades e
      order by random() * case e.nombre when 'Medicina general' then 0.35 when 'Pediatría' then 0.6 when 'Odontología' then 0.8 else 1 end
      limit 1 + floor(random() * 3)::int
    loop
      select c.id, c.inicio into v_slot
      from citas c join medicos m on m.id = c.medico_id
      where m.especialidad_id = v_esp.id and c.estado = 'disponible'
        and c.inicio > now() + interval '3 hours' and c.inicio <= now() + interval '14 days'
        and not exists (select 1 from citas o where o.paciente_id = v_p and o.estado in ('pendiente', 'confirmada') and o.inicio = c.inicio)
      order by random() * case extract(hour from c.inicio at time zone 'America/Bogota')
        when 9 then 0.45 when 10 then 0.4 when 15 then 0.55 when 11 then 0.8 else 1 end
      limit 1;
      continue when v_slot.id is null;

      v_sol := now() - make_interval(hours => 1 + floor(random() * 72)::int);
      v_estado := case when random() < 0.75 then 'confirmada' else 'pendiente' end;
      update citas set
        paciente_id = v_p,
        estado = v_estado,
        motivo = v_motivos[1 + floor(random() * array_length(v_motivos, 1))::int],
        solicitada_en = v_sol,
        respondida_en = case when v_estado = 'confirmada' then least(now(), v_sol + make_interval(mins => 10 + floor(random() ^ 2 * 600)::int)) end,
        mensaje = case when v_estado = 'confirmada' then 'Te recomendamos llegar 15 minutos antes de tu cita.'
                       else 'Tu cita está en revisión por el médico.' end,
        actualizado_en = now()
      where id = v_slot.id;
      v_slot := null;
    end loop;
  end loop;
end $semilla$;

-- Resumen de lo creado
select c.estado, coalesce(c.cancelada_por, '') as cancelada_por, count(*) as citas
from citas c join auth.users u on u.id = c.paciente_id
where u.email like 'demo.paciente%@saludapp.test'
group by 1, 2 order by 1, 2;
