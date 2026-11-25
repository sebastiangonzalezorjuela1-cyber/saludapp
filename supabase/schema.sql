-- ============================================================================
-- SaludApp · FOTO del esquema público (tablas, restricciones, índices,
-- funciones y triggers). La seguridad (RLS, políticas, permisos y tiempo real)
-- está en policies.sql.
--
-- Generado el 25-nov-2026 desde el proyecto khyfckehcvpnswdjyshv con
-- supabase/herramientas/exportar-esquema.sql (consulta de solo lectura al
-- catálogo). No se edita a mano: tras cada migración se vuelve a exportar.
--
-- Para recrear la base en un proyecto Supabase vacío:
--   1. schema.sql   2. policies.sql   3. datos de prueba (no incluidos).
-- Requiere un proyecto Supabase (usa el esquema auth y los roles anon /
-- authenticated) y estas extensiones:
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- 1. Tablas

create table if not exists public.citas (
  id uuid default gen_random_uuid() not null,
  medico_id uuid not null,
  inicio timestamp with time zone not null,
  paciente_id uuid,
  estado text default 'disponible'::text not null,
  motivo text,
  mensaje text,
  actualizado_en timestamp with time zone default now() not null,
  cancelada_por text,
  motivo_cancelacion text,
  solicitada_en timestamp with time zone,
  respondida_en timestamp with time zone
);

create table if not exists public.especialidades (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  descripcion text not null,
  icono text default 'stethoscope'::text not null
);

create table if not exists public.medicos (
  id uuid not null,
  especialidad_id uuid not null,
  sede_id uuid,
  consultorio text default 'Por asignar'::text not null
);

create table if not exists public.reportes (
  id uuid default gen_random_uuid() not null,
  medico_id uuid not null,
  motivo text not null,
  estado text default 'pendiente'::text not null,
  revisado_por uuid,
  revisado_en timestamp with time zone,
  archivado boolean default false not null,
  creado_en timestamp with time zone default now() not null,
  tipo text default 'otro'::text not null,
  minutos_retraso integer,
  fecha_afectada date default ((now() AT TIME ZONE 'America/Bogota'::text))::date not null,
  comentario_admin text,
  origen text default 'medico'::text not null
);

create table if not exists public.sedes (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  ciudad text not null,
  direccion text not null,
  lat double precision not null,
  lng double precision not null
);

create table if not exists public.seguridad_usuario (
  usuario_id uuid not null,
  pregunta text not null,
  respuesta_hash text not null,
  intentos_fallidos integer default 0 not null,
  bloqueado_hasta timestamp with time zone,
  actualizado_en timestamp with time zone default now() not null
);

create table if not exists public.usuarios (
  id uuid not null,
  nombre text not null,
  rol text not null
);

-- 2. Restricciones (claves, checks y foráneas)

