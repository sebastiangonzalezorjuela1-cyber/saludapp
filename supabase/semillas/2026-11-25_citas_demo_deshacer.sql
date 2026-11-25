-- Deshace 2026-11-25_citas_demo.sql: devuelve a 'disponible' los horarios que
-- usaron los pacientes ficticios y borra esos pacientes (demo.pacienteNN@saludapp.test).
-- Se puede ejecutar aunque no haya nada que deshacer.

do $deshacer$
declare v_pacientes uuid[];
begin
  select array_agg(id) into v_pacientes from auth.users where email like 'demo.paciente%@saludapp.test';
  if v_pacientes is null then
    raise notice 'No hay datos de demo que deshacer.';
    return;
  end if;

  -- Si durante la demo alguien rechazó una de estas citas, la app ya reabrió ese
  -- horario en otra fila: esta se borra (volver a 'disponible' la duplicaría).
  delete from citas c
  where c.paciente_id = any (v_pacientes)
    and exists (
      select 1 from citas o
      where o.id <> c.id and o.medico_id = c.medico_id and o.inicio = c.inicio
        and o.estado in ('disponible', 'pendiente', 'confirmada')
    );

  update citas set paciente_id = null, estado = 'disponible', motivo = null, mensaje = null,
    cancelada_por = null, motivo_cancelacion = null, solicitada_en = null, respondida_en = null,
    actualizado_en = now()
  where paciente_id = any (v_pacientes);

  -- Borra los usuarios; su perfil (usuarios) y su pregunta de seguridad se van en cascada.
  delete from auth.users where id = any (v_pacientes);
end $deshacer$;

select count(*) as pacientes_demo_restantes from auth.users where email like 'demo.paciente%@saludapp.test';
