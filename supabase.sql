-- ¿Qué vemos? · Base de datos para Supabase
-- Pega todo esto en Supabase > SQL Editor > New query, cambia el PIN de la línea marcada y pulsa Run.

create extension if not exists pgcrypto with schema extensions;

create table if not exists app_secret (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);

-- >>> CAMBIA 1234 POR VUESTRO PIN DE 4 CIFRAS <<<
insert into app_secret (id, pin_hash) values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;

create table if not exists list_items (
  owner text not null check (owner in ('oswaldo','ana','angela','comun')),
  item_key text not null,
  item jsonb not null,
  added_by text not null check (added_by in ('oswaldo','ana','angela')),
  created_at timestamptz not null default now(),
  primary key (owner, item_key)
);

create table if not exists seen_items (
  owner text not null check (owner in ('oswaldo','ana','angela')),
  item_key text not null,
  item jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, item_key)
);

create table if not exists comments (
  id bigserial primary key,
  item_key text not null,
  item jsonb not null,
  author text not null check (author in ('oswaldo','ana','angela')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists likes (
  item_key text not null,
  author text not null check (author in ('oswaldo','ana','angela')),
  primary key (item_key, author)
);

-- Nadie puede leer ni escribir las tablas directamente: todo pasa por las funciones con PIN.
alter table app_secret enable row level security;
alter table list_items enable row level security;
alter table seen_items enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;
revoke all on app_secret, list_items, seen_items, comments, likes from anon, authenticated;

create or replace function qv_check(p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin is null or not exists (select 1 from app_secret where pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'PIN incorrecto' using errcode = '28000';
  end if;
end $$;

create or replace function qv_login(p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  return exists (select 1 from app_secret where pin_hash = crypt(p_pin, pin_hash));
end $$;

create or replace function qv_state(p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  return jsonb_build_object(
    'lists', coalesce((select jsonb_agg(jsonb_build_object('owner',owner,'key',item_key,'item',item,'by',added_by,'at',created_at) order by created_at desc) from list_items), '[]'::jsonb),
    'seen', coalesce((select jsonb_agg(jsonb_build_object('owner',owner,'key',item_key,'item',item,'at',created_at) order by created_at desc) from seen_items), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',item_key,'item',item,'author',author,'body',body,'at',created_at) order by created_at) from comments), '[]'::jsonb),
    'likes', coalesce((select jsonb_agg(jsonb_build_object('key',item_key,'author',author)) from likes), '[]'::jsonb)
  );
end $$;

create or replace function qv_list_add(p_pin text, p_owner text, p_key text, p_item jsonb, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  insert into list_items (owner, item_key, item, added_by) values (p_owner, p_key, p_item, p_by)
  on conflict (owner, item_key) do nothing;
end $$;

create or replace function qv_list_remove(p_pin text, p_owner text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  delete from list_items where owner = p_owner and item_key = p_key;
end $$;

create or replace function qv_seen_toggle(p_pin text, p_owner text, p_key text, p_item jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  if exists (select 1 from seen_items where owner = p_owner and item_key = p_key) then
    delete from seen_items where owner = p_owner and item_key = p_key;
    return false;
  end if;
  insert into seen_items (owner, item_key, item) values (p_owner, p_key, p_item);
  delete from list_items where owner = p_owner and item_key = p_key;
  return true;
end $$;

create or replace function qv_comment_add(p_pin text, p_key text, p_item jsonb, p_author text, p_body text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  insert into comments (item_key, item, author, body) values (p_key, p_item, p_author, trim(p_body));
end $$;

create or replace function qv_comment_delete(p_pin text, p_id bigint, p_author text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  delete from comments where id = p_id and author = p_author;
end $$;

create or replace function qv_like_toggle(p_pin text, p_key text, p_author text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform qv_check(p_pin);
  if exists (select 1 from likes where item_key = p_key and author = p_author) then
    delete from likes where item_key = p_key and author = p_author;
    return false;
  end if;
  insert into likes (item_key, author) values (p_key, p_author);
  return true;
end $$;

revoke all on function qv_check(text) from public, anon, authenticated;
grant execute on function
  qv_login(text), qv_state(text),
  qv_list_add(text,text,text,jsonb,text), qv_list_remove(text,text,text),
  qv_seen_toggle(text,text,text,jsonb),
  qv_comment_add(text,text,jsonb,text,text), qv_comment_delete(text,bigint,text),
  qv_like_toggle(text,text,text)
to anon, authenticated;
