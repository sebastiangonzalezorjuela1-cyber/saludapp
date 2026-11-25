-- Exporta la "foto" del esquema público de SaludApp como SQL.
-- SOLO LECTURA: consulta el catálogo de Postgres, no cambia nada.
-- Uso: pegarlo en el SQL Editor de Supabase y copiar las dos filas resultantes
-- a supabase/schema.sql (parte 'schema') y supabase/policies.sql (parte 'policies').
-- No se usa pg_dump ni la CLI de Supabase porque exigen Docker o la cadena de
-- conexión (procedimiento de la guía de Buses Metro, §5.8).

with
tablas as (
  select c.oid, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
ddl_tablas as (
  select string_agg(
    format(E'create table if not exists public.%I (\n%s\n);', t.relname, cols.def),
    E'\n\n' order by t.relname) as sql
  from tablas t
  cross join lateral (
    select string_agg(
      format('  %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
        case when d.adbin is not null then ' default ' || pg_get_expr(d.adbin, d.adrelid) else '' end,
        case when a.attnotnull then ' not null' else '' end),
      E',\n' order by a.attnum) as def
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  ) cols
),
-- Claves primarias, únicas y checks primero; foráneas al final (las tablas ya existen).
ddl_restricciones as (
  select string_agg(
    format('alter table public.%I add constraint %I %s;', t.relname, k.conname, pg_get_constraintdef(k.oid)),
    E'\n' order by case k.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end, t.relname, k.conname) as sql
  from pg_constraint k join tablas t on t.oid = k.conrelid
),
ddl_indices as (
  select string_agg(i.indexdef || ';', E'\n' order by i.tablename, i.indexname) as sql
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (select 1 from pg_constraint k where k.conname = i.indexname)
),
funciones as (
  select p.oid, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
ddl_funciones as (
  select string_agg(rtrim(pg_get_functiondef(f.oid), E'\n') || ';', E'\n\n' order by f.proname) as sql
  from funciones f
),
ddl_triggers as (
  select string_agg(pg_get_triggerdef(tg.oid) || ';', E'\n' order by tg.tgname) as sql
  from pg_trigger tg
  join funciones f on f.oid = tg.tgfoid
  where not tg.tgisinternal
),
rls as (
  select string_agg(format('alter table public.%I enable row level security;', c.relname), E'\n' order by c.relname) as sql
  from pg_class c join tablas t on t.oid = c.oid
  where c.relrowsecurity
),
politicas as (
  select string_agg(
    format('create policy %I on public.%I as %s for %s to %s%s%s;',
      p.polname, t.relname,
      case when p.polpermissive then 'permissive' else 'restrictive' end,
      case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
      (select string_agg(case when r = 0 then 'public' else quote_ident(ro.rolname) end, ', ')
         from unnest(p.polroles) r left join pg_roles ro on ro.oid = r),
      case when p.polqual is not null then E'\n  using (' || pg_get_expr(p.polqual, p.polrelid) || ')' else '' end,
      case when p.polwithcheck is not null then E'\n  with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' else '' end),
    E'\n\n' order by t.relname, p.polname) as sql
  from pg_policy p join tablas t on t.oid = p.polrelid
),
-- Permisos de ejecución: se revoca todo y se concede solo lo que hay.
permisos_funciones as (
  select string_agg(linea, E'\n' order by orden, linea) as sql
  from (
    select 1 as orden, format('revoke execute on function public.%I(%s) from public, anon, authenticated;',
      f.proname, pg_get_function_identity_arguments(f.oid)) as linea
    from funciones f
    union all
    select 2, format('grant execute on function public.%I(%s) to %s;', f.proname, pg_get_function_identity_arguments(f.oid),
      case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end)
    from funciones f
    join pg_proc p on p.oid = f.oid
    cross join lateral aclexplode(p.proacl) a
    left join pg_roles r on r.oid = a.grantee
    where a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated'))
  ) x
),
-- Permisos de tabla que se apartan del estándar de Supabase (todo para anon y authenticated).
-- Primero los revoke y después los grant por columna: "revoke update" sobre la
-- tabla también quita los permisos por columna.
permisos_tablas as (
  select string_agg(linea, E'\n' order by orden, linea) as sql
  from (
    select 1 as orden, format('revoke %s on public.%I from %I;', lower(priv), t.relname, rol) as linea
    from tablas t
    cross join unnest(array['anon', 'authenticated']) rol
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) priv
    where not has_table_privilege(rol, t.oid, priv)
    union all
    select 2, format('grant update (%I) on public.%I to %I;', cp.column_name, cp.table_name, cp.grantee)
    from information_schema.column_privileges cp
    where cp.table_schema = 'public' and cp.privilege_type = 'UPDATE' and cp.grantee in ('anon', 'authenticated')
      and not has_table_privilege(cp.grantee, format('public.%I', cp.table_name), 'UPDATE')
  ) x
),
publicacion as (
  select string_agg(format('alter publication supabase_realtime add table public.%I;', tablename), E'\n' order by tablename) as sql
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
)
select 'schema' as parte,
  E'-- 1. Tablas\n\n' || (select sql from ddl_tablas)
  || E'\n\n-- 2. Restricciones (claves, checks y foráneas)\n\n' || (select sql from ddl_restricciones)
  || E'\n\n-- 3. Índices\n\n' || coalesce((select sql from ddl_indices), '')
  || E'\n\n-- 4. Funciones\n\n' || (select sql from ddl_funciones)
  || E'\n\n-- 5. Triggers\n\n' || coalesce((select sql from ddl_triggers), '') as sql
union all
select 'policies',
  E'-- 1. RLS activo\n\n' || (select sql from rls)
  || E'\n\n-- 2. Políticas\n\n' || (select sql from politicas)
  || E'\n\n-- 3. Permisos de funciones\n\n' || (select sql from permisos_funciones)
  || E'\n\n-- 4. Permisos de tablas (diferencias con el estándar de Supabase)\n\n' || coalesce((select sql from permisos_tablas), '')
  || E'\n\n-- 5. Tiempo real\n\n' || (select sql from publicacion);
