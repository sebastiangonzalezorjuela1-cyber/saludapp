-- Panel de estadísticas del admin (parte 4 del plan de acción, propuesta N1).
-- Patrón de estadisticas_reportes de Buses Metro: TODO el panel en un solo
-- jsonb, con una sola llamada RPC. Horas en America/Bogota.
-- Requiere las migraciones de las partes 1-3 (tipo de novedad, estados de
-- cierre, solicitada_en / respondida_en). Idempotente.
--
-- p_desde: inicio del periodo (null = todo). Las métricas de solicitudes usan
-- la fecha de la cita (inicio). La ocupación mira SIEMPRE los próximos 14 días,
-- porque mide cuánta agenda abierta queda, no lo que pasó.

create or replace function public.estadisticas_citas(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
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
end $$;

revoke execute on function public.estadisticas_citas(timestamptz) from public, anon;
grant execute on function public.estadisticas_citas(timestamptz) to authenticated;
