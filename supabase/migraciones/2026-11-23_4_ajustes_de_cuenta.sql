-- Ajustes de cuenta (plan exprés, bloque 4): cada usuario puede cambiar SU nombre.
-- Idempotente.

-- El nombre no puede quedar vacío, ser enorme ni tener espacios en los extremos.
-- (Se comprobó que los 12 usuarios actuales cumplen la regla.)
alter table usuarios drop constraint if exists usuarios_nombre_valido;
alter table usuarios add constraint usuarios_nombre_valido
  check (char_length(nombre) between 1 and 80 and nombre = btrim(nombre));

drop policy if exists usuarios_update_propio on usuarios;
create policy usuarios_update_propio on usuarios for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- La policy no limita columnas: sin esto, cualquiera podría cambiarse el rol.
revoke update on usuarios from anon, authenticated;
grant update (nombre) on usuarios to authenticated;
