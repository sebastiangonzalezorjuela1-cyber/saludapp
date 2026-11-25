-- Seguridad mínima para la demo (plan exprés, bloque 1).
-- Corrige H-S1, H-S2 y H-S4 de docs/auditoria/01-auditoria-proyecto.md.
-- Idempotente: se puede ejecutar más de una vez.

-- H-S1: un médico solo puede crear novedades PENDIENTES. Antes la policy solo
-- comprobaba medico_id, así que por API se podía insertar una ya "aprobada" y
-- saltarse al administrador.
drop policy if exists reportes_insert_medico on reportes;
create policy reportes_insert_medico on reportes for insert to authenticated
  with check (
    medico_id = (select auth.uid())
    and estado = 'pendiente'
    and revisado_por is null
    and revisado_en is null
    and archivado = false
  );

-- Advisor 0003: auth.uid() envuelto en select se evalúa una vez por consulta.
drop policy if exists citas_select on citas;
create policy citas_select on citas for select to authenticated
  using (
    estado = 'disponible'
    or paciente_id = (select auth.uid())
    or medico_id = (select auth.uid())
    or es_admin()
  );

-- H-S4: Supabase da EXECUTE a anon/authenticated por default privileges, y
-- "revoke from public" no alcanza. Se revoca por rol.
revoke execute on function archivar_reportes_resueltos(integer) from public, anon;
revoke execute on function cancelar_cita(uuid) from public, anon;
revoke execute on function responder_cita(uuid, text, text) from public, anon;
revoke execute on function tomar_cita(uuid, text) from public, anon;
revoke execute on function guardar_pregunta_seguridad(text, text) from public, anon;
revoke execute on function es_admin() from public, anon;
grant execute on function archivar_reportes_resueltos(integer) to authenticated;
grant execute on function cancelar_cita(uuid) to authenticated;
grant execute on function responder_cita(uuid, text, text) to authenticated;
grant execute on function tomar_cita(uuid, text) to authenticated;
grant execute on function guardar_pregunta_seguridad(text, text) to authenticated;
grant execute on function es_admin() to authenticated;

-- H-S2: la recuperación por pregunta de seguridad solo sirve para pacientes.
-- Antes cualquiera que leyera el README podía cambiar la contraseña del admin.
-- (create or replace conserva los permisos: siguen siendo solo de service_role.)
create or replace function public.recuperacion_obtener_pregunta(p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_pregunta text;
begin
  select s.pregunta into v_pregunta
  from auth.users u
  join seguridad_usuario s on s.usuario_id = u.id
  join usuarios p on p.id = u.id and p.rol = 'paciente'
  where lower(u.email) = lower(trim(p_email));
  return v_pregunta;
end $$;

create or replace function public.recuperacion_verificar(p_email text, p_respuesta text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
end $$;

-- Las preguntas del personal ya no sirven para nada: se borran.
delete from seguridad_usuario
where usuario_id in (select id from usuarios where rol <> 'paciente');

-- Advisor 0001: índices de las FK que se consultan.
create index if not exists medicos_especialidad_idx on medicos (especialidad_id);
create index if not exists medicos_sede_idx on medicos (sede_id);
create index if not exists reportes_medico_idx on reportes (medico_id);
create index if not exists reportes_revisado_por_idx on reportes (revisado_por);