alter table public.citas add constraint citas_pkey PRIMARY KEY (id);
alter table public.especialidades add constraint especialidades_pkey PRIMARY KEY (id);
alter table public.medicos add constraint medicos_pkey PRIMARY KEY (id);
alter table public.reportes add constraint reportes_pkey PRIMARY KEY (id);
alter table public.sedes add constraint sedes_pkey PRIMARY KEY (id);
alter table public.seguridad_usuario add constraint seguridad_usuario_pkey PRIMARY KEY (usuario_id);
alter table public.usuarios add constraint usuarios_pkey PRIMARY KEY (id);
alter table public.especialidades add constraint especialidades_nombre_key UNIQUE (nombre);
alter table public.citas add constraint citas_cancelada_por_valida CHECK (((cancelada_por IS NULL) OR (cancelada_por = ANY (ARRAY['paciente'::text, 'medico'::text, 'sistema'::text]))));
alter table public.citas add constraint citas_estado_check CHECK ((estado = ANY (ARRAY['disponible'::text, 'pendiente'::text, 'confirmada'::text, 'rechazada'::text, 'cancelada'::text, 'atendida'::text, 'no_asistio'::text])));
alter table public.citas add constraint citas_motivo_cancelacion_largo CHECK (((motivo_cancelacion IS NULL) OR (char_length(motivo_cancelacion) <= 300)));
alter table public.reportes add constraint reportes_comentario_valido CHECK (((comentario_admin IS NULL) OR (((char_length(comentario_admin) >= 1) AND (char_length(comentario_admin) <= 300)) AND (comentario_admin = btrim(comentario_admin)))));
alter table public.reportes add constraint reportes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'rechazado'::text])));
alter table public.reportes add constraint reportes_minutos_validos CHECK (
CASE
    WHEN (tipo = 'retraso'::text) THEN COALESCE(((minutos_retraso >= 1) AND (minutos_retraso <= 240)), false)
    ELSE (minutos_retraso IS NULL)
END);
alter table public.reportes add constraint reportes_origen_valido CHECK ((origen = ANY (ARRAY['medico'::text, 'sistema'::text])));
alter table public.reportes add constraint reportes_tipo_valido CHECK ((tipo = ANY (ARRAY['retraso'::text, 'ausencia'::text, 'otro'::text])));
alter table public.usuarios add constraint usuarios_nombre_valido CHECK ((((char_length(nombre) >= 1) AND (char_length(nombre) <= 80)) AND (nombre = btrim(nombre))));
alter table public.usuarios add constraint usuarios_rol_check CHECK ((rol = ANY (ARRAY['paciente'::text, 'medico'::text, 'admin'::text])));
alter table public.citas add constraint citas_medico_id_fkey FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE;
alter table public.citas add constraint citas_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES usuarios(id);
alter table public.medicos add constraint medicos_especialidad_id_fkey FOREIGN KEY (especialidad_id) REFERENCES especialidades(id);
alter table public.medicos add constraint medicos_id_fkey FOREIGN KEY (id) REFERENCES usuarios(id) ON DELETE CASCADE;
alter table public.medicos add constraint medicos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES sedes(id);
alter table public.reportes add constraint reportes_medico_id_fkey FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE;
alter table public.reportes add constraint reportes_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES usuarios(id);
alter table public.seguridad_usuario add constraint seguridad_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.usuarios add constraint usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Índices

CREATE UNIQUE INDEX citas_horario_activo_unico ON public.citas USING btree (medico_id, inicio) WHERE (estado = ANY (ARRAY['disponible'::text, 'pendiente'::text, 'confirmada'::text]));
CREATE INDEX citas_medico_inicio_idx ON public.citas USING btree (medico_id, inicio);
CREATE INDEX citas_paciente_idx ON public.citas USING btree (paciente_id);
CREATE INDEX medicos_especialidad_idx ON public.medicos USING btree (especialidad_id);
CREATE INDEX medicos_sede_idx ON public.medicos USING btree (sede_id);
CREATE INDEX reportes_archivado_creado_en_idx ON public.reportes USING btree (archivado, creado_en DESC);
CREATE INDEX reportes_medico_fecha_idx ON public.reportes USING btree (medico_id, fecha_afectada);
CREATE INDEX reportes_medico_idx ON public.reportes USING btree (medico_id);
CREATE INDEX reportes_revisado_por_idx ON public.reportes USING btree (revisado_por);

-- 4. Funciones

CREATE OR REPLACE FUNCTION public.archivar_reportes_resueltos(p_dias integer DEFAULT 1)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_filas int;
begin
  if not es_admin() then raise exception 'Solo un administrador puede archivar reportes'; end if;
  if p_dias < 0 then raise exception 'El número de días no puede ser negativo'; end if;
  update reportes set archivado = true
    where archivado = false and estado <> 'pendiente'
      and coalesce(revisado_en, creado_en) < now() - make_interval(days => p_dias);
  get diagnostics v_filas = row_count;
  return v_filas;
end $function$;

