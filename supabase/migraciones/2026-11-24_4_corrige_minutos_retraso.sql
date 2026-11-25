-- Corrige reportes_minutos_validos (de 2026-11-24_1_novedades_estructuradas.sql).
--
-- Error: un CHECK se cumple cuando la condición da NULL, no solo cuando da true.
-- Con tipo = 'retraso' y minutos_retraso NULL, la regla anterior
--   (tipo = 'retraso' and minutos_retraso between 1 and 240) or (...)
-- daba (true and NULL) or false = NULL → se aceptaba un retraso sin minutos.
-- Lo detectó la prueba de punta a punta del 24-nov-2026. La app siempre manda
-- los minutos, así que no hay filas afectadas; aun así la regla debe cumplirse.
-- Idempotente.

alter table reportes drop constraint if exists reportes_minutos_validos;
alter table reportes add constraint reportes_minutos_validos check (
  case
    when tipo = 'retraso' then coalesce(minutos_retraso between 1 and 240, false)
    else minutos_retraso is null
  end
);
