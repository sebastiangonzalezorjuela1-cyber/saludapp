-- Perfil creado por la base al registrarse (plan exprés, bloque 2).
-- Corrige H-U2: antes el perfil lo insertaba el navegador después de signUp, y
-- si Auth exigía confirmar el correo la cuenta quedaba sin perfil.
-- Requiere el frontend que manda el nombre en signUp({ options: { data: { nombre } } }).
-- Idempotente.

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
end $$;

revoke execute on function public.crear_perfil_al_registrarse() from public, anon, authenticated;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- El navegador ya no inserta perfiles: se quita esa puerta.
drop policy if exists usuarios_insert_paciente on usuarios;
revoke insert on usuarios from anon, authenticated;
