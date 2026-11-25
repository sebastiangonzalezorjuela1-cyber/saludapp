-- ============================================================================
-- SaludApp · FOTO de la seguridad: RLS, políticas, permisos y tiempo real.
-- Se ejecuta después de schema.sql.
--
-- Generado el 25-nov-2026 desde el proyecto khyfckehcvpnswdjyshv con
-- supabase/herramientas/exportar-esquema.sql. No se edita a mano: tras cada
-- migración se vuelve a exportar.
--
-- Ojo: Supabase da por defecto todos los permisos de tabla y EXECUTE de
-- funciones a anon y authenticated ("default privileges"). Por eso los
-- apartados 3 y 4 revocan explícitamente lo que no debe estar abierto.
-- ============================================================================

-- 1. RLS activo

alter table public.citas enable row level security;
alter table public.especialidades enable row level security;
alter table public.medicos enable row level security;
alter table public.reportes enable row level security;
alter table public.sedes enable row level security;
alter table public.seguridad_usuario enable row level security; -- sin políticas a propósito: tabla secreta
alter table public.usuarios enable row level security;

-- 2. Políticas

create policy citas_insert_admin on public.citas as permissive for insert to authenticated
  with check (es_admin());

create policy citas_select on public.citas as permissive for select to authenticated
  using (((estado = 'disponible'::text) OR (paciente_id = ( SELECT auth.uid() AS uid)) OR (medico_id = ( SELECT auth.uid() AS uid)) OR es_admin()));

create policy especialidades_select on public.especialidades as permissive for select to anon, authenticated
  using (true);

create policy medicos_select on public.medicos as permissive for select to anon, authenticated
  using (true);

create policy medicos_update_admin on public.medicos as permissive for update to authenticated
  using (es_admin())
  with check (es_admin());

create policy reportes_insert_medico on public.reportes as permissive for insert to authenticated
  with check (((medico_id = ( SELECT auth.uid() AS uid)) AND (estado = 'pendiente'::text) AND (revisado_por IS NULL) AND (revisado_en IS NULL) AND (archivado = false) AND (comentario_admin IS NULL) AND (origen = 'medico'::text) AND (fecha_afectada >= ((now() AT TIME ZONE 'America/Bogota'::text))::date)));

create policy reportes_select on public.reportes as permissive for select to authenticated
  using ((es_admin() OR (medico_id = ( SELECT auth.uid() AS uid)) OR ((estado = 'aprobado'::text) AND (archivado = false) AND (EXISTS ( SELECT 1
   FROM citas c
  WHERE ((c.paciente_id = ( SELECT auth.uid() AS uid)) AND (c.medico_id = reportes.medico_id) AND (c.estado = ANY (ARRAY['pendiente'::text, 'confirmada'::text])) AND (((c.inicio AT TIME ZONE 'America/Bogota'::text))::date = reportes.fecha_afectada)))))));

create policy reportes_update_admin on public.reportes as permissive for update to authenticated
  using (es_admin());

create policy sedes_select on public.sedes as permissive for select to anon, authenticated
  using (true);

create policy usuarios_select on public.usuarios as permissive for select to authenticated
  using (true);

create policy usuarios_update_propio on public.usuarios as permissive for update to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));

-- 3. Permisos de funciones

revoke execute on function public.archivar_reportes_resueltos(p_dias integer) from public, anon, authenticated;
revoke execute on function public.cancelar_cita(p_cita uuid, p_motivo text) from public, anon, authenticated;
revoke execute on function public.cancelar_citas_por_ausencia(p_reporte uuid) from public, anon, authenticated;
revoke execute on function public.cerrar_cita(p_cita uuid, p_resultado text) from public, anon, authenticated;
revoke execute on function public.crear_perfil_al_registrarse() from public, anon, authenticated;
revoke execute on function public.es_admin() from public, anon, authenticated;
revoke execute on function public.estadisticas_citas(p_desde timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.guardar_pregunta_seguridad(p_pregunta text, p_respuesta text) from public, anon, authenticated;
revoke execute on function public.normalizar_respuesta(p_texto text) from public, anon, authenticated;
revoke execute on function public.reabrir_horario(p_medico uuid, p_inicio timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.recuperacion_obtener_pregunta(p_email text) from public, anon, authenticated;
revoke execute on function public.recuperacion_verificar(p_email text, p_respuesta text) from public, anon, authenticated;
revoke execute on function public.reprogramar_cita(p_actual uuid, p_nueva uuid, p_motivo text) from public, anon, authenticated;
revoke execute on function public.responder_cita(p_cita uuid, p_estado text, p_mensaje text) from public, anon, authenticated;
revoke execute on function public.tomar_cita(p_cita uuid, p_motivo text) from public, anon, authenticated;
revoke execute on function public.validar_reserva(p_paciente uuid, p_inicio timestamp with time zone, p_especialidad uuid, p_excluir uuid) from public, anon, authenticated;
grant execute on function public.archivar_reportes_resueltos(p_dias integer) to authenticated;
grant execute on function public.cancelar_cita(p_cita uuid, p_motivo text) to authenticated;
grant execute on function public.cancelar_citas_por_ausencia(p_reporte uuid) to authenticated;
grant execute on function public.cerrar_cita(p_cita uuid, p_resultado text) to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.estadisticas_citas(p_desde timestamp with time zone) to authenticated;
grant execute on function public.guardar_pregunta_seguridad(p_pregunta text, p_respuesta text) to authenticated;
grant execute on function public.normalizar_respuesta(p_texto text) to anon;
grant execute on function public.normalizar_respuesta(p_texto text) to authenticated;
grant execute on function public.normalizar_respuesta(p_texto text) to public;
grant execute on function public.reprogramar_cita(p_actual uuid, p_nueva uuid, p_motivo text) to authenticated;
grant execute on function public.responder_cita(p_cita uuid, p_estado text, p_mensaje text) to authenticated;
grant execute on function public.tomar_cita(p_cita uuid, p_motivo text) to authenticated;
-- recuperacion_* y crear_perfil_al_registrarse, reabrir_horario y validar_reserva
-- quedan solo para service_role / el dueño (Edge Function, trigger y funciones internas).

-- 4. Permisos de tablas (diferencias con el estándar de Supabase)

revoke delete on public.citas from anon;
revoke delete on public.citas from authenticated;
revoke insert on public.usuarios from anon;
revoke insert on public.usuarios from authenticated;
revoke update on public.citas from anon;
revoke update on public.citas from authenticated;
revoke update on public.usuarios from anon;
revoke update on public.usuarios from authenticated;
-- Después de los revoke: "revoke update" sobre la tabla también quita los
-- permisos por columna, así que este grant tiene que ir al final.
grant update (nombre) on public.usuarios to authenticated;

-- 5. Tiempo real

alter publication supabase_realtime add table public.citas;
alter publication supabase_realtime add table public.reportes;
