-- Sabelotodo · Preguntas de la familia
-- Pega todo esto en Supabase > SQL Editor > New query y pulsa Run (solo hace falta una vez).
-- Crea una tabla para las respuestas de la encuesta familiar y dos funciones para guardarlas y leerlas.

create table if not exists sbt_familia (
  familia text not null default 'familia',
  nombre text not null check (char_length(nombre) between 1 and 40),
  avatar text,
  datos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (familia, nombre)
);
alter table sbt_familia enable row level security;

create or replace function sbt_guardar(p_familia text, p_nombre text, p_avatar text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_nombre is null or char_length(trim(p_nombre)) < 1 then raise exception 'Falta el nombre'; end if;
  if pg_column_size(p_datos) > 20000 then raise exception 'Demasiado texto'; end if;
  insert into sbt_familia (familia, nombre, avatar, datos, updated_at)
  values (coalesce(nullif(lower(trim(p_familia)), ''), 'familia'), left(trim(p_nombre), 40), left(p_avatar, 16), p_datos, now())
  on conflict (familia, nombre) do update set avatar = excluded.avatar, datos = excluded.datos, updated_at = now();
end $$;

create or replace function sbt_leer(p_familia text) returns table (nombre text, avatar text, datos jsonb)
language sql security definer set search_path = public as $$
  select nombre, avatar, datos from sbt_familia
  where familia = coalesce(nullif(lower(trim(p_familia)), ''), 'familia')
  order by updated_at;
$$;

grant execute on function sbt_guardar(text, text, text, jsonb), sbt_leer(text) to anon, authenticated;

-- Para borrar a alguien: delete from sbt_familia where nombre = 'Nombre';
