-- Novedades 2.0 (parte 1 del plan de acción, propuesta E3).
-- Una novedad deja de ser solo texto: tiene tipo, minutos de retraso, el día al
-- que afecta y, si el admin la rechaza, el motivo. Es la base de las alertas
-- con hora estimada (parte 2).
-- Idempotente.

-- 1. Columnas ----------------------------------------------------------------
alter table reportes add column if not exists tipo text not null default 'otro';
alter table reportes add column if not exists minutos_retraso int;
alter table reportes add column if not exists fecha_afectada date not null
  default (now() at time zone 'America/Bogota')::date;
alter table reportes add column if not exists comentario_admin text;
alter table reportes add column if not exists origen text not null default 'medico';

-- 2. Datos existentes: "Retraso de N min" pasa a tipo retraso con N minutos;
--    la fecha afectada es el día (en Colombia) en que se reportó.
update reportes
set tipo = 'retraso',
    minutos_retraso = substring(motivo from '^Retraso de (\d+) min')::int
where motivo ~ '^Retraso de \d+ min' and minutos_retraso is null;

update reportes set tipo = 'ausencia' where motivo = 'No disponible hoy' and tipo = 'otro';

update reportes set fecha_afectada = (creado_en at time zone 'America/Bogota')::date
where fecha_afectada <> (creado_en at time zone 'America/Bogota')::date;

-- 3. Reglas ------------------------------------------------------------------
alter table reportes drop constraint if exists reportes_tipo_valido;
alter table reportes add constraint reportes_tipo_valido check (tipo in ('retraso', 'ausencia', 'otro'));

alter table reportes drop constraint if exists reportes_minutos_validos;
alter table reportes add constraint reportes_minutos_validos check (
  (tipo = 'retraso' and minutos_retraso between 1 and 240)
  or (tipo <> 'retraso' and minutos_retraso is null)
);

alter table reportes drop constraint if exists reportes_comentario_valido;
alter table reportes add constraint reportes_comentario_valido check (
  comentario_admin is null
  or (char_length(comentario_admin) between 1 and 300 and comentario_admin = btrim(comentario_admin))
);

alter table reportes drop constraint if exists reportes_origen_valido;
alter table reportes add constraint reportes_origen_valido check (origen in ('medico', 'sistema'));

-- 4. El médico solo crea novedades pendientes, suyas, sin comentario del admin
--    y para hoy o un día futuro.
drop policy if exists reportes_insert_medico on reportes;
create policy reportes_insert_medico on reportes for insert to authenticated
  with check (
    medico_id = (select auth.uid())
    and estado = 'pendiente'
    and revisado_por is null
    and revisado_en is null
    and archivado = false
    and comentario_admin is null
    and origen = 'medico'
    and fecha_afectada >= (now() at time zone 'America/Bogota')::date
  );

-- 5. Índice para buscar las novedades de un médico en un día (alertas).
create index if not exists reportes_medico_fecha_idx on reportes (medico_id, fecha_afectada);
