-- Los mails al comprador que dispara el panel salen después de responder: el panel no espera al servidor de correo.
-- `enviado_en` anota cuándo se empezó a mandar el aviso; `confirmado_en`, cuándo lo aceptó el servidor de correo.
-- Una fila sin confirmar es un mail que todavía está saliendo; si falla, la fila se borra como hasta ahora.
-- El panel pregunta por este dato a los pocos segundos (GET /api/pagos?recurso=mail) y avisa si el mail no salió.

alter table public.avisos_al_comprador add column if not exists confirmado_en timestamptz;

comment on column public.avisos_al_comprador.confirmado_en is
  'Cuándo el servidor de correo aceptó el mail. Nulo: todavía está saliendo, o la función se cortó antes de terminar.';

-- Los avisos anteriores a este cambio se anotaban y se mandaban en el mismo paso: ya salieron.
update public.avisos_al_comprador set confirmado_en = enviado_en where confirmado_en is null;