CREATE OR REPLACE FUNCTION public.cancelar_cita(p_cita uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.cancelar_citas_por_ausencia(p_reporte uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.cerrar_cita(p_cita uuid, p_resultado text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.crear_perfil_al_registrarse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Todo alta pública es de paciente. Médicos y admin se crean a mano y luego
  -- se les cambia el rol (el upsert de un script con service_role lo pisa).
  insert into public.usuarios (id, nombre, rol)
  values (
    new.id,
    btrim(left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1), 'Paciente'), 80)),
    'paciente'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Este trigger NUNCA debe fallar: si lanza un error, Supabase no crea la
  -- cuenta. Sin perfil, la app muestra "sin perfil" y se puede corregir.
  raise warning 'crear_perfil_al_registrarse: %', sqlerrm;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from usuarios where id = (select auth.uid()) and rol = 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.estadisticas_citas(p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_resultado jsonb;
begin
  if not es_admin() then raise exception 'Solo un administrador puede ver las estadísticas.'; end if;

  with
  -- Citas pedidas por pacientes en el periodo (excluye horarios libres y los
  -- horarios cerrados por el sistema sin paciente).
  solicitudes as (
    select c.*, m.especialidad_id, m.sede_id
    from citas c join medicos m on m.id = c.medico_id
    where c.paciente_id is not null
      and c.estado <> 'disponible'
      and (p_desde is null or c.inicio >= p_desde)
  ),
  agenda as (
    select c.estado, m.especialidad_id, m.sede_id
    from citas c join medicos m on m.id = c.medico_id
    where c.inicio > now() and c.inicio <= now() + interval '14 days'
      and c.estado in ('disponible', 'pendiente', 'confirmada')
  ),
  novedades as (
    select * from reportes where p_desde is null or creado_en >= p_desde
  )
  select jsonb_build_object(
    'totales', (
      select jsonb_build_object(
        'solicitudes', count(*),
        'pendientes', count(*) filter (where estado = 'pendiente'),
        'confirmadas', count(*) filter (where estado = 'confirmada'),
        'rechazadas', count(*) filter (where estado = 'rechazada'),
        'canceladas', count(*) filter (where estado = 'cancelada'),
        'atendidas', count(*) filter (where estado = 'atendida'),
        'no_asistio', count(*) filter (where estado = 'no_asistio'),
        'cancelada_paciente', count(*) filter (where estado = 'cancelada' and cancelada_por = 'paciente'),
        'cancelada_medico', count(*) filter (where estado = 'cancelada' and cancelada_por = 'medico'),
        'cancelada_sistema', count(*) filter (where estado = 'cancelada' and cancelada_por = 'sistema'),
        -- Solo citas con ambos tiempos (las anteriores a la parte 3 no los tienen).
        'respuesta_promedio_seg', (
          select round(avg(extract(epoch from respondida_en - solicitada_en)))
          from solicitudes where respondida_en is not null and solicitada_en is not null
        ),
        'respuesta_muestras', count(*) filter (where respondida_en is not null and solicitada_en is not null)
      )
      from solicitudes
    ),
    'ocupacion_especialidad', (
      select coalesce(jsonb_agg(jsonb_build_object('etiqueta', e.nombre, 'tomadas', x.tomadas, 'ofrecidas', x.ofrecidas)
                                order by x.tomadas::numeric / nullif(x.ofrecidas, 0) desc nulls last, e.nombre), '[]'::jsonb)
      from (
        select especialidad_id, count(*) filter (where estado <> 'disponible') as tomadas, count(*) as ofrecidas
        from agenda group by especialidad_id
      ) x join especialidades e on e.id = x.especialidad_id
    ),
    'ocupacion_sede', (
      select coalesce(jsonb_agg(jsonb_build_object('etiqueta', coalesce(s.nombre, 'Sin sede'), 'tomadas', x.tomadas, 'ofrecidas', x.ofrecidas)
                                order by x.tomadas::numeric / nullif(x.ofrecidas, 0) desc nulls last, s.nombre), '[]'::jsonb)
      from (
        select sede_id, count(*) filter (where estado <> 'disponible') as tomadas, count(*) as ofrecidas
        from agenda group by sede_id
      ) x left join sedes s on s.id = x.sede_id
    ),
    -- 24 horas con ceros incluidos (generate_series), en hora de Colombia.
    'demanda_hora', (
      select jsonb_agg(jsonb_build_object('hora', h, 'total', coalesce(t.total, 0)) order by h)
      from generate_series(0, 23) h
      left join (
        select extract(hour from inicio at time zone 'America/Bogota')::int as hora, count(*) as total
        from solicitudes group by 1
      ) t on t.hora = h
    ),
    'novedades', (
      select jsonb_build_object(
        'total', count(*),
        'pendientes', count(*) filter (where estado = 'pendiente'),
        'aprobadas', count(*) filter (where estado = 'aprobado'),
        'rechazadas', count(*) filter (where estado = 'rechazado'),
        'retrasos', count(*) filter (where tipo = 'retraso'),
        'ausencias', count(*) filter (where tipo = 'ausencia'),
        'otras', count(*) filter (where tipo = 'otro'),
        'revision_promedio_seg', round(avg(extract(epoch from revisado_en - creado_en)) filter (where revisado_en is not null))
      )
      from novedades
    )
  ) into v_resultado;

  return v_resultado;
end $function$;

CREATE OR REPLACE FUNCTION public.guardar_pregunta_seguridad(p_pregunta text, p_respuesta text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if length(trim(coalesce(p_pregunta, ''))) < 5 then raise exception 'La pregunta de seguridad es demasiado corta'; end if;
  if length(normalizar_respuesta(p_respuesta)) < 2 then raise exception 'La respuesta de seguridad es demasiado corta'; end if;
  insert into seguridad_usuario (usuario_id, pregunta, respuesta_hash)
  values (auth.uid(), trim(p_pregunta), extensions.crypt(normalizar_respuesta(p_respuesta), extensions.gen_salt('bf')))
  on conflict (usuario_id) do update set pregunta = excluded.pregunta, respuesta_hash = excluded.respuesta_hash,
    intentos_fallidos = 0, bloqueado_hasta = null, actualizado_en = now();
end $function$;

CREATE OR REPLACE FUNCTION public.normalizar_respuesta(p_texto text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions', 'pg_temp'
AS $function$
  select lower(trim(extensions.unaccent(coalesce(p_texto, ''))))
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_horario(p_medico uuid, p_inicio timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into citas (medico_id, inicio)
  select p_medico, p_inicio
  where p_inicio > now()
  on conflict (medico_id, inicio) where estado in ('disponible', 'pendiente', 'confirmada') do nothing;
$function$;

CREATE OR REPLACE FUNCTION public.recuperacion_obtener_pregunta(p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_pregunta text;
begin
  select s.pregunta into v_pregunta
  from auth.users u
  join seguridad_usuario s on s.usuario_id = u.id
  join usuarios p on p.id = u.id and p.rol = 'paciente'
  where lower(u.email) = lower(trim(p_email));
  return v_pregunta;
end $function$;

CREATE OR REPLACE FUNCTION public.recuperacion_verificar(p_email text, p_respuesta text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_id uuid; v_hash text; v_intentos int; v_bloqueado timestamptz; v_max_intentos constant int := 5;
begin
  select u.id, s.respuesta_hash, s.intentos_fallidos, s.bloqueado_hasta
    into v_id, v_hash, v_intentos, v_bloqueado
  from auth.users u
  join seguridad_usuario s on s.usuario_id = u.id
  join usuarios p on p.id = u.id and p.rol = 'paciente'
  where lower(u.email) = lower(trim(p_email));
  if v_id is null then return jsonb_build_object('estado', 'sin_pregunta'); end if;
  if v_bloqueado is not null and v_bloqueado > now() then
    return jsonb_build_object('estado', 'bloqueado', 'bloqueado_hasta', v_bloqueado);
  end if;
  if v_hash = extensions.crypt(normalizar_respuesta(p_respuesta), v_hash) then
    update seguridad_usuario set intentos_fallidos = 0, bloqueado_hasta = null where usuario_id = v_id;
    return jsonb_build_object('estado', 'ok', 'usuario_id', v_id);
  end if;
  v_intentos := v_intentos + 1;
  update seguridad_usuario set intentos_fallidos = v_intentos,
    bloqueado_hasta = case when v_intentos >= v_max_intentos then now() + interval '15 minutes' else null end
  where usuario_id = v_id;
  if v_intentos >= v_max_intentos then
    return jsonb_build_object('estado', 'bloqueado', 'bloqueado_hasta', now() + interval '15 minutes');
  end if;
  return jsonb_build_object('estado', 'incorrecta', 'intentos_restantes', v_max_intentos - v_intentos);
end $function$;

CREATE OR REPLACE FUNCTION public.reprogramar_cita(p_actual uuid, p_nueva uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.responder_cita(p_cita uuid, p_estado text, p_mensaje text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.tomar_cita(p_cita uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.validar_reserva(p_paciente uuid, p_inicio timestamp with time zone, p_especialidad uuid, p_excluir uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$;

-- 5. Triggers

CREATE TRIGGER crear_perfil_al_registrarse AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION crear_perfil_al_registrarse();
